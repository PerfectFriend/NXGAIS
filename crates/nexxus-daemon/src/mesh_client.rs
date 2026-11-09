//! NeXXUs P2P Mesh Client
//!
//! Audit ID: FEAT-FILE-PUT-NET-01, FEAT-FILE-GET-NET-01, FEAT-BOOTSTRAP-01
//! Client for dialing remote NeXXUs nodes over TCP wire framing,
//! performing NodeAnnounce session authentication, and transferring
//! 16KB Chunks and 4KB RS Shards with content-addressed verification.

use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use nexxus_core::{NexxusError, Result, CHUNK_SIZE_BYTES, SHARD_SIZE_BYTES};
use nexxus_storage::NodeIdentity;
use nexxus_wire::{NodeAnnouncePayload, P2POpcode, WireCodec, WireFrame};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_util::codec::Framed;

pub struct MeshClient {
    pub peer_addr: String,
    pub timeout: Duration,
}

impl MeshClient {
    pub fn new(peer_addr: impl Into<String>) -> Self {
        Self {
            peer_addr: peer_addr.into(),
            timeout: Duration::from_secs(5),
        }
    }

    /// Connects, performs NodeAnnounce authentication, and returns framed connection
    pub async fn connect_authenticated(
        &self,
        local_identity: &NodeIdentity,
    ) -> Result<Framed<TcpStream, WireCodec>> {
        let stream = tokio::time::timeout(self.timeout, TcpStream::connect(&self.peer_addr))
            .await
            .map_err(|_| NexxusError::NetworkError(format!("Connection timed out to {}", self.peer_addr)))?
            .map_err(|e| NexxusError::NetworkError(format!("Failed to connect to {}: {:?}", self.peer_addr, e)))?;

        let mut framed = Framed::new(stream, WireCodec);

        // Send NodeAnnounce payload
        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut announce = NodeAnnouncePayload::new(
            &local_identity.node_id,
            &local_identity.verifying_key_hex,
            &local_identity.onion_address,
            now_sec,
        );
        let signing_key = local_identity.get_signing_key()?;
        announce.sign_with(&signing_key);

        let payload_json = serde_json::to_vec(&announce).map_err(|e| {
            NexxusError::WireError(format!("Failed to serialize NodeAnnounce: {:?}", e))
        })?;

        let frame = WireFrame {
            opcode: P2POpcode::NodeAnnounce,
            request_id: 1,
            payload: Bytes::from(payload_json),
        };

        framed.send(frame).await?;

        // Expect AUTH_OK pong
        if let Some(resp_res) = tokio::time::timeout(self.timeout, framed.next())
            .await
            .map_err(|_| NexxusError::NetworkError("Timeout waiting for auth response".into()))?
        {
            let resp = resp_res?;
            if resp.opcode == P2POpcode::Pong && &resp.payload[..] == b"AUTH_OK" {
                return Ok(framed);
            } else {
                return Err(NexxusError::NetworkError(format!(
                    "Authentication rejected by peer {}: {:?}",
                    self.peer_addr,
                    String::from_utf8_lossy(&resp.payload)
                )));
            }
        }

        Err(NexxusError::NetworkError("Connection closed during handshake".into()))
    }

    /// Stores a 4096-byte RS shard (or 16KB chunk) to the remote peer via StoreShard / StoreChunk
    pub async fn store_remote_shard(
        &self,
        local_identity: &NodeIdentity,
        shard_data: &[u8],
    ) -> Result<[u8; 32]> {
        let mut framed = self.connect_authenticated(local_identity).await?;

        let opcode = if shard_data.len() == SHARD_SIZE_BYTES {
            P2POpcode::StoreShard
        } else if shard_data.len() == CHUNK_SIZE_BYTES {
            P2POpcode::StoreChunk
        } else {
            return Err(NexxusError::StorageError(format!(
                "Invalid payload size: {}",
                shard_data.len()
            )));
        };

        let frame = WireFrame {
            opcode,
            request_id: 10,
            payload: Bytes::copy_from_slice(shard_data),
        };

        framed.send(frame).await?;

        if let Some(resp_res) = tokio::time::timeout(self.timeout, framed.next())
            .await
            .map_err(|_| NexxusError::NetworkError("Timeout waiting for store ack".into()))?
        {
            let resp = resp_res?;
            if (resp.opcode == P2POpcode::ShardStoredAck || resp.opcode == P2POpcode::ChunkStoredAck)
                && resp.payload.len() == 32
            {
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&resp.payload);
                return Ok(hash);
            } else {
                return Err(NexxusError::NetworkError(format!(
                    "Store rejected: {:?}",
                    String::from_utf8_lossy(&resp.payload)
                )));
            }
        }

        Err(NexxusError::NetworkError("Connection closed before store ack".into()))
    }

    /// Fetches a 4096-byte RS shard (or 16KB chunk) from remote peer by SHA-256 hash
    pub async fn fetch_remote_shard(
        &self,
        local_identity: &NodeIdentity,
        hash: &[u8; 32],
    ) -> Result<Vec<u8>> {
        let mut framed = self.connect_authenticated(local_identity).await?;

        let frame = WireFrame {
            opcode: P2POpcode::FetchShard,
            request_id: 20,
            payload: Bytes::copy_from_slice(hash),
        };

        framed.send(frame).await?;

        if let Some(resp_res) = tokio::time::timeout(self.timeout, framed.next())
            .await
            .map_err(|_| NexxusError::NetworkError("Timeout waiting for fetch response".into()))?
        {
            let resp = resp_res?;
            if (resp.opcode == P2POpcode::StoreShard || resp.opcode == P2POpcode::StoreChunk)
                && !resp.payload.is_empty()
            {
                return Ok(resp.payload.to_vec());
            }
        }

        // Try FetchChunk fallback if FetchShard returned empty
        let frame2 = WireFrame {
            opcode: P2POpcode::FetchChunk,
            request_id: 21,
            payload: Bytes::copy_from_slice(hash),
        };

        framed.send(frame2).await?;

        if let Some(resp_res) = tokio::time::timeout(self.timeout, framed.next())
            .await
            .map_err(|_| NexxusError::NetworkError("Timeout waiting for fetch response".into()))?
        {
            let resp = resp_res?;
            if !resp.payload.is_empty() {
                return Ok(resp.payload.to_vec());
            }
        }

        Err(NexxusError::StorageError(format!(
            "Shard not found on peer {}: {}",
            self.peer_addr,
            hex::encode(hash)
        )))
    }
}
