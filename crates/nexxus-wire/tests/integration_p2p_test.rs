//! P2P Integration Tests for NeXXUs Wire Protocol
//! Audit ID: TEST-INT-01
//!
//! Validates StoreChunk, FetchChunk, PoR challenge/response,
//! encrypted payload transfers, and multi-frame streaming pipelines
//! between simulated in-process nodes.

use bytes::{Bytes, BytesMut};
use nexxus_core::{sha256_digest, CHUNK_SIZE_BYTES};
use nexxus_crypto::{decrypt_chunk_aead, encrypt_chunk_aead};
use nexxus_wire::{P2POpcode, WireCodec, WireFrame};
use tokio_util::codec::{Decoder, Encoder};

#[test]
fn test_store_chunk_p2p_roundtrip() {
    let mut codec = WireCodec;
    let mut channel = BytesMut::new();

    // 1. Node A creates a 16 KB chunk
    let mut original_chunk = vec![0u8; CHUNK_SIZE_BYTES];
    for (i, b) in original_chunk.iter_mut().enumerate() {
        *b = ((i * 31 + 17) & 0xFF) as u8;
    }
    let expected_hash = sha256_digest(&original_chunk);

    // Node A encodes StoreChunk wire frame
    let store_req = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 1001,
        payload: Bytes::copy_from_slice(&original_chunk),
    };
    codec.encode(store_req, &mut channel).expect("Encoding StoreChunk must succeed");

    // 2. Node B receives and decodes from wire
    let received_frame = codec
        .decode(&mut channel)
        .expect("Decoding must succeed")
        .expect("Frame must be complete");

    assert_eq!(received_frame.opcode, P2POpcode::StoreChunk);
    assert_eq!(received_frame.request_id, 1001);
    assert_eq!(received_frame.payload.len(), CHUNK_SIZE_BYTES);
    assert_eq!(&received_frame.payload[..], &original_chunk[..]);

    // Node B computes hash and responds with ChunkStoredAck
    let computed_hash = sha256_digest(&received_frame.payload);
    assert_eq!(computed_hash, expected_hash);

    let ack_frame = WireFrame {
        opcode: P2POpcode::ChunkStoredAck,
        request_id: received_frame.request_id,
        payload: Bytes::copy_from_slice(&computed_hash),
    };
    codec.encode(ack_frame, &mut channel).expect("Encoding Ack must succeed");

    // 3. Node A receives and verifies the Ack
    let received_ack = codec
        .decode(&mut channel)
        .expect("Decoding ack must succeed")
        .expect("Ack frame must be complete");

    assert_eq!(received_ack.opcode, P2POpcode::ChunkStoredAck);
    assert_eq!(received_ack.request_id, 1001);
    assert_eq!(&received_ack.payload[..], &expected_hash[..]);
}

#[test]
fn test_fetch_chunk_request_response() {
    let mut codec = WireCodec;
    let mut channel = BytesMut::new();

    let target_hash = [0xABu8; 32];

    // Node A sends FetchChunk request with target hash
    let fetch_req = WireFrame {
        opcode: P2POpcode::FetchChunk,
        request_id: 2002,
        payload: Bytes::copy_from_slice(&target_hash),
    };
    codec.encode(fetch_req, &mut channel).expect("Encode fetch request");

    // Node B decodes fetch request
    let received_req = codec.decode(&mut channel).unwrap().unwrap();
    assert_eq!(received_req.opcode, P2POpcode::FetchChunk);
    assert_eq!(received_req.request_id, 2002);
    assert_eq!(&received_req.payload[..], &target_hash[..]);

    // Node B retrieves chunk from local storage and responds with StoreChunk
    let chunk_data = vec![0x42u8; CHUNK_SIZE_BYTES];
    let fetch_resp = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: received_req.request_id,
        payload: Bytes::copy_from_slice(&chunk_data),
    };
    codec.encode(fetch_resp, &mut channel).expect("Encode fetch response");

    // Node A decodes the response chunk
    let received_resp = codec.decode(&mut channel).unwrap().unwrap();
    assert_eq!(received_resp.opcode, P2POpcode::StoreChunk);
    assert_eq!(received_resp.request_id, 2002);
    assert_eq!(received_resp.payload.len(), CHUNK_SIZE_BYTES);
    assert_eq!(&received_resp.payload[..], &chunk_data[..]);
}

