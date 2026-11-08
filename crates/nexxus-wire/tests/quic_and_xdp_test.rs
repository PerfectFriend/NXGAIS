//! Tests for QUIC multi-stream framing and eBPF XDP filter simulation

use bytes::{Bytes, BytesMut};
use nexxus_wire::{
    ebpf_xdp::{EbpfXdpEngine, XdpFilterRule},
    quic_transport::{QuicDatagram, QuicPacketType, QuicTransportCodec},
};

#[test]
fn test_quic_multi_stream_framing() {
    let chunk_payload = vec![0x3Cu8; 1024];
    let datagram = QuicDatagram {
        packet_type: QuicPacketType::ZeroRtt,
        connection_id: 0xCAFEBABE11223344,
        packet_number: 100,
        stream_id: 4,
        is_stream_fin: true,
        stream_offset: 4096,
        payload: Bytes::from(chunk_payload.clone()),
    };

    let mut encoded = BytesMut::new();
    QuicTransportCodec::encode_datagram(&datagram, &mut encoded);

    let decoded = QuicTransportCodec::decode_datagram(&mut encoded)
        .expect("Valid decode")
        .expect("Complete packet");

    assert_eq!(decoded.packet_type, QuicPacketType::ZeroRtt);
    assert_eq!(decoded.connection_id, 0xCAFEBABE11223344);
    assert_eq!(decoded.stream_id, 4);
    assert!(decoded.is_stream_fin);
    assert_eq!(decoded.stream_offset, 4096);
    assert_eq!(decoded.payload.as_ref(), &chunk_payload[..]);
}

#[test]
fn test_ebpf_xdp_packet_filter_rules() {
    let rule = XdpFilterRule {
        target_port: 3999,
        max_packet_rate_per_sec: 50_000,
        block_unknown_magic: true,
        drop_fragmented_ip: true,
    };

    // Valid wire frame starts with 'NEXX'
    let valid_wire = b"NEXX\x02\x10\x00\x00\x00\x01";
    assert!(EbpfXdpEngine::simulate_filter_packet(&rule, valid_wire));

    // Valid QUIC frame starts with 'NQUC'
    let valid_quic = b"NQUC\x01\x00\x00";
    assert!(EbpfXdpEngine::simulate_filter_packet(&rule, valid_quic));

    // Sybil or scanner packet starting with random garbage
    let malicious = b"GET /admin HTTP/1.1";
    assert!(!EbpfXdpEngine::simulate_filter_packet(&rule, malicious));

    // Verify generated C source contains BPF helper macro and target port
    let c_code = EbpfXdpEngine::generate_xdp_c_source(&rule);
    assert!(c_code.contains("SEC(\"xdp_nexxus_firewall\")"));
    assert!(c_code.contains("#define NEXXUS_WIRE_PORT 3999"));
}
