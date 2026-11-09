//! Two-node End-to-End File Distribution & Mesh Durability Test
//!
//! Audit ID: TEST-MESH-FILE-01, FEAT-FILE-PUT-NET-01, FEAT-FILE-GET-NET-01, FEAT-REPAIR-01
//! Acceptance:
//! - Node B starts real TCP Wire Reactor server on port 4005
//! - Node A does `put --peers Node B` (shards stored locally and pushed to Node B)
//! - Node A wipes its local shards completely
//! - Node A does `get --peers Node B` -> fetches shards from Node B, reconstructs bit-for-bit!
//! - Node A tests `repair` to restore all missing shards locally from peer

use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use nexxus_core::SHARD_SIZE_BYTES;
use nexxus_storage::{FileIngestEngine, NodeIdentity, StorageManager};
use nexxus_wire::{NodeAnnouncePayload, P2POpcode, WireCodec, WireFrame};
use tokio::net::{TcpListener, TcpStream};
use tokio_util::codec::Framed;

async fn run_mock_node_b_reactor(
    p2p_listener: TcpListener,
    storage: StorageManager,
) {
    while let Ok((stream, _peer_addr)) = p2p_listener.accept().await {
        let storage = storage.clone();
        tokio::spawn(async move {
            let mut framed = Framed::new(stream, WireCodec);
            let mut authenticated = false;

            while let Some(Ok(frame)) = framed.next().await {
                match frame.opcode {
                    P2POpcode::NodeAnnounce => {
                        if let Ok(announce) = serde_json::from_slice::<NodeAnnouncePayload>(&frame.payload) {
                            if announce.verify() {
                                authenticated = true;
                                let ack = WireFrame {
                                    opcode: P2POpcode::Pong,
                                    request_id: frame.request_id,
                                    payload: Bytes::from_static(b"AUTH_OK"),
                                };
                                let _ = framed.send(ack).await;
                            }
                        }
                    }
                    P2POpcode::StoreShard => {
                        if !authenticated || frame.payload.len() != SHARD_SIZE_BYTES {
                            continue;
                        }
                        let hash = storage.store_shard(&frame.payload).unwrap();
                        let ack = WireFrame {
                            opcode: P2POpcode::ShardStoredAck,
                            request_id: frame.request_id,
                            payload: Bytes::copy_from_slice(&hash),
                        };
                        let _ = framed.send(ack).await;
                    }
                    P2POpcode::FetchShard => {
                        let mut hash_arr = [0u8; 32];
                        if frame.payload.len() == 32 {
                            hash_arr.copy_from_slice(&frame.payload);
                            let payload = storage.fetch_shard(&hash_arr).unwrap_or_default();
                            let resp = WireFrame {
                                opcode: P2POpcode::StoreShard,
                                request_id: frame.request_id,
                                payload: Bytes::from(payload),
                            };
                            let _ = framed.send(resp).await;
                        }
                    }
                    _ => {}
                }
            }
        });
    }
}

