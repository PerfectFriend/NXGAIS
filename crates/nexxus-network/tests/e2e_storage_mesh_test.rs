//! End-to-End Multi-Node Storage-Backed P2P Mesh Integration Test
//! Audit ID: SEC-AUTH-01, SEC-VOUCHER-01, SEC-IDENTITY-01, OPCODE-SIZE-01, E2E-STORE-01, E2E-FETCH-01, E2E-POR-01, E2E-DEPIN-01, E2E-MESH-01
//!
//! Validates:
//! 1. Real TCP inter-node communication between Node A and Node B.
//! 2. Node Identity load-or-create persistence (node_identity.json).
//! 3. Cryptographic session authentication via NodeAnnounce with Ed25519 signatures.
//! 4. Rejection of unauthenticated StoreChunk and Voucher requests.
//! 5. Strict 16 KB chunk size verification and garbage rejection (OPCODE-SIZE-01).
//! 6. Comprehensive wire voucher validation (unknown channel, bad signature, stale sequence, valid settlement).
//! 7. Storage-backed StoreChunk and bit-for-bit FetchChunk.
//! 8. Hardware-accelerated PoR challenge against real stored chunks on disk.

use bytes::Bytes;
use ed25519_dalek::SigningKey;
use futures_util::{SinkExt, StreamExt};
use nexxus_core::{sha256_digest, CHUNK_SIZE_BYTES};
use nexxus_storage::{
    DePinBarterEngine, NodeIdentity, SignedChannelCommitment, StorageManager, TransferDirection,
};
use nexxus_wire::{NodeAnnouncePayload, P2POpcode, WireCodec, WireFrame};
use rand::rngs::OsRng;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_util::codec::Framed;

