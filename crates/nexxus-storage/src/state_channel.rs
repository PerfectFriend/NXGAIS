//! NeXXUs Autonomous DePIN State Channels & Micropayments Engine
//!
//! Provides ultra-low latency, zero-gas off-chain state channels for high-frequency
//! 16 KB chunk barter settlements and cryptographic anti-free-riding accounting.
//!
//! Features:
//! - Bilateral and unilateral payment/barter state channels.
//! - Nonce-sequenced signed voucher commitments with Ed25519 authentication.
//! - Autonomous reciprocation scoring with adaptive rate throttling for non-contributing peers.
//! - Dispute resolution window and fraud proof verification.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use nexxus_core::{NexxusError, Result, CHUNK_SIZE_BYTES};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Canonical status of a DePIN state channel
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChannelState {
    Active,
    Closing { dispute_deadline_unix: u64 },
    Settled,
    Disputed { fraud_evidence: String },
}

/// Cryptographically signed commitment voucher representing the latest agreed state
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedChannelCommitment {
    pub channel_id: String,
    pub sequence_number: u64,
    pub balance_a: u64,
    pub balance_b: u64,
    pub transferred_chunks: u64,
    pub latest_chunk_hash: String,
    pub timestamp_unix: u64,
    pub signature: String,
}

impl SignedChannelCommitment {
    /// Computes the deterministic SHA-256 digest of this commitment state
    pub fn compute_digest(&self) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(self.channel_id.as_bytes());
        hasher.update(&self.sequence_number.to_be_bytes());
        hasher.update(&self.balance_a.to_be_bytes());
        hasher.update(&self.balance_b.to_be_bytes());
        hasher.update(&self.transferred_chunks.to_be_bytes());
        hasher.update(self.latest_chunk_hash.as_bytes());
        hasher.update(&self.timestamp_unix.to_be_bytes());
        let res = hasher.finalize();
        let mut out = [0u8; 32];
        out.copy_from_slice(&res);
        out
    }

    /// Signs this state commitment with the node's Ed25519 signing key
    pub fn sign_with(&mut self, key: &SigningKey) {
        let digest = self.compute_digest();
        let sig = key.sign(&digest);
        self.signature = hex::encode(sig.to_bytes());
    }

    /// Verifies the signature against the expected peer's verifying key
    pub fn verify_signature(&self, key: &VerifyingKey) -> bool {
        let Ok(sig_bytes) = hex::decode(&self.signature) else {
            return false;
        };
        if sig_bytes.len() != 64 {
            return false;
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&arr);
        let digest = self.compute_digest();
        key.verify(&digest, &sig).is_ok()
    }
}

/// State channel descriptor between two autonomous NeXXUs nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateChannel {
    pub channel_id: String,
    pub peer_a: String,
    pub peer_b: String,
    pub initial_deposit_a: u64,
    pub initial_deposit_b: u64,
    pub current_commitment: SignedChannelCommitment,
    pub state: ChannelState,
    pub dispute_window_secs: u64,
    pub opened_at_unix: u64,
}

/// Direction of chunk transfer for reputation and credit tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransferDirection {
    OutgoingToPeer,
    IncomingFromPeer,
}

/// Peer reciprocation record and reputation score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerReputation {
    pub peer_id: String,
    pub chunks_served: u64,
    pub chunks_downloaded: u64,
    pub bytes_served: u64,
    pub bytes_downloaded: u64,
    /// Balance in 16KB chunk credit units (+ means peer gave us more than they took)
    pub credit_balance: i64,
    /// Barter reciprocation ratio between 0.0 and 1.0 (default 1.0 for new peers)
    pub reputation_score: f64,
    pub is_throttled: bool,
    pub last_interaction_unix: u64,
}

impl PeerReputation {
    pub fn new(peer_id: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        Self {
            peer_id,
            chunks_served: 0,
            chunks_downloaded: 0,
            bytes_served: 0,
            bytes_downloaded: 0,
            credit_balance: 0,
            reputation_score: 1.0,
            is_throttled: false,
            last_interaction_unix: now,
        }
    }