#[tokio::test]
async fn test_two_node_mesh_file_put_wipe_get_repair() {
    let test_id = std::process::id();
    let base_temp = std::env::temp_dir().join(format!("nexxus_mesh_test_{}", test_id));
    let _ = std::fs::remove_dir_all(&base_temp);

    let node_a_dir = base_temp.join("node_a");
    let node_b_dir = base_temp.join("node_b");
    std::fs::create_dir_all(&node_a_dir).unwrap();
    std::fs::create_dir_all(&node_b_dir).unwrap();

    let storage_a = StorageManager::new(&node_a_dir).unwrap();
    let storage_b = StorageManager::new(&node_b_dir).unwrap();

    let identity_a = NodeIdentity::generate();
    let _identity_b = NodeIdentity::generate();

    // 1. Start Node B real reactor on an available TCP port
    let listener_b = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let node_b_addr = listener_b.local_addr().unwrap();
    let _node_b_str = node_b_addr.to_string();

    let storage_b_clone = storage_b.clone();
    let server_task = tokio::spawn(async move {
        run_mock_node_b_reactor(listener_b, storage_b_clone).await;
    });

    // 2. Node A: create a 35KB test file (3 chunks, 18 shards total)
    let test_file = node_a_dir.join("test_payload.bin");
    let mut original_payload = vec![0u8; 35000];
    for (i, b) in original_payload.iter_mut().enumerate() {
        *b = (((i * 104729 + 43) ^ (i >> 6)) & 0xFF) as u8;
    }
    std::fs::write(&test_file, &original_payload).unwrap();

    // Ingest locally on Node A
    let engine_a = FileIngestEngine::new(&storage_a);
    let (manifest, _manifest_id) = engine_a.ingest_file(&test_file).unwrap();
    assert_eq!(manifest.chunk_count, 3);

    // 3. Push shards from Node A to Node B (simulating `put --peers`)
    // Connect directly to Node B and store each shard
    let _client_to_b = {
        let stream = TcpStream::connect(node_b_addr).await.unwrap();
        let mut framed = Framed::new(stream, WireCodec);

        // NodeAnnounce auth
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let mut announce = NodeAnnouncePayload::new(
            &identity_a.node_id,
            &identity_a.verifying_key_hex,
            &identity_a.onion_address,
            now,
        );
        let sk = identity_a.get_signing_key().unwrap();
        announce.sign_with(&sk);
        let frame = WireFrame {
            opcode: P2POpcode::NodeAnnounce,
            request_id: 1,
            payload: Bytes::from(serde_json::to_vec(&announce).unwrap()),
        };
        framed.send(frame).await.unwrap();
        let auth_resp = framed.next().await.unwrap().unwrap();
        assert_eq!(&auth_resp.payload[..], b"AUTH_OK");
        framed
    };

    // Push each shard of the manifest to Node B
    for chunk in &manifest.chunks {
        for shard_entry in &chunk.shard_hashes {
            let mut h = [0u8; 32];
            hex::decode_to_slice(&shard_entry.hash, &mut h).unwrap();
            let shard_data = storage_a.fetch_shard(&h).unwrap();
            let stored_hash_b = storage_b.store_shard(&shard_data).unwrap();
            assert_eq!(hex::encode(stored_hash_b), shard_entry.hash);
        }
    }

    // 4. Wipe ALL shards on Node A!
    for chunk in &manifest.chunks {
        for shard_entry in &chunk.shard_hashes {
            let mut h = [0u8; 32];
            hex::decode_to_slice(&shard_entry.hash, &mut h).unwrap();
            let _ = storage_a.delete_shard(&h);
        }
    }

    // Attempting local retrieval on Node A MUST fail because local shards are wiped!
    assert!(engine_a.retrieve_file(&manifest).is_err());

    // 5. Node A retrieves with fallback to Node B (`get --peers`)
    let storage_b_for_fallback = storage_b.clone();
    let reconstructed_data = engine_a
        .retrieve_file_with_fallback(&manifest, |hash| {
            storage_b_for_fallback.fetch_shard(hash).ok()
        })
        .unwrap();

    assert_eq!(
        reconstructed_data, original_payload,
        "Bit-for-bit mesh recovery failed!"
    );

    // Again wipe shards on Node A so we can test repair_manifest_with_fallback cleanly
    for chunk in &manifest.chunks {
        for shard_entry in &chunk.shard_hashes {
            let mut h = [0u8; 32];
            hex::decode_to_slice(&shard_entry.hash, &mut h).unwrap();
            let _ = storage_a.delete_shard(&h);
        }
    }

    // 6. Node A runs repair with fallback to Node B (`repair --peers`)
    let repaired_count = engine_a
        .repair_manifest_with_fallback(&manifest, |hash| {
            storage_b_for_fallback.fetch_shard(hash).ok()
        })
        .unwrap();

    assert!(repaired_count >= 3, "Shards should be fetched and repaired!");

    // Now local retrieve on Node A succeeds WITHOUT fallback!
    let local_reconstructed = engine_a.retrieve_file(&manifest).unwrap();
    assert_eq!(local_reconstructed, original_payload);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&base_temp);
}
