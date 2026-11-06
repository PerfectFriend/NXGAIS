/**
 * NeXXUs P2P Wire Protocol (xFTP & Swarm Core)
 * Specification v2.0
 * 
 * Frame Format:
 * [0..3]   Magic Bytes: "NEXX" (0x4E 0x45 0x58 0x58)
 * [4]      Version: 0x02
 * [5]      Opcode: 1 byte enum P2POpcode
 * [6..9]   Request ID: 4 bytes uint32 (Big Endian)
 * [10..13] Payload Length: 4 bytes uint32 (Big Endian)
 * [14..45] SHA-256 Checksum: 32 bytes over (Opcode + ReqId + Length + Payload)
 * [46..N]  Payload: Raw bytes / JSON UTF-8
 */

import { sha256 } from '@noble/hashes/sha2.js';

export const P2P_MAGIC = new Uint8Array([0x4e, 0x45, 0x58, 0x58]); // "NEXX"
export const P2P_VERSION = 0x02;
export const P2P_HEADER_SIZE = 46; // 4 magic + 1 ver + 1 op + 4 reqId + 4 len + 32 checksum

export enum P2POpcode {
  PING = 0x01,
  PONG = 0x02,
  NODE_ANNOUNCE = 0x03,
  STORE_CHUNK = 0x04,
  STORE_CHUNK_ACK = 0x05,
  FETCH_CHUNK = 0x06,
  FETCH_CHUNK_RESP = 0x07,
  POR_CHALLENGE = 0x08,
  POR_RESPONSE = 0x09,
  KAD_FIND_NODE = 0x0a,
  KAD_NODES_FOUND = 0x0b,
  SMP_MESSAGE_ENVELOPE = 0x0c,
  ERROR = 0xff,
}

export interface PeerInfo {
  nodeId: string;
  onionAddress: string;
  p2pEndpoint?: string; // e.g. ws://127.0.0.1:3999 or onion
  totalStorageAllocatedGb: number;
  reputationScore: number;
  uptimeSeconds: number;
  softwareVersion: string;
}

export interface WireMessage {
  version: number;
  opcode: P2POpcode;
  requestId: number;
  payload: Uint8Array;
}

export interface StoreChunkPayload {
  fileId: string;
  chunkIndex: number;
  chunkHash: string; // 64 hex characters
  data: Uint8Array;  // Exactly 16,384 bytes (16 KB)
}

export interface StoreChunkAckPayload {
  chunkHash: string;
  accepted: boolean;
  message?: string;
}

export interface FetchChunkPayload {
  chunkHash: string;
}

export interface FetchChunkRespPayload {
  chunkHash: string;
  found: boolean;
  data?: Uint8Array;
}

export interface PorChallengeWirePayload {
  challengeId: string;
  chunkHash: string;
  challengeSeed: string; // 64 hex chars
  deadlineMs: number;
}

export interface PorResponseWirePayload {
  challengeId: string;
  chunkHash: string;
  responseHash: string; // H(chunk_bytes || challengeSeed)
  durationMs: number;
  verified: boolean;
}

export interface KadFindNodeWirePayload {
  targetKey: string; // 64 hex chars
  maxCount?: number;
}

export interface KadNodesFoundWirePayload {
  targetKey: string;
  nodes: {
    nodeId: string;
    onionAddress: string;
    endpoint?: string;
    storageAllocatedGb: number;
    reputation: number;
  }[];
}

/**
 * Serialize a message into raw binary wire frame
 */
export function serializeWireMessage(
  opcode: P2POpcode,
  requestId: number,
  payload: Uint8Array = new Uint8Array(0)
): Uint8Array {
  const totalLength = P2P_HEADER_SIZE + payload.length;
  const frame = new Uint8Array(totalLength);

  // 1. Magic bytes
  frame.set(P2P_MAGIC, 0);

  // 2. Version
  frame[4] = P2P_VERSION;

  // 3. Opcode
  frame[5] = opcode;

  // 4. Request ID (32-bit BE)
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  view.setUint32(6, requestId, false);

  // 5. Payload length (32-bit BE)
  view.setUint32(10, payload.length, false);

  // 6. Compute Checksum over (opcode, reqId, length, payload)
  const checkSource = new Uint8Array(9 + payload.length);
  checkSource[0] = opcode;
  const subView = new DataView(checkSource.buffer, checkSource.byteOffset, checkSource.byteLength);
  subView.setUint32(1, requestId, false);
  subView.setUint32(5, payload.length, false);
  checkSource.set(payload, 9);

  const checksum = sha256(checkSource);
  frame.set(checksum, 14);

  // 7. Copy payload
  if (payload.length > 0) {
    frame.set(payload, P2P_HEADER_SIZE);
  }

  return frame;
}

