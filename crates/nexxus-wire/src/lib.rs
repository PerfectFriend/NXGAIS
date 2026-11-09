//! NeXXUs Binary Wire Framing Protocol
//!
//! Specification v2.0
//!
//! Binary Wire Frame Layout:
//! ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┬──────────┐
//! │ Magic    │ Version  │ Opcode   │ ReqId    │ Length   │ Payload      │ CRC32    │
//! │ 4 bytes  │ 1 byte   │ 1 byte   │ 4 bytes  │ 4 bytes  │ N bytes      │ 4 bytes  │
//! │ 'NEXX'   │ 0x02     │ 0x??     │ BigEnd   │ BigEnd   │ Raw Bytes    │ Castag   │
//! └──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┴──────────┘

pub mod ebpf_xdp;
pub mod quic_transport;

pub use ebpf_xdp::{EbpfXdpEngine, XdpFilterRule, XdpTelemetryStats};
pub use quic_transport::{QuicDatagram, QuicPacketType, QuicTransportCodec};

use bytes::{Buf, BufMut, Bytes, BytesMut};
use crc32fast::Hasher;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use nexxus_core::{MAGIC_BYTES, NexxusError, PROTOCOL_VERSION, Result};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use tokio_util::codec::{Decoder, Encoder};

/// Session Authentication and Identity Handshake Frame Payload
/// Audit ID: SEC-AUTH-01
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeAnnouncePayload {
    pub node_id: String,
    pub verifying_key_hex: String,
    pub onion_address: String,
    pub timestamp_unix: u64,
    pub signature_hex: String,
}

impl NodeAnnouncePayload {
    pub fn new(
        node_id: impl Into<String>,
        verifying_key_hex: impl Into<String>,
        onion_address: impl Into<String>,
        timestamp_unix: u64,
    ) -> Self {
        Self {
            node_id: node_id.into(),
            verifying_key_hex: verifying_key_hex.into(),
            onion_address: onion_address.into(),
            timestamp_unix,
            signature_hex: String::new(),
        }
    }

