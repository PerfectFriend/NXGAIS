//! Storage Engine Evolution Test Suite
//!
//! Verifies:
//! - Phase 2.1: IoRingEngine batch submission and latency tracking
//! - Phase 2.2: DirectBlockDevice O_DIRECT / Aligned DMA I/O operations
//! - Phase 5.1: Mesh Self-Healing and ASN HHI diversity routing
//! - Phase 5.2: ZK-PoR non-interactive Zero-Knowledge proof generation and verification

use nexxus_core::CHUNK_SIZE_BYTES;
use nexxus_crypto::{encode_reed_solomon, Shard};
use nexxus_storage::{
    AlignedBlockBuffer, DirectBlockDevice, IoRingEngine, MeshSelfHealingEngine,
    PeerNodeCandidate, ZkPorEngine, SECTOR_SIZE_BYTES,
};

#[test]
fn test_direct_block_device_and_ring_submission() {
    let tmp_dir = std::env::temp_dir().join(format!("nexxus_test_{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp_dir);
    let file_path = tmp_dir.join("direct_block_test.sec");

    // Open direct block device
    let device = DirectBlockDevice::open(&file_path, Some(65536)).expect("Must open block device");

    // Prepare aligned buffer
    let mut write_buf = AlignedBlockBuffer::new(4096);
    write_buf.as_mut_slice().fill(0x5A);

    // Test direct write
    let written = device.write_block(0, &write_buf).expect("Direct write must succeed");
    assert_eq!(written, 4096);

    // Test direct read
    let mut read_buf = AlignedBlockBuffer::new(4096);
    let read = device.read_block(0, &mut read_buf).expect("Direct read must succeed");
    assert_eq!(read, 4096);
    assert_eq!(read_buf.as_slice(), write_buf.as_slice());

    // Test IoRingEngine batch execution
    let mut ring = IoRingEngine::new(64);
    ring.prep_write(1, 4096, vec![0xBB; 4096]).expect("Prep write");
    ring.prep_read(2, 4096, 4096).expect("Prep read");

    let cqes = ring.submit_and_wait(&device);
    assert_eq!(cqes.len(), 2);
    assert!(cqes[0].success);
    assert!(cqes[1].success);
    assert!(ring.average_latency_micros() > 0.0);

    let _ = std::fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_mesh_self_healing_and_asn_diversity_routing() {
    let peers = vec![
        PeerNodeCandidate {
            peer_id: "node_fra_01".into(),
            onion_address: "nexxusnode1fra.onion".into(),
            asn: 13335, // Cloudflare
            latency_ms: 12.0,
            storage_free_gb: 120,
        },
        PeerNodeCandidate {
            peer_id: "node_hel_02".into(),
            onion_address: "nexxusnode2hel.onion".into(),
            asn: 24940, // Hetzner
            latency_ms: 18.0,
            storage_free_gb: 90,
        },
        PeerNodeCandidate {
            peer_id: "node_tokyo_03".into(),
            onion_address: "nexxusnode3tyo.onion".into(),
            asn: 2516, // KDDI
            latency_ms: 85.0,
            storage_free_gb: 300,
        },
    ];

    let engine = MeshSelfHealingEngine::new(peers.clone());

    // Current replica set has two nodes on Hetzner (ASN 24940)
    let current_replicas = vec![
        PeerNodeCandidate {
            peer_id: "existing_01".into(),
            onion_address: "node_ex1.onion".into(),
            asn: 24940,
            latency_ms: 15.0,
            storage_free_gb: 50,
        },
        PeerNodeCandidate {
            peer_id: "existing_02".into(),
            onion_address: "node_ex2.onion".into(),
            asn: 24940,
            latency_ms: 16.0,
            storage_free_gb: 50,
        },
    ];

    // Engine should pick node_fra_01 or node_tokyo_03 to reduce ASN concentration HHI
    let optimal = engine.select_optimal_asn_peer(&current_replicas).unwrap();
    assert_ne!(optimal.asn, 24940, "Engine must not pick existing congested ASN");

    // Test automatic reconstruction of degraded chunk (4 available out of 6)
    let original_data = vec![0x42u8; CHUNK_SIZE_BYTES];
    let all_shards = encode_reed_solomon(&original_data).unwrap();

    // Simulate losing shards 1 and 4
    let degraded_shards: Vec<Shard> = all_shards
        .into_iter()
        .filter(|s| s.index != 1 && s.index != 4)
        .collect();
    assert_eq!(degraded_shards.len(), 4);

    let healing_event = engine
        .inspect_and_heal("chunk_alpha_001", &degraded_shards, &current_replicas)
        .unwrap()
        .expect("Healing event must trigger");

    assert_eq!(healing_event.reconstructed_count, 2);
    assert_eq!(healing_event.missing_shard_indices, vec![1, 4]);
    assert!(healing_event.asn_hhi_after < healing_event.asn_hhi_before);
}

#[test]
fn test_zk_por_proof_generation_and_verification() {
    let sector = vec![0x33u8; SECTOR_SIZE_BYTES];
    let challenge_seed = [0x77u8; 32];
    let sector_idx = 14u32;

    // Prover generates ZK proof
    let proof = ZkPorEngine::generate_zk_proof(&sector, sector_idx, &challenge_seed, "node_prover_01")
        .expect("Proof generation must succeed");

    assert_eq!(proof.sector_index, 14);
    assert_eq!(proof.response_mask.len(), SECTOR_SIZE_BYTES);

    // Verifier checks valid proof
    let is_valid = ZkPorEngine::verify_zk_proof(&proof, &challenge_seed, &proof.commitment_hash);
    assert!(is_valid, "Valid ZK proof must verify successfully");

    // Verifier rejects corrupted challenge seed
    let bad_seed = [0x88u8; 32];
    let is_bad_seed_valid = ZkPorEngine::verify_zk_proof(&proof, &bad_seed, &proof.commitment_hash);
    assert!(!is_bad_seed_valid, "Corrupted challenge seed must be rejected");

    // Verifier rejects corrupted commitment hash
    let bad_commitment = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    let is_bad_commit_valid = ZkPorEngine::verify_zk_proof(&proof, &challenge_seed, bad_commitment);
    assert!(!is_bad_commit_valid, "Forged commitment hash must be rejected");
}