/// Runs a real production-hardened storage-backed P2P node reactor
async fn run_storage_p2p_node(
    listener: TcpListener,
    storage: StorageManager,
    depin: Arc<Mutex<DePinBarterEngine>>,
    depin_path: PathBuf,
    _identity: NodeIdentity,
) {
    while let Ok((stream, peer_addr)) = listener.accept().await {
        let storage = storage.clone();
        let depin = depin.clone();
        let depin_path = depin_path.clone();

        tokio::spawn(async move {
            let mut framed = Framed::new(stream, WireCodec);
            let mut authenticated_peer: Option<NodeAnnouncePayload> = None;

            while let Some(Ok(frame)) = framed.next().await {
                match frame.opcode {
                    P2POpcode::Ping => {
                        let pong = WireFrame {
                            opcode: P2POpcode::Pong,
                            request_id: frame.request_id,
                            payload: frame.payload,
                        };
                        let _ = framed.send(pong).await;
                    }
                    P2POpcode::NodeAnnounce => {
                        // Audit ID: SEC-AUTH-01
                        match serde_json::from_slice::<NodeAnnouncePayload>(&frame.payload) {
                            Ok(announce) if announce.verify() => {
                                authenticated_peer = Some(announce);
                                let ack = WireFrame {
                                    opcode: P2POpcode::Pong,
                                    request_id: frame.request_id,
                                    payload: Bytes::from_static(b"AUTH_OK"),
                                };
                                let _ = framed.send(ack).await;
                            }
                            _ => {
                                let ack = WireFrame {
                                    opcode: P2POpcode::Pong,
                                    request_id: frame.request_id,
                                    payload: Bytes::from_static(b"AUTH_FAILED"),
                                };
                                let _ = framed.send(ack).await;
                            }
                        }
                    }
                    P2POpcode::StoreChunk => {
                        // Audit ID: SEC-AUTH-01 — Enforce auth
                        if authenticated_peer.is_none() {
                            let ack = WireFrame {
                                opcode: P2POpcode::ChunkStoredAck,
                                request_id: frame.request_id,
                                payload: Bytes::from_static(b"AUTH_REQUIRED"),
                            };
                            let _ = framed.send(ack).await;
                            continue;
                        }

                        // Audit ID: OPCODE-SIZE-01 — Strict 16KB chunk size check
                        if frame.payload.len() != CHUNK_SIZE_BYTES {
                            let ack = WireFrame {
                                opcode: P2POpcode::ChunkStoredAck,
                                request_id: frame.request_id,
                                payload: Bytes::from_static(b"INVALID_CHUNK_SIZE"),
                            };
                            let _ = framed.send(ack).await;
                            continue;
                        }

                        // Save 16KB chunk to disk
                        let hash = storage
                            .store_chunk(&frame.payload)
                            .expect("Store chunk to disk failed");

                        // Record in DePIN ledger
                        {
                            let mut eng = depin.lock().await;
                            eng.record_chunk_io(
                                &peer_addr.to_string(),
                                TransferDirection::IncomingFromPeer,
                            );
                            let _ = eng.save_to_disk(&depin_path);
                        }

                        let ack = WireFrame {
                            opcode: P2POpcode::ChunkStoredAck,
                            request_id: frame.request_id,
                            payload: Bytes::copy_from_slice(&hash),
                        };
                        let _ = framed.send(ack).await;
                    }
                    P2POpcode::FetchChunk => {
                        // Read real bytes from disk
                        let mut hash = [0u8; 32];
                        hash.copy_from_slice(&frame.payload[0..32]);
                        let chunk = storage
                            .fetch_chunk(&hash)
                            .expect("Fetch chunk from disk failed");

                        // Record in DePIN ledger
                        {
                            let mut eng = depin.lock().await;
                            eng.record_chunk_io(
                                &peer_addr.to_string(),
                                TransferDirection::OutgoingToPeer,
                            );
                            let _ = eng.save_to_disk(&depin_path);
                        }

                        let resp = WireFrame {
                            opcode: P2POpcode::StoreChunk,
                            request_id: frame.request_id,
                            payload: Bytes::from(chunk),
                        };
                        let _ = framed.send(resp).await;
                    }
                    P2POpcode::PorChallenge => {
                        // Real PoR audit on stored chunk
                        let mut chunk_hash = [0u8; 32];
                        chunk_hash.copy_from_slice(&frame.payload[0..32]);
                        let mut sec_bytes = [0u8; 4];
                        sec_bytes.copy_from_slice(&frame.payload[32..36]);
                        let sector_idx = u32::from_be_bytes(sec_bytes) as usize;

                        let por_resp = storage
                            .evaluate_stored_chunk_por(&chunk_hash, sector_idx)
                            .expect("PoR evaluation failed");

                        let root_bytes = hex::decode(&por_resp.merkle_root)
                            .expect("Valid hex merkle root");

                        let resp = WireFrame {
                            opcode: P2POpcode::PorResponse,
                            request_id: frame.request_id,
                            payload: Bytes::from(root_bytes),
                        };
                        let _ = framed.send(resp).await;
                    }
                    P2POpcode::StateChannelVoucher => {
                        // Audit ID: SEC-AUTH-01 — Enforce auth
                        if authenticated_peer.is_none() {
                            let ack = WireFrame {
                                opcode: P2POpcode::ChunkStoredAck,
                                request_id: frame.request_id,
                                payload: Bytes::from_static(b"AUTH_REQUIRED"),
                            };
                            let _ = framed.send(ack).await;
                            continue;
                        }

                        // Audit ID: SEC-VOUCHER-01 — Cryptographic validation
                        let ack_status = {
                            let mut eng = depin.lock().await;
                            match serde_json::from_slice::<SignedChannelCommitment>(&frame.payload) {
                                Ok(commitment) => {
                                    match eng.verify_and_apply_voucher(&commitment) {
                                        Ok(status) => {
                                            let _ = eng.save_to_disk(&depin_path);
                                            status
                                        }
                                        Err(err) => err,
                                    }
                                }
                                Err(_) => "VOUCHER_MALFORMED_PAYLOAD",
                            }
                        };

                        let ack = WireFrame {
                            opcode: P2POpcode::ChunkStoredAck,
                            request_id: frame.request_id,
                            payload: Bytes::from_static(ack_status.as_bytes()),
                        };
                        let _ = framed.send(ack).await;
                    }
                    _ => {}
                }
            }
        });
    }
}

