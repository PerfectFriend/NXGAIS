use ed25519_dalek::SigningKey;
use nexxus_storage::{
    ChannelState, DePinBarterEngine, SignedChannelCommitment, TransferDirection,
};
use rand::rngs::OsRng;

#[test]
fn test_depin_multichannel_settlement_and_vouchers() {
    let mut engine = DePinBarterEngine::new();
    let mut csprng = OsRng;

    let key_node1 = SigningKey::generate(&mut csprng);
    let key_node2 = SigningKey::generate(&mut csprng);
    let key_node3 = SigningKey::generate(&mut csprng);

    let pk1 = hex::encode(key_node1.verifying_key().to_bytes());
    let pk2 = hex::encode(key_node2.verifying_key().to_bytes());
    let pk3 = hex::encode(key_node3.verifying_key().to_bytes());

    // 1. Open channels: Node1 <-> Node2, Node1 <-> Node3
    let chan12 = engine.open_channel(&pk1, &pk2, 10000, 5000, 101).unwrap();
    let chan13 = engine.open_channel(&pk1, &pk3, 20000, 20000, 102).unwrap();

    assert_eq!(engine.get_channels().len(), 2);

    // 2. Issue 50 sequential chunk vouchers in channel 1-2
    let mut last_voucher = SignedChannelCommitment {
        channel_id: chan12.clone(),
        sequence_number: 0,
        balance_a: 10000,
        balance_b: 5000,
        transferred_chunks: 0,
        latest_chunk_hash: String::new(),
        timestamp_unix: 0,
        signature: String::new(),
    };

    for i in 1..=50 {
        let chunk_hash = format!("{:064x}", i);
        last_voucher = engine
            .create_chunk_voucher(&chan12, true, 10, &chunk_hash, &key_node1)
            .unwrap();
        assert_eq!(last_voucher.sequence_number, i);
        assert!(last_voucher.verify_signature(&key_node1.verifying_key()));
    }

    assert_eq!(last_voucher.balance_a, 10000 - (50 * 10)); // 9500
    assert_eq!(last_voucher.balance_b, 5000 + (50 * 10)); // 5500
    assert_eq!(last_voucher.transferred_chunks, 50);

    // 3. Initiate closing
    let deadline = engine.initiate_close(&chan12).unwrap();
    assert!(deadline > 0);

    let chan_obj = engine.get_channels().into_iter().find(|c| c.channel_id == chan12).unwrap();
    match chan_obj.state {
        ChannelState::Closing { dispute_deadline_unix } => {
            assert_eq!(dispute_deadline_unix, deadline);
        }
        _ => panic!("Expected closing state"),
    }

    // 4. Barter reputation checks
    for _ in 0..100 {
        engine.record_chunk_io(&pk2, TransferDirection::OutgoingToPeer);
    }
    for _ in 0..80 {
        engine.record_chunk_io(&pk2, TransferDirection::IncomingFromPeer);
    }

    let rep2 = engine.get_reputations().into_iter().find(|r| r.peer_id == pk2).unwrap();
    assert_eq!(rep2.chunks_served, 100);
    assert_eq!(rep2.chunks_downloaded, 80);
    assert_eq!(rep2.credit_balance, 20);
    assert!(!rep2.is_throttled);
    assert!(rep2.reputation_score > 0.9);

    let tele = engine.get_telemetry();
    assert_eq!(tele.active_channels_count, 1); // chan13 is still Active, chan12 is Closing
    assert_eq!(tele.total_settled_vouchers, 50);
}