    pub fn compute_digest(&self) -> [u8; 32] {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.node_id.as_bytes());
        hasher.update(self.verifying_key_hex.as_bytes());
        hasher.update(self.onion_address.as_bytes());
        hasher.update(&self.timestamp_unix.to_be_bytes());
        let res = hasher.finalize();
        let mut out = [0u8; 32];
        out.copy_from_slice(&res);
        out
    }

    pub fn sign_with(&mut self, key: &SigningKey) {
        let digest = self.compute_digest();
        let sig = key.sign(&digest);
        self.signature_hex = hex::encode(sig.to_bytes());
    }

    pub fn verify(&self) -> bool {
        let Ok(vk_bytes) = hex::decode(&self.verifying_key_hex) else {
            return false;
        };
        if vk_bytes.len() != 32 {
            return false;
        }
        let mut vk_arr = [0u8; 32];
        vk_arr.copy_from_slice(&vk_bytes);
        let Ok(vk) = VerifyingKey::from_bytes(&vk_arr) else {
            return false;
        };

        let Ok(sig_bytes) = hex::decode(&self.signature_hex) else {
            return false;
        };
        if sig_bytes.len() != 64 {
            return false;
        }
        let mut sig_arr = [0u8; 64];
        sig_arr.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&sig_arr);

        let digest = self.compute_digest();
        vk.verify(&digest, &sig).is_ok()
    }

    pub fn get_verifying_key(&self) -> Option<VerifyingKey> {
        let vk_bytes = hex::decode(&self.verifying_key_hex).ok()?;
        if vk_bytes.len() != 32 {
            return None;
        }
        let mut vk_arr = [0u8; 32];
        vk_arr.copy_from_slice(&vk_bytes);
        VerifyingKey::from_bytes(&vk_arr).ok()
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum P2POpcode {
    Ping = 0x01,
    Pong = 0x02,
    StoreChunk = 0x10,
    FetchChunk = 0x11,
    ChunkStoredAck = 0x12,
    PorChallenge = 0x30,
    PorResponse = 0x31,
    NodeAnnounce = 0x50,
    SmpMessage = 0x60,
    StateChannelVoucher = 0x61,
    Unknown = 0xFF,
}

impl From<u8> for P2POpcode {
    fn from(byte: u8) -> Self {
        match byte {
            0x01 => P2POpcode::Ping,
            0x02 => P2POpcode::Pong,
            0x10 => P2POpcode::StoreChunk,
            0x11 => P2POpcode::FetchChunk,
            0x12 => P2POpcode::ChunkStoredAck,
            0x30 => P2POpcode::PorChallenge,
            0x31 => P2POpcode::PorResponse,
            0x50 => P2POpcode::NodeAnnounce,
            0x60 => P2POpcode::SmpMessage,
            0x61 => P2POpcode::StateChannelVoucher,
            _ => P2POpcode::Unknown,
        }
    }
}

#[derive(Debug, Clone)]
pub struct WireFrame {
    pub opcode: P2POpcode,
    pub request_id: u32,
    pub payload: Bytes,
}

pub struct WireCodec;

impl Encoder<WireFrame> for WireCodec {
    type Error = NexxusError;

    fn encode(&mut self, item: WireFrame, dst: &mut BytesMut) -> Result<()> {
        let payload_len = item.payload.len() as u32;
        let total_frame_len = 4 + 1 + 1 + 4 + 4 + item.payload.len() + 4;
        dst.reserve(total_frame_len);

        let start_pos = dst.len();

        dst.put_slice(&MAGIC_BYTES);
        dst.put_u8(PROTOCOL_VERSION);
        dst.put_u8(item.opcode as u8);
        dst.put_u32(item.request_id);
        dst.put_u32(payload_len);
        dst.put_slice(&item.payload);

        // Compute CRC32 across all header + payload bytes
        let mut hasher = Hasher::new();
        hasher.update(&dst[start_pos..dst.len()]);
        let crc = hasher.finalize();
        dst.put_u32(crc);

        Ok(())
    }
}

impl Decoder for WireCodec {
    type Item = WireFrame;
    type Error = NexxusError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>> {
        const MIN_HEADER_LEN: usize = 4 + 1 + 1 + 4 + 4; // 14 bytes
        if src.len() < MIN_HEADER_LEN {
            return Ok(None);
        }

        // Validate Magic
        if &src[0..4] != MAGIC_BYTES {
            return Err(NexxusError::WireError("Invalid magic header bytes".into()));
        }

        let mut cursor = Cursor::new(&src[..]);
        cursor.set_position(4); // Skip magic
        let version = cursor.get_u8();
        if version != PROTOCOL_VERSION {
            return Err(NexxusError::WireError(format!(
                "Protocol version mismatch: expected {}, got {}",
                PROTOCOL_VERSION, version
            )));
        }

        let opcode = P2POpcode::from(cursor.get_u8());
        let request_id = cursor.get_u32();
        let payload_len = cursor.get_u32() as usize;

        pub const MAX_PAYLOAD_SIZE: usize = 16 * 1024 * 1024; // 16 MB maximum
        if payload_len > MAX_PAYLOAD_SIZE {
            return Err(NexxusError::WireError(format!(
                "Payload length {} exceeds maximum allowable limit of {} bytes",
                payload_len, MAX_PAYLOAD_SIZE
            )));
        }

        let total_frame_len = MIN_HEADER_LEN + payload_len + 4;
        if src.len() < total_frame_len {
            // Need more bytes
            src.reserve(total_frame_len - src.len());
            return Ok(None);
        }

        // Validate CRC32
        let frame_without_crc = &src[..total_frame_len - 4];
        let mut hasher = Hasher::new();
        hasher.update(frame_without_crc);
        let expected_crc = hasher.finalize();

        let mut crc_cursor = Cursor::new(&src[total_frame_len - 4..total_frame_len]);
        let actual_crc = crc_cursor.get_u32();

        if expected_crc != actual_crc {
            return Err(NexxusError::ChecksumMismatch);
        }

        // Advance buffer past frame
        let _ = src.split_to(MIN_HEADER_LEN);
        let payload = src.split_to(payload_len).freeze();
        let _ = src.split_to(4); // Split CRC

        Ok(Some(WireFrame {
            opcode,
            request_id,
            payload,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_ping_roundtrip() {
        let mut codec = WireCodec;
        let mut buffer = BytesMut::new();

        let original = WireFrame {
            opcode: P2POpcode::Ping,
            request_id: 42,
            payload: Bytes::from_static(b"PING_TEST"),
        };

        codec.encode(original, &mut buffer).unwrap();
        let decoded = codec.decode(&mut buffer).unwrap().unwrap();

        assert_eq!(decoded.opcode, P2POpcode::Ping);
        assert_eq!(decoded.request_id, 42);
        assert_eq!(&decoded.payload[..], b"PING_TEST");
    }

    #[test]
    fn test_node_announce_authentication() {
        use rand::rngs::OsRng;
        let mut csprng = OsRng;
        let key = SigningKey::generate(&mut csprng);
        let vk_hex = hex::encode(key.verifying_key().to_bytes());

        let mut announce = NodeAnnouncePayload::new(
            "nx_node_test_123",
            &vk_hex,
            "testonionaddress.onion",
            1700000000,
        );
        announce.sign_with(&key);
        assert!(announce.verify());

        // Altering signature must fail verification
        announce.signature_hex = hex::encode([0u8; 64]);
        assert!(!announce.verify());
    }
}