#[tokio::test]
async fn test_production_hardened_e2e_mesh() {
    let test_run_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let dir_b = std::env::temp_dir().join(format!("nexxus_node_b_{}", test_run_id));
    let storage_b = StorageManager::new(&dir_b).expect("Init StorageManager B");
    let depin_file_b = dir_b.join("depin_state.json");
    let depin_b = Arc::new(Mutex::new(DePinBarterEngine::new()));

    // Audit ID: SEC-IDENTITY-01 — Node Identity persistence
    let identity_file_b = dir_b.join("node_identity.json");
    let identity_b = NodeIdentity::load_or_create(&identity_file_b).expect("Load Node Identity B");
    assert!(identity_b.node_id.starts_with("nx_node_"));
    assert!(identity_file_b.exists());

    // Client Node A Identity
    let mut csprng = OsRng;
    let key_a = SigningKey::generate(&mut csprng);
    let identity_a = NodeIdentity::from_signing_key(key_a);

    // 1. Start Node B listener on ephemeral OS TCP port
    let listener_b = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Bind Node B listener");
    let addr_b: SocketAddr = listener_b.local_addr().expect("Node B local addr");

    tokio::spawn(run_storage_p2p_node(
        listener_b,
        storage_b.clone(),
        depin_b.clone(),
        depin_file_b.clone(),
        identity_b.clone(),
    ));

    // 2. Connect Node A client to Node B
    let client_stream = TcpStream::connect(addr_b)
        .await
        .expect("Connect to Node B");
    let mut client = Framed::new(client_stream, WireCodec);

    // =========================================================================
    // Test 1: SEC-AUTH-01 — Unauthenticated StoreChunk must be rejected
    // =========================================================================
    let dummy_chunk = vec![0x11u8; CHUNK_SIZE_BYTES];
    let unauth_store = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 1,
        payload: Bytes::copy_from_slice(&dummy_chunk),
    };
    client.send(unauth_store).await.unwrap();
    let unauth_resp = client.next().await.unwrap().unwrap();
    assert_eq!(unauth_resp.opcode, P2POpcode::ChunkStoredAck);
    assert_eq!(&unauth_resp.payload[..], b"AUTH_REQUIRED");

    // =========================================================================
    // Test 2: SEC-AUTH-01 — Invalid handshake signature must fail
    // =========================================================================
    let bad_announce = NodeAnnouncePayload {
        node_id: identity_a.node_id.clone(),
        verifying_key_hex: identity_a.verifying_key_hex.clone(),
        onion_address: identity_a.onion_address.clone(),
        timestamp_unix: 1700000000,
        signature_hex: hex::encode([0xEEu8; 64]), // Invalid forged signature
    };
    let bad_auth_frame = WireFrame {
        opcode: P2POpcode::NodeAnnounce,
        request_id: 2,
        payload: Bytes::from(serde_json::to_vec(&bad_announce).unwrap()),
    };
    client.send(bad_auth_frame).await.unwrap();
    let bad_auth_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&bad_auth_resp.payload[..], b"AUTH_FAILED");

    // =========================================================================
    // Test 3: SEC-AUTH-01 — Valid NodeAnnounce handshake completes session auth
    // =========================================================================
    let mut valid_announce = NodeAnnouncePayload::new(
        &identity_a.node_id,
        &identity_a.verifying_key_hex,
        &identity_a.onion_address,
        1700000000,
    );
    let sk_a = identity_a.get_signing_key().unwrap();
    valid_announce.sign_with(&sk_a);

    let auth_frame = WireFrame {
        opcode: P2POpcode::NodeAnnounce,
        request_id: 3,
        payload: Bytes::from(serde_json::to_vec(&valid_announce).unwrap()),
    };
    client.send(auth_frame).await.unwrap();
    let auth_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&auth_resp.payload[..], b"AUTH_OK");

    // =========================================================================
    // Test 4: OPCODE-SIZE-01 — Reject garbage-sized chunks (!= 16384 bytes)
    // =========================================================================
    let garbage_chunk = vec![0xFFu8; 1000]; // Not 16KB
    let garbage_frame = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 4,
        payload: Bytes::from(garbage_chunk),
    };
    client.send(garbage_frame).await.unwrap();
    let garbage_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&garbage_resp.payload[..], b"INVALID_CHUNK_SIZE");

    // =========================================================================
    // Test 5: E2E-STORE-01 & E2E-FETCH-01 — Authenticated Store and Fetch 16KB
    // =========================================================================
    let mut real_chunk = vec![0u8; CHUNK_SIZE_BYTES];
    for (i, b) in real_chunk.iter_mut().enumerate() {
        *b = ((i * 47 + 23) & 0xFF) as u8;
    }
    let expected_hash = sha256_digest(&real_chunk);

    let store_frame = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 5,
        payload: Bytes::copy_from_slice(&real_chunk),
    };
    client.send(store_frame).await.unwrap();
    let store_ack = client.next().await.unwrap().unwrap();
    assert_eq!(&store_ack.payload[..], &expected_hash[..]);
    assert!(storage_b.has_chunk(&expected_hash));

    // Fetch chunk and verify bit-for-bit equivalence
    let fetch_frame = WireFrame {
        opcode: P2POpcode::FetchChunk,
        request_id: 6,
        payload: Bytes::copy_from_slice(&expected_hash),
    };
    client.send(fetch_frame).await.unwrap();
    let fetch_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&fetch_resp.payload[..], &real_chunk[..]);

    // =========================================================================
    // Test 6: E2E-POR-01 — Authentic PoR audit against disk chunk
    // =========================================================================
    let challenge_sector = 11usize;
    let mut por_payload = Vec::with_capacity(36);
    por_payload.extend_from_slice(&expected_hash);
    por_payload.extend_from_slice(&(challenge_sector as u32).to_be_bytes());

    let por_frame = WireFrame {
        opcode: P2POpcode::PorChallenge,
        request_id: 7,
        payload: Bytes::from(por_payload),
    };
    client.send(por_frame).await.unwrap();
    let por_resp = client.next().await.unwrap().unwrap();

    let expected_por = StorageManager::evaluate_por_challenge(&real_chunk, challenge_sector).unwrap();
    let expected_root = hex::decode(&expected_por.merkle_root).unwrap();
    assert_eq!(&por_resp.payload[..], &expected_root[..]);

    // =========================================================================
    // Test 7: SEC-VOUCHER-01 — Full wire voucher rejections and acceptance
    // =========================================================================
    let key_attacker = SigningKey::generate(&mut csprng);
    let channel_id = {
        let mut eng = depin_b.lock().await;
        eng.open_channel(&identity_a.verifying_key_hex, &identity_b.verifying_key_hex, 2000, 1000, 10).unwrap()
    };

    // 7A: Unknown channel rejection
    let unknown_voucher = SignedChannelCommitment {
        channel_id: "unknown_channel_x".into(),
        sequence_number: 1,
        balance_a: 1980,
        balance_b: 1020,
        transferred_chunks: 1,
        latest_chunk_hash: hex::encode(expected_hash),
        timestamp_unix: 1700000000,
        signature: hex::encode([0u8; 64]),
    };
    client.send(WireFrame {
        opcode: P2POpcode::StateChannelVoucher,
        request_id: 8,
        payload: Bytes::from(serde_json::to_vec(&unknown_voucher).unwrap()),
    }).await.unwrap();
    let unk_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&unk_resp.payload[..], b"VOUCHER_UNKNOWN_CHANNEL");

    // 7B: Bad cryptographic signature rejection
    let mut forged_voucher = SignedChannelCommitment {
        channel_id: channel_id.clone(),
        sequence_number: 1,
        balance_a: 1980,
        balance_b: 1020,
        transferred_chunks: 1,
        latest_chunk_hash: hex::encode(expected_hash),
        timestamp_unix: 1700000000,
        signature: String::new(),
    };
    forged_voucher.sign_with(&key_attacker);
    client.send(WireFrame {
        opcode: P2POpcode::StateChannelVoucher,
        request_id: 9,
        payload: Bytes::from(serde_json::to_vec(&forged_voucher).unwrap()),
    }).await.unwrap();
    let bad_sig_resp = client.next().await.unwrap().unwrap();
    assert_eq!(&bad_sig_resp.payload[..], b"VOUCHER_INVALID_SIGNATURE");

    // 7C: Valid voucher acceptance and disk settlement
    let mut valid_voucher = SignedChannelCommitment {
        channel_id: channel_id.clone(),
        sequence_number: 1,
        balance_a: 1980,
        balance_b: 1020,
        transferred_chunks: 1,
        latest_chunk_hash: hex::encode(expected_hash),
        timestamp_unix: 1700000000,
        signature: String::new(),
    };
    valid_voucher.sign_with(&sk_a);
    client.send(WireFrame {
        opcode: P2POpcode::StateChannelVoucher,
        request_id: 10,
        payload: Bytes::from(serde_json::to_vec(&valid_voucher).unwrap()),
    }).await.unwrap();
    let valid_ack = client.next().await.unwrap().unwrap();
    assert_eq!(&valid_ack.payload[..], b"VOUCHER_ACCEPTED_AND_SETTLED");
    assert!(depin_file_b.exists());

    // 7D: Stale sequence rejection
    client.send(WireFrame {
        opcode: P2POpcode::StateChannelVoucher,
        request_id: 11,
        payload: Bytes::from(serde_json::to_vec(&valid_voucher).unwrap()),
    }).await.unwrap();
    let stale_ack = client.next().await.unwrap().unwrap();
    assert_eq!(&stale_ack.payload[..], b"VOUCHER_STALE_SEQUENCE");

    let _ = std::fs::remove_dir_all(&dir_b);
}
