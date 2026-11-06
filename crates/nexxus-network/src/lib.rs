//! NeXXUs P2P Network Engine
//!
//! High-performance Kademlia DHT routing, Gossipsub v1.2 pub-sub mesh,
//! and native Tor Onion v3 routing via embedded Arti.

pub mod arti_tor;
pub mod gossipsub;
pub mod kademlia;

pub use arti_tor::{ArtiTorManager, TorBackendMode, TorServiceStatus};
pub use gossipsub::{GossipMessage, GossipSubEngine, Topic};
pub use kademlia::{KadPeerInfo, KBucket, NodeId, RoutingTable};