#[test]
fn test_por_challenge_response() {
    let mut codec = WireCodec;
    let mut channel = BytesMut::new();

    // Node B has a chunk in NVMe storage
    let stored_chunk = vec![0x7Eu8; CHUNK_SIZE_BYTES];

    // Node A issues a random 32-byte PoR challenge nonce
    let challenge_nonce = [0x5Cu8; 32];
    let challenge_frame = WireFrame {
        opcode: P2POpcode::PorChallenge,
        request_id: 3003,
        payload: Bytes::copy_from_slice(&challenge_nonce),
    };
    codec.encode(challenge_frame, &mut channel).expect("Encode challenge");

    // Node B receives challenge
    let received_challenge = codec.decode(&mut channel).unwrap().unwrap();
    assert_eq!(received_challenge.opcode, P2POpcode::PorChallenge);
    assert_eq!(received_challenge.request_id, 3003);

    // Node B evaluates PoR proof: SHA256(nonce || chunk)
    let mut proof_input = Vec::with_capacity(32 + CHUNK_SIZE_BYTES);
    proof_input.extend_from_slice(&received_challenge.payload);
    proof_input.extend_from_slice(&stored_chunk);
    let proof = sha256_digest(&proof_input);

    let por_response_frame = WireFrame {
        opcode: P2POpcode::PorResponse,
        request_id: received_challenge.request_id,
        payload: Bytes::copy_from_slice(&proof),
    };
    codec.encode(por_response_frame, &mut channel).expect("Encode PoR response");

    // Node A receives and verifies proof
    let received_response = codec.decode(&mut channel).unwrap().unwrap();
    assert_eq!(received_response.opcode, P2POpcode::PorResponse);
    assert_eq!(received_response.request_id, 3003);

    let mut expected_input = Vec::with_capacity(32 + CHUNK_SIZE_BYTES);
    expected_input.extend_from_slice(&challenge_nonce);
    expected_input.extend_from_slice(&stored_chunk);
    let expected_proof = sha256_digest(&expected_input);

    assert_eq!(&received_response.payload[..], &expected_proof[..]);
}

#[test]
fn test_encrypted_chunk_store_and_retrieve() {
    let mut codec = WireCodec;
    let mut channel = BytesMut::new();

    let key = [0x2Au8; 32];
    let nonce = [0x11u8; 12];
    let plaintext = vec![0xFEu8; CHUNK_SIZE_BYTES];

    // Encrypt 16 KB chunk via ChaCha20-Poly1305 AEAD
    let ciphertext = encrypt_chunk_aead(&key, &nonce, &plaintext)
        .expect("ChaCha20-Poly1305 encryption must succeed");
    assert_eq!(ciphertext.len(), CHUNK_SIZE_BYTES + 16); // 16 bytes Poly1305 MAC

    // Transmit encrypted chunk
    let frame = WireFrame {
        opcode: P2POpcode::StoreChunk,
        request_id: 4004,
        payload: Bytes::copy_from_slice(&ciphertext),
    };
    codec.encode(frame, &mut channel).expect("Encode encrypted chunk");

    // Receive and decode on remote peer
    let received = codec.decode(&mut channel).unwrap().unwrap();
    assert_eq!(received.opcode, P2POpcode::StoreChunk);
    assert_eq!(received.request_id, 4004);

    // Decrypt and verify bit-for-bit authenticity
    let decrypted = decrypt_chunk_aead(&key, &nonce, &received.payload)
        .expect("ChaCha20-Poly1305 decryption must succeed");
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_multi_frame_pipeline() {
    let mut codec = WireCodec;
    let mut channel = BytesMut::new();

    let opcodes = [
        (P2POpcode::Ping, 10, Bytes::from_static(b"PING_1")),
        (P2POpcode::Pong, 11, Bytes::from_static(b"PONG_1")),
        (P2POpcode::NodeAnnounce, 12, Bytes::from_static(b"ANNOUNCE")),
        (P2POpcode::StoreChunk, 13, Bytes::from_static(b"CHUNK_DATA_1")),
        (P2POpcode::ChunkStoredAck, 14, Bytes::from_static(b"ACK_1")),
        (P2POpcode::FetchChunk, 15, Bytes::from_static(b"HASH_TARGET")),
        (P2POpcode::StoreChunk, 16, Bytes::from_static(b"CHUNK_DATA_2")),
        (P2POpcode::PorChallenge, 17, Bytes::from_static(b"CHALLENGE_NONCE")),
        (P2POpcode::PorResponse, 18, Bytes::from_static(b"PROOF_RESPONSE")),
        (P2POpcode::SmpMessage, 19, Bytes::from_static(b"SMP_PAYLOAD")),
    ];

    // Pipeline all 10 frames into a continuous byte stream (simulating TCP)
    for (op, req_id, payload) in &opcodes {
        let frame = WireFrame {
            opcode: *op,
            request_id: *req_id,
            payload: payload.clone(),
        };
        codec.encode(frame, &mut channel).expect("Encode pipeline frame");
    }

    // Decode sequentially and verify ordering & data
    for (expected_op, expected_req_id, expected_payload) in &opcodes {
        let decoded = codec
            .decode(&mut channel)
            .expect("Decode error")
            .expect("Missing frame in stream");

        assert_eq!(decoded.opcode, *expected_op);
        assert_eq!(decoded.request_id, *expected_req_id);
        assert_eq!(&decoded.payload[..], &expected_payload[..]);
    }

    // Buffer should be cleanly consumed
    assert!(channel.is_empty());
}