/**
 * Deserializes a raw binary wire frame and validates Magic and SHA-256 Checksum
 */
export function deserializeWireMessage(raw: Uint8Array): WireMessage {
  if (raw.length < P2P_HEADER_SIZE) {
    throw new Error(`Wire frame too short: ${raw.length} bytes (min ${P2P_HEADER_SIZE})`);
  }

  // Check Magic
  for (let i = 0; i < 4; i++) {
    if (raw[i] !== P2P_MAGIC[i]) {
      throw new Error(`Invalid P2P Magic bytes at index ${i}`);
    }
  }

  const version = raw[4];
  const opcode = raw[5] as P2POpcode;

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const requestId = view.getUint32(6, false);
  const payloadLength = view.getUint32(10, false);

  if (raw.length < P2P_HEADER_SIZE + payloadLength) {
    throw new Error(
      `Incomplete frame: expected ${P2P_HEADER_SIZE + payloadLength} bytes, got ${raw.length}`
    );
  }

  const checksum = raw.slice(14, 46);
  const payload = raw.slice(P2P_HEADER_SIZE, P2P_HEADER_SIZE + payloadLength);

  // Verify Checksum
  const checkSource = new Uint8Array(9 + payload.length);
  checkSource[0] = opcode;
  const subView = new DataView(checkSource.buffer, checkSource.byteOffset, checkSource.byteLength);
  subView.setUint32(1, requestId, false);
  subView.setUint32(5, payload.length, false);
  checkSource.set(payload, 9);

  const expectedChecksum = sha256(checkSource);
  for (let i = 0; i < 32; i++) {
    if (checksum[i] !== expectedChecksum[i]) {
      throw new Error(`Wire frame checksum mismatch! Frame may be corrupted or tampered.`);
    }
  }

  return {
    version,
    opcode,
    requestId,
    payload,
  };
}

/**
 * JSON serialization helper for structured message payloads
 */
export function encodeJsonPayload<T>(obj: T): Uint8Array {
  const jsonStr = JSON.stringify(obj);
  return new TextEncoder().encode(jsonStr);
}

export function decodeJsonPayload<T>(payload: Uint8Array): T {
  const jsonStr = new TextDecoder().decode(payload);
  return JSON.parse(jsonStr) as T;
}

/**
 * Encodes a STORE_CHUNK binary frame:
 * Metadata (JSON header length 2 bytes + JSON header) followed by raw 16KB bytes
 */
export function encodeStoreChunk(
  fileId: string,
  chunkIndex: number,
  chunkHash: string,
  chunkData: Uint8Array
): Uint8Array {
  const meta = { fileId, chunkIndex, chunkHash };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const result = new Uint8Array(2 + metaBytes.length + chunkData.length);

  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);
  view.setUint16(0, metaBytes.length, false);
  result.set(metaBytes, 2);
  result.set(chunkData, 2 + metaBytes.length);

  return result;
}

export function decodeStoreChunk(payload: Uint8Array): StoreChunkPayload {
  if (payload.length < 2) {
    throw new Error('STORE_CHUNK payload too small');
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const metaLen = view.getUint16(0, false);
  const metaBytes = payload.slice(2, 2 + metaLen);
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  const data = payload.slice(2 + metaLen);

  return {
    fileId: meta.fileId,
    chunkIndex: meta.chunkIndex,
    chunkHash: meta.chunkHash,
    data,
  };
}

// Aliases and payload encode/decode helpers
export const encodeP2PFrame = serializeWireMessage;
export const decodeP2PFrame = deserializeWireMessage;
export const encodeStoreChunkPayload = encodeStoreChunk;
export const decodeStoreChunkPayload = decodeStoreChunk;

export function encodeStoreChunkAckPayload(ack: StoreChunkAckPayload): Uint8Array {
  return encodeJsonPayload(ack);
}

export function decodeStoreChunkAckPayload(raw: Uint8Array): StoreChunkAckPayload {
  return decodeJsonPayload<StoreChunkAckPayload>(raw);
}
