import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export type TransportMode = 'direct_onion' | 'obfs4_bridge' | 'v2ray_websocket';

export interface TorCircuitRecord {
  streamId: string;
  socksAuth: string;
  purpose: string;
  guardNode: string;
  middleNode: string;
  targetOnion: string;
  circuitHash: string;
  latencyMs: number;
  status: 'ACTIVE' | 'ISOLATED' | 'ROTATED';
  transport: TransportMode;
}

export interface TransportConfig {
  mode: TransportMode;
  protocol: string;
  obfuscationHeader: string;
  tlsFingerprintEmulation: string;
  socksPort: number;
}

export const TRANSPORT_CONFIGS: Record<TransportMode, TransportConfig> = {
  direct_onion: {
    mode: 'direct_onion',
    protocol: 'Tor Onion Routing v3 (Curve25519-Ed25519-SHA3)',
    obfuscationHeader: 'Standard Cell [512-byte RELAY]',
    tlsFingerprintEmulation: 'Tor Native (Strict Cipher Suites)',
    socksPort: 9050,
  },
  obfs4_bridge: {
    mode: 'obfs4_bridge',
    protocol: 'obfs4 Pluggable Transport (ScrambleSuit/ntor)',
    obfuscationHeader: 'Uniform Random Noise (Anti-DPI)',
    tlsFingerprintEmulation: 'Firefox / Chrome TLS Profile JARM',
    socksPort: 9051,
  },
  v2ray_websocket: {
    mode: 'v2ray_websocket',
    protocol: 'V2Ray / Xray WebSocket over TLS (H2/H3)',
    obfuscationHeader: 'Upgrade: websocket • Sec-WebSocket-Key',
    tlsFingerprintEmulation: 'uTLS Chrome 120+ Fingerprint',
    socksPort: 10808,
  },
};

/**
 * Derives a strictly isolated SOCKS5 username/password pair for a specific sub-stream
 * adhering to RFC 1928 and Tor's IsolateSOCKSAuth spec:
 * username = "nexx_iso_" + SHA-256(streamContext || streamNonce)[0..8]
 * password = SHA-256(circuitSeed || streamPurpose)[0..12]
 */
export function deriveIsolatedSocksCredentials(
  streamPurpose: string,
  streamNonce: string,
  circuitSeed: string
): { socksAuth: string; circuitHash: string } {
  const userDigest = sha256(new TextEncoder().encode(`nexx-stream:${streamPurpose}:${streamNonce}`));
  const passDigest = sha256(new TextEncoder().encode(`nexx-pass:${circuitSeed}:${streamPurpose}`));

  const user = `nexx_iso_${bytesToHex(userDigest).slice(0, 8)}`;
  const pass = bytesToHex(passDigest).slice(0, 12);
  const circuitHash = bytesToHex(sha256(new TextEncoder().encode(`${user}:${pass}`))).slice(0, 16);

  return {
    socksAuth: `${user}:${pass}`,
    circuitHash,
  };
}

/**
 * Generates active isolated circuits for core storage, messaging, and attestation subsystems
 */
export function generateIsolatedCircuits(
  transport: TransportMode,
  circuitRotationNonce: number
): TorCircuitRecord[] {
  const seed = `nexxus-tor-session-${circuitRotationNonce}`;
  
  const streamSpecs = [
    {
      id: 'stream_chunk_4102',
      purpose: 'xFTP Чанк #4102 (16 KB Reed-Solomon)',
      guardNode: 'guard_nl_fast1 (AS16276 OVH)',
      middleNode: 'mid_ch_relay (AS13030 SWITCH)',
      targetOnion: 'alice4p8q1m...6zvd.onion:9050',
    },
    {
      id: 'stream_smp_msg_88',
      purpose: 'SMP E2EE Мессенджер (Double Ratchet)',
      guardNode: 'guard_se_anon (AS2119 Telia)',
      middleNode: 'mid_is_nordic (AS51013 1984)',
      targetOnion: 'bob7x9v2k0...8pq2.onion:9050',
    },
    {
      id: 'stream_por_proof_01',
      purpose: 'Proof-of-Retrievability Heartbeat',
      guardNode: 'guard_ro_privacy (AS9009 M247)',
      middleNode: 'mid_de_exitless (AS24940 Hetzner)',
      targetOnion: 'auditor_comm...19aa.onion:9050',
    },
  ];

  return streamSpecs.map((s, idx) => {
    const { socksAuth, circuitHash } = deriveIsolatedSocksCredentials(
      s.purpose,
      `nonce_${circuitRotationNonce}_${idx}`,
      seed
    );

    // Compute deterministic execution latency
    const baseLatency = transport === 'direct_onion' ? 320 : transport === 'obfs4_bridge' ? 370 : 260;
    const jitter = ((circuitHash.charCodeAt(0) + idx * 23) % 65);

    return {
      streamId: s.id,
      socksAuth,
      purpose: s.purpose,
      guardNode: s.guardNode,
      middleNode: s.middleNode,
      targetOnion: s.targetOnion,
      circuitHash,
      latencyMs: baseLatency + jitter,
      status: 'ACTIVE',
      transport,
    };
  });
}
