//! Network Evolution Test Suite
//!
//! Verifies:
//! - Phase 3.1: Kademlia DHT 256-bit XOR metric distance and closest-peer search
//! - Phase 3.1: Gossipsub v1.2 topic routing and message deduplication
//! - Phase 3.1: Emergency Radio Beacon broadcast and parsing
//! - Phase 3.2: Arti Tor v3 Onion address and circuit initialization

use nexxus_network::{
    ArtiTorManager, GossipSubEngine, KadPeerInfo, NodeId, RoutingTable, Topic,
    TorBackendMode,
};

#[test]
fn test_kademlia_routing_and_closest_peers() {
    let local_id = NodeId([0x10; 32]);
    let mut table = RoutingTable::new(local_id);

    let peer1 = KadPeerInfo {
        node_id: NodeId([0x10; 32]), // Same (should be ignored)
        onion_address: "local.onion".into(),
        listen_port: 8080,
        asn: 100,
        last_seen: None,
    };
    table.update(peer1);
    assert_eq!(table.total_peer_count(), 0);

    let peer2 = KadPeerInfo {
        node_id: NodeId([0x11; 32]), // Very close
        onion_address: "peer2.onion".into(),
        listen_port: 8080,
        asn: 200,
        last_seen: None,
    };
    let peer3 = KadPeerInfo {
        node_id: NodeId([0xFE; 32]), // Very far
        onion_address: "peer3.onion".into(),
        listen_port: 8080,
        asn: 300,
        last_seen: None,
    };

    table.update(peer2.clone());
    table.update(peer3.clone());
    assert_eq!(table.total_peer_count(), 2);

    let target = NodeId([0x12; 32]);
    let closest = table.find_closest(&target, 1);
    assert_eq!(closest.len(), 1);
    assert_eq!(closest[0].node_id, peer2.node_id);
}

#[test]
fn test_gossipsub_pubsub_deduplication_and_emergency_beacon() {
    let mut engine = GossipSubEngine::new("local_node_alpha".into());

    // Test publication to subscribed topic
    let msg = engine
        .publish(Topic::new(Topic::ANNOUNCEMENTS), b"HELLO_NEXXUS_MESH".to_vec())
        .expect("Publication must succeed");

    assert_eq!(msg.topic.0, Topic::ANNOUNCEMENTS);

    // Incoming duplicate must be dropped
    let duplicate_result = engine.on_incoming_message(msg.clone());
    assert!(duplicate_result.is_none(), "Duplicate message must be dropped by deduplicator");

    // Test emergency radio beacon
    let beacon = engine
        .broadcast_emergency_beacon("POWER_GRID_OUTAGE_SOLAR_BACKUP_ENGAGED", Some("52.5200,13.4050"))
        .expect("Emergency beacon broadcast must succeed");

    assert_eq!(beacon.topic.0, Topic::EMERGENCY_BEACON);
    let payload_str = String::from_utf8(beacon.payload).unwrap();
    assert!(payload_str.contains("OFFGRID_EMERGENCY_RADIO"));
    assert!(payload_str.contains("POWER_GRID_OUTAGE"));
}

#[test]
fn test_arti_tor_onion_initialization() {
    let pubkey = [0x55u8; 32];
    let arti = ArtiTorManager::new(&pubkey, true).expect("Arti init must succeed");

    assert_eq!(arti.backend_mode(), TorBackendMode::EmbeddedArti);
    assert!(arti.onion_address().ends_with(".onion"));
    assert_eq!(arti.onion_address().len(), 62); // 56 base32 chars + ".onion" (6 chars) = 62 chars

    let status = arti.status();
    assert!(status.is_bootstrapped);
    assert_eq!(status.bootstrap_percentage, 100);
    assert!(status.active_circuits >= 3);

    let new_circ = arti.build_circuit().unwrap();
    assert!(new_circ > 3);
}
