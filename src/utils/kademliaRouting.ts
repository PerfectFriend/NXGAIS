/**
 * NeXXUs Protocol - Kademlia DHT Real Routing Engine
 * Specification v2.0
 * 
 * - 256-bit Node IDs (SHA-256 derived or Ed25519 public keys)
 * - 256 k-buckets with bucket size k = 20
 * - Concurrency alpha = 3
 * - XOR metric: distance(A, B) = A ^ B
 * - Proof-of-Work (PoW) Sybil mitigation
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export const K_BUCKET_SIZE = 20;
export const ALPHA_CONCURRENCY = 3;
export const ID_BITS = 256;
export const ID_BYTES = 32;

export interface KademliaContact {
  nodeId: string;       // 64-character hex string (256-bit)
  onionAddress: string; // 56 base32 chars + .onion
  endpoint?: string;    // ws://host:port or onion
  lastSeenMs: number;
  reputation: number;   // 0.0 - 1.0
  storageAllocatedGb: number;
}

export interface LookupState {
  targetKey: string;
  closestNodes: KademliaContact[];
  queriedNodes: Set<string>;
  activeQueries: Set<string>;
  completed: boolean;
}

/**
 * Computes bitwise XOR distance between two 32-byte (64 hex char) keys.
 * Returns a 32-byte Uint8Array.
 */
export function computeXorDistance(keyA: string, keyB: string): Uint8Array {
  const bytesA = hexToBytes(normalizeKey(keyA));
  const bytesB = hexToBytes(normalizeKey(keyB));
  const distance = new Uint8Array(ID_BYTES);

  for (let i = 0; i < ID_BYTES; i++) {
    distance[i] = bytesA[i] ^ bytesB[i];
  }

  return distance;
}

/**
 * Returns the index of the highest differing bit between two 256-bit keys (0 to 255).
 * If keys are identical, returns -1.
 */
export function getLeadingZeroBits(distance: Uint8Array): number {
  for (let i = 0; i < distance.length; i++) {
    const byte = distance[i];
    if (byte !== 0) {
      return i * 8 + Math.clz32(byte) - 24;
    }
  }
  return -1; // Exact match (distance is 0)
}

/**
 * Normalizes any string into a valid 64-character hex key (256-bit).
 * If the input is already a 64-char hex string, it is returned lowercase.
 * Otherwise, SHA-256 hash of the string is computed.
 */
export function normalizeKey(key: string): string {
  const clean = key.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(clean)) {
    return clean;
  }
  const hash = sha256(new TextEncoder().encode(clean));
  return bytesToHex(hash);
}

/**
 * Compares two XOR distances.
 * Returns negative if distA < distB, positive if distA > distB, 0 if equal.
 */
export function compareDistances(distA: Uint8Array, distB: Uint8Array): number {
  for (let i = 0; i < ID_BYTES; i++) {
    if (distA[i] < distB[i]) return -1;
    if (distA[i] > distB[i]) return 1;
  }
  return 0;
}

/**
 * K-Bucket implementation with LRU replacement policy
 */
export class KBucket {
  public contacts: KademliaContact[] = [];
  public readonly bucketIndex: number;

  constructor(bucketIndex: number) {
    this.bucketIndex = bucketIndex;
  }

  /**
   * Add or update contact in bucket according to Kademlia LRU policy.
   * Returns true if accepted, false if bucket is full of alive nodes.
   */
  public addOrUpdate(contact: KademliaContact): boolean {
    const existingIndex = this.contacts.findIndex(c => c.nodeId === contact.nodeId);

    if (existingIndex !== -1) {
      // Move to tail (most recently seen)
      this.contacts.splice(existingIndex, 1);
      this.contacts.push({ ...contact, lastSeenMs: Date.now() });
      return true;
    }

    if (this.contacts.length < K_BUCKET_SIZE) {
      this.contacts.push({ ...contact, lastSeenMs: Date.now() });
      return true;
    }

    // Bucket is full: caller may ping the head (least recently seen)
    return false;
  }

  public remove(nodeId: string): void {
    this.contacts = this.contacts.filter(c => c.nodeId !== nodeId);
  }

  public getOldestContact(): KademliaContact | null {
    return this.contacts.length > 0 ? this.contacts[0] : null;
  }
}

/**
 * Production Kademlia Routing Table containing 256 k-buckets
 */
export class KademliaRoutingTable {
  public readonly localNodeId: string;
  private readonly buckets: KBucket[];

