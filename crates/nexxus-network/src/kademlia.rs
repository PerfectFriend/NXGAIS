// [SIM] PLACEHOLDER — In-Memory Kademlia Routing Table Data Structure.
// Audit ID: NET-KAD-01 (Grok Audit #3).
// ATTENTION: This module implements the in-memory 256-bit XOR metric distance routing table
// with k-buckets (k=20, alpha=3). It does NOT currently implement network RPC calls
// (FIND_NODE, FIND_VALUE, STORE) or iterative network lookups.

use nexxus_core::{NexxusError, Result};
use sha2::{Digest, Sha256};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
pub struct NodeId(pub [u8; 32]);

impl NodeId {
    pub fn from_pubkey(pubkey: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(b"NEXXUS_KAD_NODE_ID");
        hasher.update(pubkey);
        let res = hasher.finalize();
        let mut id = [0u8; 32];
        id.copy_from_slice(&res);
        Self(id)
    }

    pub fn from_hex(hex_str: &str) -> Result<Self> {
        let bytes = hex::decode(hex_str).map_err(|e| NexxusError::NetworkError(e.to_string()))?;
        if bytes.len() != 32 {
            return Err(NexxusError::NetworkError("NodeId must be 32 bytes".into()));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    /// Computes XOR metric distance between two NodeIds
    pub fn xor_distance(&self, other: &NodeId) -> [u8; 32] {
        let mut dist = [0u8; 32];
        for i in 0..32 {
            dist[i] = self.0[i] ^ other.0[i];
        }
        dist
    }

    /// Returns index of the first non-zero bit in XOR distance (0..255)
    pub fn distance_bucket_index(&self, other: &NodeId) -> usize {
        let dist = self.xor_distance(other);
        for (byte_idx, &b) in dist.iter().enumerate() {
            if b != 0 {
                let leading_zeros = b.leading_zeros() as usize;
                return byte_idx * 8 + leading_zeros;
            }
        }
        255
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KadPeerInfo {
    pub node_id: NodeId,
    pub onion_address: String,
    pub listen_port: u16,
    pub asn: u32,
    #[serde(skip)]
    pub last_seen: Option<Instant>,
}

pub struct KBucket {
    pub peers: Vec<KadPeerInfo>,
    pub capacity: usize,
}

impl KBucket {
    pub const DEFAULT_K: usize = 20;

    pub fn new() -> Self {
        Self {
            peers: Vec::with_capacity(Self::DEFAULT_K),
            capacity: Self::DEFAULT_K,
        }
    }

    pub fn insert_or_update(&mut self, peer: KadPeerInfo) {
        if let Some(pos) = self.peers.iter().position(|p| p.node_id == peer.node_id) {
            self.peers.remove(pos);
            self.peers.push(peer);
        } else if self.peers.len() < self.capacity {
            self.peers.push(peer);
        } else {
            // Evict oldest if capacity exceeded
            self.peers.remove(0);
            self.peers.push(peer);
        }
    }

    pub fn remove(&mut self, node_id: &NodeId) {
        self.peers.retain(|p| p.node_id != *node_id);
    }
}

pub struct RoutingTable {
    local_id: NodeId,
    buckets: Vec<KBucket>,
}

impl RoutingTable {
    pub fn new(local_id: NodeId) -> Self {
        let mut buckets = Vec::with_capacity(256);
        for _ in 0..256 {
            buckets.push(KBucket::new());
        }
        Self { local_id, buckets }
    }

    pub fn local_id(&self) -> &NodeId {
        &self.local_id
    }

    pub fn update(&mut self, peer: KadPeerInfo) {
        if peer.node_id == self.local_id {
            return;
        }
        let bucket_idx = self.local_id.distance_bucket_index(&peer.node_id);
        if bucket_idx < 256 {
            self.buckets[bucket_idx].insert_or_update(peer);
        }
    }

    pub fn remove(&mut self, node_id: &NodeId) {
        let bucket_idx = self.local_id.distance_bucket_index(node_id);
        if bucket_idx < 256 {
            self.buckets[bucket_idx].remove(node_id);
        }
    }

    /// Finds the `count` closest peers to a target ID by XOR metric
    pub fn find_closest(&self, target: &NodeId, count: usize) -> Vec<KadPeerInfo> {
        let mut all_peers: Vec<KadPeerInfo> = Vec::new();
        for bucket in &self.buckets {
            all_peers.extend(bucket.peers.iter().cloned());
        }

        all_peers.sort_by(|a, b| {
            let dist_a = a.node_id.xor_distance(target);
            let dist_b = b.node_id.xor_distance(target);
            dist_a.cmp(&dist_b)
        });

        all_peers.truncate(count);
        all_peers
    }

    pub fn total_peer_count(&self) -> usize {
        self.buckets.iter().map(|b| b.peers.len()).sum()
    }
}