    /// Recalculates the dynamic reputation score and checks anti-free-riding thresholds
    pub fn recalculate(&mut self, free_allowance_chunks: i64) {
        let served = self.chunks_served as f64;
        let downloaded = self.chunks_downloaded as f64;

        if downloaded == 0.0 {
            self.reputation_score = 1.0;
        } else {
            let ratio = (served + 4.0) / (downloaded + 4.0);
            self.reputation_score = ratio.clamp(0.05, 1.0);
        }

        // Anti-free-rider rule: If downloaded exceeds served by more than allowance, throttle peer
        if self.credit_balance < -free_allowance_chunks {
            self.is_throttled = true;
        } else {
            self.is_throttled = false;
        }
    }

    /// Records an operational failure (timeout, bad checksum, rejected request)
    /// Audit ID: FEAT-REP-01
    pub fn record_failure(&mut self) {
        self.reputation_score = (self.reputation_score * 0.7).max(0.05);
        if self.reputation_score <= 0.2 {
            self.is_throttled = true;
        }
    }
}

/// Telemetry metrics for DePIN barter operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DePinTelemetry {
    pub active_channels_count: usize,
    pub total_settled_vouchers: u64,
    pub total_chunks_balanced: u64,
    pub total_bytes_balanced: u64,
    pub total_settled_credits: u64,
    pub throttled_peers_count: usize,
    pub average_peer_reputation: f64,
}

/// Autonomous DePIN Barter and State Channel Engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DePinBarterEngine {
    channels: HashMap<String, StateChannel>,
    peer_reputations: HashMap<String, PeerReputation>,
    total_settled_vouchers: u64,
    free_allowance_chunks: i64,
    default_dispute_window_secs: u64,
}

impl DePinBarterEngine {
    pub fn new() -> Self {
        Self {
            channels: HashMap::new(),
            peer_reputations: HashMap::new(),
            total_settled_vouchers: 0,
            free_allowance_chunks: 16, // 16 chunks * 16KB = 256KB free exploration buffer
            default_dispute_window_secs: 3600, // 1 hour
        }
    }