  constructor(localNodeId: string) {
    this.localNodeId = normalizeKey(localNodeId);
    this.buckets = Array.from({ length: ID_BITS }, (_, i) => new KBucket(i));
  }

  /**
   * Finds bucket index for a given contact or key relative to local node
   */
  public getBucketIndex(targetKey: string): number {
    const normKey = normalizeKey(targetKey);
    if (normKey === this.localNodeId) return 0;
    const dist = computeXorDistance(this.localNodeId, normKey);
    const leadingZeros = getLeadingZeroBits(dist);
    // Bucket index from 0 to 255: 255 - leadingZeros
    return Math.max(0, Math.min(255, 255 - leadingZeros));
  }

  /**
   * Adds or updates a contact in the appropriate bucket
   */
  public addContact(contact: KademliaContact): boolean {
    const normId = normalizeKey(contact.nodeId);
    if (normId === this.localNodeId) {
      return false; // Don't route to self
    }

    const normalizedContact = { ...contact, nodeId: normId };
    const bucketIdx = this.getBucketIndex(normId);
    return this.buckets[bucketIdx].addOrUpdate(normalizedContact);
  }

  /**
   * Updates last seen timestamp for an existing contact
   */
  public updateLastSeen(nodeId: string): void {
    const normId = normalizeKey(nodeId);
    const bucketIdx = this.getBucketIndex(normId);
    const existing = this.buckets[bucketIdx].contacts.find(c => c.nodeId === normId);
    if (existing) {
      this.buckets[bucketIdx].addOrUpdate(existing);
    }
  }

  /**
   * Removes a dead or unresponsive contact
   */
  public removeContact(nodeId: string): void {
    const normId = normalizeKey(nodeId);
    const bucketIdx = this.getBucketIndex(normId);
    this.buckets[bucketIdx].remove(normId);
  }

  /**
   * Returns up to count closest contacts to targetKey
   */
  public findClosest(targetKey: string, count: number = K_BUCKET_SIZE): KademliaContact[] {
    const normTarget = normalizeKey(targetKey);
    const allContacts: KademliaContact[] = [];

    for (const b of this.buckets) {
      allContacts.push(...b.contacts);
    }

    if (allContacts.length === 0) return [];

    // Sort by XOR distance to targetKey
    const withDist = allContacts.map(contact => ({
      contact,
      dist: computeXorDistance(contact.nodeId, normTarget),
    }));

    withDist.sort((a, b) => compareDistances(a.dist, b.dist));

    return withDist.slice(0, count).map(item => item.contact);
  }

  /**
   * Total active contacts across all buckets
   */
  public totalContacts(): number {
    return this.buckets.reduce((sum, b) => sum + b.contacts.length, 0);
  }

  /**
   * Returns non-empty buckets for diagnostic telemetry
   */
  public getBucketsSummary(): { index: number; count: number; contacts: KademliaContact[] }[] {
    return this.buckets
      .filter(b => b.contacts.length > 0)
      .map(b => ({
        index: b.bucketIndex,
        count: b.contacts.length,
        contacts: [...b.contacts],
      }));
  }
}

/**
 * Proof-of-Work (PoW) sybil protection for node announcement in DHT.
 * A node must provide a nonce such that:
 * SHA-256(nodeId || onionAddress || nonce) starts with difficulty leading zero bits.
 */
export function verifyNodePow(
  nodeId: string,
  onionAddress: string,
  nonce: number,
  difficultyBits: number = 16
): boolean {
  const normId = normalizeKey(nodeId);
  const data = new TextEncoder().encode(`${normId}:${onionAddress}:${nonce}`);
  const hash = sha256(data);
  const leadingZeros = getLeadingZeroBits(hash);
  return leadingZeros >= difficultyBits;
}

/**
 * Mine a valid PoW nonce for node registration (typically < 100ms in JavaScript for 16 bits)
 */
export function mineNodePow(
  nodeId: string,
  onionAddress: string,
  difficultyBits: number = 16,
  maxIterations: number = 1_000_000
): { nonce: number; hash: string; iterations: number } | null {
  const normId = normalizeKey(nodeId);
  for (let nonce = 0; nonce < maxIterations; nonce++) {
    const data = new TextEncoder().encode(`${normId}:${onionAddress}:${nonce}`);
    const hash = sha256(data);
    if (getLeadingZeroBits(hash) >= difficultyBits) {
      return {
        nonce,
        hash: bytesToHex(hash),
        iterations: nonce + 1,
      };
    }
  }
  return null;
}
