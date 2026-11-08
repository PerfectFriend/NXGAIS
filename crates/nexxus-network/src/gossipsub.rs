// [SIM] PLACEHOLDER — In-Process Gossipsub Pub-Sub Engine & Deduplication Cache.
// Audit ID: NET-GOSSIP-01 (Grok Audit #3).
// ATTENTION: This module provides in-process topic-based message deduplication and local
// publishing queues. It does NOT perform network fan-out over active TCP/UDP mesh peers.

use nexxus_core::{NexxusError, Result};
use sha2::{Digest, Sha256};
use std::collections::{HashSet, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct Topic(pub String);

impl Topic {
    pub const ANNOUNCEMENTS: &'static str = "nexxus/v2/announcements";
    pub const POR_AUDIT: &'static str = "nexxus/v2/por-audit";
    pub const EMERGENCY_BEACON: &'static str = "nexxus/v2/emergency-beacon";

    pub fn new(name: impl Into<String>) -> Self {
        Self(name.into())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GossipMessage {
    pub msg_id: String,
    pub topic: Topic,
    pub source_peer_id: String,
    pub timestamp_utc: u64,
    pub payload: Vec<u8>,
    pub signature: Option<String>,
}

impl GossipMessage {
    pub fn new(topic: Topic, source_peer_id: String, payload: Vec<u8>) -> Self {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut hasher = Sha256::new();
        hasher.update(topic.0.as_bytes());
        hasher.update(source_peer_id.as_bytes());
        hasher.update(&ts.to_be_bytes());
        hasher.update(&payload);
        let msg_id = hex::encode(hasher.finalize());

        Self {
            msg_id,
            topic,
            source_peer_id,
            timestamp_utc: ts,
            payload,
            signature: None,
        }
    }
}

pub struct GossipSubEngine {
    local_peer_id: String,
    subscribed_topics: HashSet<Topic>,
    seen_messages: HashSet<String>,
    seen_fifo: VecDeque<String>,
    cache_capacity: usize,
    pub mesh_peers: HashSet<String>,
}

impl GossipSubEngine {
    pub const DEFAULT_CACHE_CAPACITY: usize = 10_000;

    pub fn new(local_peer_id: String) -> Self {
        let mut engine = Self {
            local_peer_id,
            subscribed_topics: HashSet::new(),
            seen_messages: HashSet::new(),
            seen_fifo: VecDeque::new(),
            cache_capacity: Self::DEFAULT_CACHE_CAPACITY,
            mesh_peers: HashSet::new(),
        };

        // Subscribe to default protocol topics
        engine.subscribe(Topic::new(Topic::ANNOUNCEMENTS));
        engine.subscribe(Topic::new(Topic::POR_AUDIT));
        engine.subscribe(Topic::new(Topic::EMERGENCY_BEACON));
        engine
    }

    pub fn subscribe(&mut self, topic: Topic) {
        self.subscribed_topics.insert(topic);
    }

    pub fn unsubscribe(&mut self, topic: &Topic) {
        self.subscribed_topics.remove(topic);
    }

    pub fn is_subscribed(&self, topic: &Topic) -> bool {
        self.subscribed_topics.contains(topic)
    }

    pub fn add_mesh_peer(&mut self, peer_id: String) {
        self.mesh_peers.insert(peer_id);
    }

    pub fn remove_mesh_peer(&mut self, peer_id: &str) {
        self.mesh_peers.remove(peer_id);
    }

    /// Publishes a message to a topic. Returns the generated message if subscribed.
    pub fn publish(&mut self, topic: Topic, payload: Vec<u8>) -> Result<GossipMessage> {
        if !self.is_subscribed(&topic) {
            return Err(NexxusError::NetworkError(format!(
                "Cannot publish to unsubscribed topic: {}",
                topic.0
            )));
        }

        let msg = GossipMessage::new(topic, self.local_peer_id.clone(), payload);
        self.mark_seen(&msg.msg_id);
        Ok(msg)
    }

    /// Broadcasts a high-priority Emergency Radio Beacon across the network
    pub fn broadcast_emergency_beacon(&mut self, reason: &str, coordinates: Option<&str>) -> Result<GossipMessage> {
        let payload_json = serde_json::json!({
            "beacon_type": "OFFGRID_EMERGENCY_RADIO",
            "reason": reason,
            "coordinates": coordinates.unwrap_or("UNKNOWN"),
            "sender": self.local_peer_id,
            "priority": "CRITICAL"
        });

        let payload_bytes = serde_json::to_vec(&payload_json)
            .map_err(|e| NexxusError::NetworkError(e.to_string()))?;

        self.publish(Topic::new(Topic::EMERGENCY_BEACON), payload_bytes)
    }

    /// Receives an incoming gossip message, deduplicates, and checks topic subscription
    pub fn on_incoming_message(&mut self, msg: GossipMessage) -> Option<GossipMessage> {
        if self.seen_messages.contains(&msg.msg_id) {
            return None; // Duplicate dropped
        }

        self.mark_seen(&msg.msg_id);

        if self.is_subscribed(&msg.topic) {
            Some(msg)
        } else {
            None
        }
    }

    fn mark_seen(&mut self, msg_id: &str) {
        if self.seen_messages.len() >= self.cache_capacity {
            if let Some(oldest) = self.seen_fifo.pop_front() {
                self.seen_messages.remove(&oldest);
            }
        }
        self.seen_messages.insert(msg_id.to_string());
        self.seen_fifo.push_back(msg_id.to_string());
    }

    pub fn deduplication_cache_size(&self) -> usize {
        self.seen_messages.len()
    }
}
