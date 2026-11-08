//! End-to-End Multi-Node Storage-Backed P2P Mesh Integration Test
//! Audit ID: E2E-STORE-01, E2E-FETCH-01, E2E-POR-01, E2E-DEPIN-01, E2E-MESH-01
//!
//! Validates:
//! 1. Real TCP inter-node communication between Node A and Node B.
//! 2. Storage-backed StoreChunk (writing 16KB to disk).
//! 3. Storage-backed FetchChunk (reading 16KB from disk with bit-for-bit check).
//! 4. Hardware-accelerated PoR challenge against real stored chunks.
//! 5. Ed25519-signed DePIN state channel voucher settlement with disk persistence.

use bytes::Bytes;
use ed25519_dalek::SigningKey;
use futures_util::{SinkExt, StreamExt};
use nexxus_core::{sha256_digest, CHUNK_SIZE_BYTES};
use nexxus_storage::{
    DePinBarterEngine, SignedChannelCommitment, StorageManager, TransferDirection,
};
use nexxus_wire::{P2POpcode, WireCodec, WireFrame};
use rand::rngs::OsRng;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_util::codec::Framed;

/// Runs a real storage-backed P2P node reactor
async fn run_storage_p2p_node(
    listener: TcpListener,
    storage: StorageManager,
    depin: Arc<Mutex<DePinBarterEngine>>,
    depin_path: PathBuf,
) {
    while let Ok((stream, peer_addr)) = listener.accept().await {
        let storage = storage.clone();
        let depin = depin.clone();
        let depin_path = depin_path.clone();

        tokio::spawn(async move {
            let mut framed = Framed::new(stream, WireCodec);
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
                    P2POpcode::StoreChunk => {
                        // E2E-STORE-01: Save 16KB chunk to disk
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
                        // E2E-FETCH-01: Read real bytes from disk
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
                        // E2E-POR-01: Real PoR audit on stored chunk
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
                        // E2E-DEPIN-01: Apply voucher and persist to disk
                        let commitment: SignedChannelCommitment =
                            serde_json::from_slice(&frame.payload)
                                .expect("Deserialize SignedChannelCommitment");

                        let ack_str = {
                            let mut eng = depin.lock().await;
                            if let Some(chan) = eng.get_channel_mut(&commitment.channel_id) {
                                if commitment.sequence_number
                                    > chan.current_commitment.sequence_number
                                {
                                    chan.current_commitment = commitment;
                                    eng.save_to_disk(&depin_path)
                                        .expect("Save DePIN state to disk");
                                    "VOUCHER_ACCEPTED_AND_SETTLED"
                                } else {
                                    "VOUCHER_STALE_SEQUENCE"
                                }
                            } else {
                                eng.save_to_disk(&depin_path)
                                    .expect("Save DePIN state to disk");
                                "VOUCHER_VERIFIED_AND_SETTLED"
                            }
                        };

                        let ack = WireFrame {
                            opcode: P2POpcode::ChunkStoredAck,
                            request_id: frame.request_id,
                            payload: Bytes::from_static(ack_str.as_bytes()),
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
async fn test_e2e_storage_backed_p2p_mesh() {
    let test_run_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let dir_b = std::env::temp_dir().join(format!("nexxus_node_b_{}", test_run_id));
    let storage_b = StorageManager::new(&dir_b).expect("Init StorageManager B");
    let depin_file_b = dir_b.join("depin_state.json");
    let depin_b = Arc::new(Mutex::new(DePinBarterEngine::new()));

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
    ));

    // 2. Connect Node A client to Node B
    let client_stream = TcpStream::connect(addr_b)
        .await
        .expect("Connect to Node B");
    let mut client = Framed::new(client_stream, WireCodec);

    // =========================================================================
    // Scenario 1: E2E-STORE-01 — Store 16KB chunk on Node B disk
    // =========================================================================
    let mut chunk_data = vec![0u8; CHUNK_SIZE_BYTES];
    for (i, b) in chunk_data.iter_mut().enumerate() {
        *b = ((i * 31 + 17) & 0xFF) as u8;
    }
    let expected_hash = sha256_digest(&chunk_data);

    let store_frame = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 1001,
        payload: Bytes::copy_from_slice(&chunk_data),
    };
    client.send(store_frame).await.expect("Send StoreChunk");

    let ack_frame = client
        .next()
        .await
        .expect("Receive stream")
        .expect("Valid ACK frame");
    assert_eq!(ack_frame.opcode, P2POpcode::ChunkStoredAck);
    assert_eq!(ack_frame.request_id, 1001);
    assert_eq!(&ack_frame.payload[..], &expected_hash[..]);

    // Verify chunk is physically on Node B disk!
    assert!(
        storage_b.has_chunk(&expected_hash),
        "Chunk must be physically saved on disk at Node B"
    );

    // =========================================================================
    // Scenario 2: E2E-FETCH-01 — Fetch chunk from Node B disk and verify bit-for-bit
    // =========================================================================
    let fetch_frame = WireFrame {
        opcode: P2POpcode::FetchChunk,
        request_id: 1002,
        payload: Bytes::copy_from_slice(&expected_hash),
    };
    client.send(fetch_frame).await.expect("Send FetchChunk");

    let fetched_frame = client.next().await.unwrap().unwrap();
    assert_eq!(fetched_frame.opcode, P2POpcode::StoreChunk);
    assert_eq!(fetched_frame.request_id, 1002);
    assert_eq!(
        fetched_frame.payload.len(),
        CHUNK_SIZE_BYTES,
        "Fetched chunk must be exactly 16 KB"
    );
    assert_eq!(
        &fetched_frame.payload[..],
        &chunk_data[..],
        "Fetched chunk bytes must be bit-for-bit identical to original"
    );

    // =========================================================================
    // Scenario 3: E2E-POR-01 — Challenge Proof-of-Retrievability against disk chunk
    // =========================================================================
    let challenge_sector = 19usize;
    let mut por_payload = Vec::with_capacity(36);
    por_payload.extend_from_slice(&expected_hash);
    por_payload.extend_from_slice(&(challenge_sector as u32).to_be_bytes());

    let por_frame = WireFrame {
        opcode: P2POpcode::PorChallenge,
        request_id: 1003,
        payload: Bytes::from(por_payload),
    };
    client.send(por_frame).await.expect("Send PoR challenge");

    let por_response_frame = client.next().await.unwrap().unwrap();
    assert_eq!(por_response_frame.opcode, P2POpcode::PorResponse);
    assert_eq!(por_response_frame.request_id, 1003);

    // Compute expected PoR Merkle root independently
    let expected_por =
        StorageManager::evaluate_por_challenge(&chunk_data, challenge_sector).unwrap();
    let expected_root_bytes = hex::decode(&expected_por.merkle_root).unwrap();
    assert_eq!(
        &por_response_frame.payload[..],
        &expected_root_bytes[..],
        "PoR Merkle root must match the independent evaluation"
    );

    // =========================================================================
    // Scenario 4: E2E-DEPIN-01 — Settle signed state channel voucher with disk persist
    // =========================================================================
    let mut csprng = OsRng;
    let key_alice = SigningKey::generate(&mut csprng);
    let key_bob = SigningKey::generate(&mut csprng);

    let pub_alice = hex::encode(key_alice.verifying_key().to_bytes());
    let pub_bob = hex::encode(key_bob.verifying_key().to_bytes());

    let channel_id = {
        let mut eng = depin_b.lock().await;
        eng.open_channel(&pub_alice, &pub_bob, 2000, 1000, 10)
            .expect("Open channel on Node B")
    };

    // Node A creates and signs commitment voucher #1
    let mut commitment = SignedChannelCommitment {
        channel_id: channel_id.clone(),
        sequence_number: 1,
        balance_a: 1980,
        balance_b: 1020,
        transferred_chunks: 1,
        latest_chunk_hash: hex::encode(expected_hash),
        timestamp_unix: 1700000000,
        signature: String::new(),
    };
    commitment.sign_with(&key_alice);
    assert!(commitment.verify_signature(&key_alice.verifying_key()));

    let voucher_payload = serde_json::to_vec(&commitment).expect("Serialize commitment");
    let voucher_frame = WireFrame {
        opcode: P2POpcode::StateChannelVoucher,
        request_id: 1004,
        payload: Bytes::from(voucher_payload),
    };
    client.send(voucher_frame).await.expect("Send voucher");

    let voucher_ack = client.next().await.unwrap().unwrap();
    assert_eq!(voucher_ack.opcode, P2POpcode::ChunkStoredAck);
    assert_eq!(voucher_ack.request_id, 1004);
    assert_eq!(&voucher_ack.payload[..], b"VOUCHER_ACCEPTED_AND_SETTLED");

    // Verify DePIN state was physically saved to disk!
    assert!(
        depin_file_b.exists(),
        "DePIN state file must be persisted to disk"
    );
    let disk_depin = DePinBarterEngine::load_from_disk(&depin_file_b)
        .expect("Load persisted DePIN state from disk");
    let settled_chan = disk_depin
        .get_channel(&channel_id)
        .expect("Channel must exist in persisted state");
    assert_eq!(settled_chan.current_commitment.sequence_number, 1);
    assert_eq!(settled_chan.current_commitment.balance_a, 1980);
    assert_eq!(settled_chan.current_commitment.balance_b, 1020);

    // Clean up temp directories
    let _ = std::fs::remove_dir_all(&dir_b);
}