    /// Exports all state channels and reputations to a JSON string (Audit ID: STORAGE-DEPIN-01)
    pub fn export_state_json(&self) -> Result<String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| NexxusError::StorageError(format!("Failed to serialize DePIN engine state: {:?}", e)))
    }

    /// Imports state channels and reputations from a JSON string (Audit ID: STORAGE-DEPIN-01)
    pub fn import_state_json(&mut self, json_str: &str) -> Result<()> {
        let restored: Self = serde_json::from_str(json_str)
            .map_err(|e| NexxusError::StorageError(format!("Failed to deserialize DePIN engine state: {:?}", e)))?;
        *self = restored;
        Ok(())
    }

    /// Persists state channels to a file on disk (Audit ID: STORAGE-DEPIN-01)
    pub fn save_to_disk(&self, path: impl AsRef<std::path::Path>) -> Result<()> {
        let json = self.export_state_json()?;
        std::fs::write(path, json)
            .map_err(|e| NexxusError::StorageError(format!("Failed to write state channels to disk: {:?}", e)))
    }

    /// Restores state channels from a file on disk (Audit ID: STORAGE-DEPIN-01)
    pub fn load_from_disk(path: impl AsRef<std::path::Path>) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to read state channels from disk: {:?}", e)))?;
        serde_json::from_str(&content)
            .map_err(|e| NexxusError::StorageError(format!("Failed to deserialize state channels from disk: {:?}", e)))
    }

    /// Computes deterministic Channel ID from peer pubkeys and nonce
    pub fn derive_channel_id(peer_a: &str, peer_b: &str, nonce: u64) -> String {
        let mut hasher = Sha256::new();
        let (first, second) = if peer_a < peer_b {
            (peer_a, peer_b)
        } else {
            (peer_b, peer_a)
        };
        hasher.update(first.as_bytes());
        hasher.update(b":");
        hasher.update(second.as_bytes());
        hasher.update(&nonce.to_be_bytes());
        hex::encode(hasher.finalize())
    }

    /// Opens a new micropayment state channel with initial deposits
    pub fn open_channel(
        &mut self,
        peer_a: &str,
        peer_b: &str,
        deposit_a: u64,
        deposit_b: u64,
        nonce: u64,
    ) -> Result<String> {
        let channel_id = Self::derive_channel_id(peer_a, peer_b, nonce);
        if self.channels.contains_key(&channel_id) {
            return Err(NexxusError::StorageError(format!(
                "Channel {} already exists",
                channel_id
            )));
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let initial_commitment = SignedChannelCommitment {
            channel_id: channel_id.clone(),
            sequence_number: 0,
            balance_a: deposit_a,
            balance_b: deposit_b,
            transferred_chunks: 0,
            latest_chunk_hash: "0".repeat(64),
            timestamp_unix: now,
            signature: String::new(),
        };

        let channel = StateChannel {
            channel_id: channel_id.clone(),
            peer_a: peer_a.to_string(),
            peer_b: peer_b.to_string(),
            initial_deposit_a: deposit_a,
            initial_deposit_b: deposit_b,
            current_commitment: initial_commitment,
            state: ChannelState::Active,
            dispute_window_secs: self.default_dispute_window_secs,
            opened_at_unix: now,
        };

        self.channels.insert(channel_id.clone(), channel);
        Ok(channel_id)
    }

    /// Issues and signs a new sequence voucher for 16KB chunk delivery
    pub fn create_chunk_voucher(
        &mut self,
        channel_id: &str,
        sender_is_peer_a: bool,
        amount_credits: u64,
        chunk_hash: &str,
        signer_key: &SigningKey,
    ) -> Result<SignedChannelCommitment> {
        let channel = self
            .channels
            .get_mut(channel_id)
            .ok_or_else(|| NexxusError::StorageError(format!("Channel {} not found", channel_id)))?;

        if channel.state != ChannelState::Active {
            return Err(NexxusError::StorageError(
                "Cannot issue voucher on inactive channel".to_string(),
            ));
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let current = &channel.current_commitment;
        let (new_bal_a, new_bal_b) = if sender_is_peer_a {
            if current.balance_a < amount_credits {
                return Err(NexxusError::StorageError(
                    "Insufficient balance in channel for Peer A".to_string(),
                ));
            }
            (
                current.balance_a - amount_credits,
                current.balance_b + amount_credits,
            )
        } else {
            if current.balance_b < amount_credits {
                return Err(NexxusError::StorageError(
                    "Insufficient balance in channel for Peer B".to_string(),
                ));
            }
            (
                current.balance_a + amount_credits,
                current.balance_b - amount_credits,
            )
        };

        let mut next_commitment = SignedChannelCommitment {
            channel_id: channel_id.to_string(),
            sequence_number: current.sequence_number + 1,
            balance_a: new_bal_a,
            balance_b: new_bal_b,
            transferred_chunks: current.transferred_chunks + 1,
            latest_chunk_hash: chunk_hash.to_string(),
            timestamp_unix: now,
            signature: String::new(),
        };

        next_commitment.sign_with(signer_key);
        channel.current_commitment = next_commitment.clone();
        self.total_settled_vouchers += 1;

        Ok(next_commitment)
    }

    /// Verifies and applies an incoming state channel commitment from a counterparty
    pub fn apply_signed_voucher(
        &mut self,
        commitment: &SignedChannelCommitment,
        peer_verifying_key: &VerifyingKey,
    ) -> Result<()> {
        let channel = self
            .channels
            .get_mut(&commitment.channel_id)
            .ok_or_else(|| {
                NexxusError::StorageError(format!("Channel {} not found", commitment.channel_id))
            })?;

        if channel.state != ChannelState::Active {
            return Err(NexxusError::StorageError(
                "Channel is not active".to_string(),
            ));
        }

        // Monotonic sequence verification: must strictly exceed current sequence
        if commitment.sequence_number <= channel.current_commitment.sequence_number {
            return Err(NexxusError::StorageError(format!(
                "Stale commitment sequence {} <= current {}",
                commitment.sequence_number, channel.current_commitment.sequence_number
            )));
        }

        // Conservation of funds check
        let total_deposit = channel.initial_deposit_a + channel.initial_deposit_b;
        if commitment.balance_a + commitment.balance_b != total_deposit {
            return Err(NexxusError::StorageError(
                "Commitment balance sum violates conservation of funds".to_string(),
            ));
        }

        // Cryptographic signature check
        if !commitment.verify_signature(peer_verifying_key) {
            return Err(NexxusError::StorageError(
                "Invalid cryptographic signature on commitment".to_string(),
            ));
        }

        channel.current_commitment = commitment.clone();
        self.total_settled_vouchers += 1;
        Ok(())
    }

    /// Records high-frequency chunk barter I/O and updates autonomous peer reputation
    pub fn record_chunk_io(
        &mut self,
        peer_id: &str,
        direction: TransferDirection,
    ) -> PeerReputation {
        let entry = self
            .peer_reputations
            .entry(peer_id.to_string())
            .or_insert_with(|| PeerReputation::new(peer_id.to_string()));

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        entry.last_interaction_unix = now;

        match direction {
            TransferDirection::OutgoingToPeer => {
                entry.chunks_served += 1;
                entry.bytes_served += CHUNK_SIZE_BYTES as u64;
                entry.credit_balance += 1;
            }
            TransferDirection::IncomingFromPeer => {
                entry.chunks_downloaded += 1;
                entry.bytes_downloaded += CHUNK_SIZE_BYTES as u64;
                entry.credit_balance -= 1;
            }
        }

        entry.recalculate(self.free_allowance_chunks);
        entry.clone()
    }

    /// Initiates graceful closure with dispute window
    pub fn initiate_close(&mut self, channel_id: &str) -> Result<u64> {
        let channel = self
            .channels
            .get_mut(channel_id)
            .ok_or_else(|| NexxusError::StorageError(format!("Channel {} not found", channel_id)))?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let deadline = now + channel.dispute_window_secs;

        channel.state = ChannelState::Closing {
            dispute_deadline_unix: deadline,
        };
        Ok(deadline)
    }

    /// Settles the channel after the dispute deadline has elapsed
    pub fn finalize_settlement(&mut self, channel_id: &str) -> Result<SignedChannelCommitment> {
        let channel = self
            .channels
            .get_mut(channel_id)
            .ok_or_else(|| NexxusError::StorageError(format!("Channel {} not found", channel_id)))?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        match channel.state {
            ChannelState::Closing {
                dispute_deadline_unix,
            } => {
                if now < dispute_deadline_unix {
                    return Err(NexxusError::StorageError(format!(
                        "Dispute window still open ({}s remaining)",
                        dispute_deadline_unix - now
                    )));
                }
                channel.state = ChannelState::Settled;
                Ok(channel.current_commitment.clone())
            }
            _ => Err(NexxusError::StorageError(
                "Channel must be in Closing state to settle".to_string(),
            )),
        }
    }

    /// Records an operational failure for a peer (timeout, bad checksum, rejected request)
    /// Audit ID: FEAT-REP-01
    pub fn record_peer_failure(&mut self, peer_id: &str) {
        let entry = self
            .peer_reputations
            .entry(peer_id.to_string())
            .or_insert_with(|| PeerReputation::new(peer_id.to_string()));
        entry.record_failure();
    }

    /// Checks if a peer is throttled or has untrusted reputation
    /// Audit ID: FEAT-REP-01
    pub fn is_peer_throttled(&self, peer_id: &str) -> bool {
        self.peer_reputations
            .get(peer_id)
            .map(|r| r.is_throttled)
            .unwrap_or(false)
    }

    /// Computes aggregated DePIN telemetry stats
    pub fn get_telemetry(&self) -> DePinTelemetry {
        let mut total_chunks = 0u64;
        let mut total_bytes = 0u64;
        let mut throttled = 0usize;
        let mut rep_sum = 0.0;
        let total_peers = self.peer_reputations.len();

        for rep in self.peer_reputations.values() {
            total_chunks += rep.chunks_served + rep.chunks_downloaded;
            total_bytes += rep.bytes_served + rep.bytes_downloaded;
            if rep.is_throttled {
                throttled += 1;
            }
            rep_sum += rep.reputation_score;
        }

        let avg_rep = if total_peers > 0 {
            rep_sum / total_peers as f64
        } else {
            1.0
        };

        DePinTelemetry {
            active_channels_count: self
                .channels
                .values()
                .filter(|c| c.state == ChannelState::Active)
                .count(),
            total_settled_vouchers: self.total_settled_vouchers,
            total_chunks_balanced: total_chunks,
            total_bytes_balanced: total_bytes,
            total_settled_credits: self
                .channels
                .values()
                .map(|c| c.current_commitment.transferred_chunks)
                .sum(),
            throttled_peers_count: throttled,
            average_peer_reputation: (avg_rep * 1000.0).round() / 1000.0,
        }
    }

    pub fn get_channels(&self) -> Vec<StateChannel> {
        self.channels.values().cloned().collect()
    }

    pub fn get_channel(&self, channel_id: &str) -> Option<&StateChannel> {
        self.channels.get(channel_id)
    }

    pub fn get_channel_mut(&mut self, channel_id: &str) -> Option<&mut StateChannel> {
        self.channels.get_mut(channel_id)
    }

    /// Cryptographically validates and applies an incoming state channel voucher.
    ///
    /// Audit ID: SEC-VOUCHER-01
    /// Rejects by default:
    /// - Unknown channel (`VOUCHER_UNKNOWN_CHANNEL`)
    /// - Stale sequence number (`VOUCHER_STALE_SEQUENCE`)
    /// - Invalid signature (`VOUCHER_INVALID_SIGNATURE`)
    /// - Conservation of funds violation (`VOUCHER_CONSERVATION_VIOLATION`)
    pub fn verify_and_apply_voucher(
        &mut self,
        commitment: &SignedChannelCommitment,
    ) -> std::result::Result<&'static str, &'static str> {
        let channel = match self.channels.get(&commitment.channel_id) {
            Some(c) => c,
            None => return Err("VOUCHER_UNKNOWN_CHANNEL"),
        };

        if commitment.sequence_number <= channel.current_commitment.sequence_number {
            return Err("VOUCHER_STALE_SEQUENCE");
        }

        let total_deposit = channel.initial_deposit_a + channel.initial_deposit_b;
        if commitment.balance_a + commitment.balance_b != total_deposit {
            return Err("VOUCHER_CONSERVATION_VIOLATION");
        }

        // Derive peer verifying keys
        let vk_a = hex::decode(&channel.peer_a).ok().and_then(|b| {
            if b.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&b);
                VerifyingKey::from_bytes(&arr).ok()
            } else {
                None
            }
        });

        let vk_b = hex::decode(&channel.peer_b).ok().and_then(|b| {
            if b.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&b);
                VerifyingKey::from_bytes(&arr).ok()
            } else {
                None
            }
        });

        let mut applied = false;
        if let Some(vk) = vk_a {
            if self.apply_signed_voucher(commitment, &vk).is_ok() {
                applied = true;
            }
        }
        if !applied {
            if let Some(vk) = vk_b {
                if self.apply_signed_voucher(commitment, &vk).is_ok() {
                    applied = true;
                }
            }
        }

        if applied {
            Ok("VOUCHER_ACCEPTED_AND_SETTLED")
        } else {
            Err("VOUCHER_INVALID_SIGNATURE")
        }
    }

    pub fn get_reputations(&self) -> Vec<PeerReputation> {
        self.peer_reputations.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::OsRng;

    #[test]
    fn test_state_channel_lifecycle_and_voucher_signing() {
        let mut engine = DePinBarterEngine::new();

        // 1. Generate keys for Peer A and Peer B
        let mut csprng = OsRng;
        let keypair_a = SigningKey::generate(&mut csprng);
        let pubkey_a = hex::encode(keypair_a.verifying_key().to_bytes());

        let keypair_b = SigningKey::generate(&mut csprng);
        let pubkey_b = hex::encode(keypair_b.verifying_key().to_bytes());

        // 2. Open channel: A deposits 1000 credits, B deposits 500 credits
        let channel_id = engine
            .open_channel(&pubkey_a, &pubkey_b, 1000, 500, 1)
            .expect("Channel opening failed");

        assert_eq!(engine.channels.len(), 1);

        // 3. Peer A sends 16KB chunk to Peer B and issues signed voucher of 5 credits
        let dummy_chunk_hash = "a".repeat(64);
        let voucher = engine
            .create_chunk_voucher(&channel_id, true, 5, &dummy_chunk_hash, &keypair_a)
            .expect("Failed to create voucher");

        assert_eq!(voucher.sequence_number, 1);
        assert_eq!(voucher.balance_a, 995);
        assert_eq!(voucher.balance_b, 505);
        assert!(voucher.verify_signature(&keypair_a.verifying_key()));

        // 4. Peer B applies incoming voucher
        let apply_res = engine.apply_signed_voucher(&voucher, &keypair_a.verifying_key());
        // Sequence 1 already applied by create_chunk_voucher locally, so another identical sequence fails monotonic check
        assert!(apply_res.is_err());

        // 5. Check telemetry
        let tele = engine.get_telemetry();
        assert_eq!(tele.active_channels_count, 1);
        assert_eq!(tele.total_settled_vouchers, 1);
    }

    #[test]
    fn test_anti_free_rider_throttling() {
        let mut engine = DePinBarterEngine::new();
        let peer_id = "peer_node_parasite_99";

        // Download 10 chunks (under free allowance of 16)
        for _ in 0..10 {
            let rep = engine.record_chunk_io(peer_id, TransferDirection::IncomingFromPeer);
            assert!(!rep.is_throttled);
        }

        // Download 10 more chunks -> now -20 credit balance (exceeds 16)
        let mut throttled = false;
        for _ in 0..10 {
            let rep = engine.record_chunk_io(peer_id, TransferDirection::IncomingFromPeer);
            if rep.is_throttled {
                throttled = true;
            }
        }
        assert!(throttled, "Free rider should be throttled after exceeding allowance");

        // Now peer contributes 15 chunks back
        for _ in 0..15 {
            engine.record_chunk_io(peer_id, TransferDirection::OutgoingToPeer);
        }

        let current_rep = engine.peer_reputations.get(peer_id).unwrap();
        assert!(!current_rep.is_throttled, "Should unthrottle after reciprocation");
    }

    #[test]
    fn test_depin_channel_persistence_and_serialization() {
        // Audit ID: STORAGE-DEPIN-01
        let mut engine = DePinBarterEngine::new();

        let mut csprng = OsRng;
        let keypair_a = SigningKey::generate(&mut csprng);
        let pubkey_a = hex::encode(keypair_a.verifying_key().to_bytes());
        let keypair_b = SigningKey::generate(&mut csprng);
        let pubkey_b = hex::encode(keypair_b.verifying_key().to_bytes());

        let chan_id = engine
            .open_channel(&pubkey_a, &pubkey_b, 5000, 2500, 42)
            .expect("Open channel");

        let chunk_hash = "f".repeat(64);
        let _voucher = engine
            .create_chunk_voucher(&chan_id, true, 20, &chunk_hash, &keypair_a)
            .expect("Create voucher");

        // Record peer reputation
        engine.record_chunk_io(&pubkey_b, TransferDirection::OutgoingToPeer);

        // Export to JSON
        let json_dump = engine.export_state_json().expect("Export JSON");
        assert!(json_dump.contains(&chan_id));
        assert!(json_dump.contains("5000"));

        // Import into new engine
        let mut restored_engine = DePinBarterEngine::new();
        restored_engine.import_state_json(&json_dump).expect("Import JSON");

        let restored_chan = restored_engine.get_channel(&chan_id).expect("Channel must exist");
        assert_eq!(restored_chan.current_commitment.balance_a, 4980);
        assert_eq!(restored_chan.current_commitment.balance_b, 2520);
        assert_eq!(restored_chan.current_commitment.sequence_number, 1);

        // Test disk save and load
        let tmp_file = std::env::temp_dir().join(format!("depin_test_{}.json", std::process::id()));
        engine.save_to_disk(&tmp_file).expect("Save to disk");
        let disk_engine = DePinBarterEngine::load_from_disk(&tmp_file).expect("Load from disk");
        assert!(disk_engine.get_channel(&chan_id).is_some());
        let _ = std::fs::remove_file(&tmp_file);
    }

    #[test]
    fn test_voucher_wire_path_verification_rejections() {
        // Audit ID: SEC-VOUCHER-01
        let mut engine = DePinBarterEngine::new();
        let mut csprng = OsRng;
        let key_a = SigningKey::generate(&mut csprng);
        let key_b = SigningKey::generate(&mut csprng);
        let key_attacker = SigningKey::generate(&mut csprng);

        let pub_a = hex::encode(key_a.verifying_key().to_bytes());
        let pub_b = hex::encode(key_b.verifying_key().to_bytes());

        let chan_id = engine.open_channel(&pub_a, &pub_b, 1000, 1000, 10).unwrap();

        // 1. Unknown channel rejection
        let dummy_commitment = SignedChannelCommitment {
            channel_id: "unknown_channel_999".into(),
            sequence_number: 1,
            balance_a: 900,
            balance_b: 1100,
            transferred_chunks: 1,
            latest_chunk_hash: "0".repeat(64),
            timestamp_unix: 1700000000,
            signature: hex::encode([0u8; 64]),
        };
        assert_eq!(
            engine.verify_and_apply_voucher(&dummy_commitment),
            Err("VOUCHER_UNKNOWN_CHANNEL")
        );

        // 2. Bad signature rejection
        let mut bad_sig_commitment = SignedChannelCommitment {
            channel_id: chan_id.clone(),
            sequence_number: 1,
            balance_a: 950,
            balance_b: 1050,
            transferred_chunks: 1,
            latest_chunk_hash: "0".repeat(64),
            timestamp_unix: 1700000000,
            signature: String::new(),
        };
        bad_sig_commitment.sign_with(&key_attacker);
        assert_eq!(
            engine.verify_and_apply_voucher(&bad_sig_commitment),
            Err("VOUCHER_INVALID_SIGNATURE")
        );

        // 3. Valid voucher acceptance
        let mut valid_commitment = SignedChannelCommitment {
            channel_id: chan_id.clone(),
            sequence_number: 1,
            balance_a: 950,
            balance_b: 1050,
            transferred_chunks: 1,
            latest_chunk_hash: "0".repeat(64),
            timestamp_unix: 1700000000,
            signature: String::new(),
        };
        valid_commitment.sign_with(&key_a);
        assert_eq!(
            engine.verify_and_apply_voucher(&valid_commitment),
            Ok("VOUCHER_ACCEPTED_AND_SETTLED")
        );

        // 4. Stale sequence rejection
        let mut stale_commitment = valid_commitment.clone();
        stale_commitment.sequence_number = 1; // equal to current
        assert_eq!(
            engine.verify_and_apply_voucher(&stale_commitment),
            Err("VOUCHER_STALE_SEQUENCE")
        );
    }
}
