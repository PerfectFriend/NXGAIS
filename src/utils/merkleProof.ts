import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export interface MerkleProof {
  siblingHashes: string[];
  isRightSibling: boolean[];
}

export interface MerkleTree {
  root: string;
  leafCount: number;
  layers: string[][];
}

export interface PorChallenge {
  challengeId: string;
  fileRootHash: string;
  chunkIndex: number;
  challengeSeedHex: string;
  timestamp: number;
  deadlineMs: number;
}

export interface PorProofResponse {
  challengeId: string;
  chunkIndex: number;
  chunkLeafHash: string;
  proofResponse: string; // H(chunk || challengeSeed)
  merkleProof: MerkleProof;
  respondedInMs: number;
  isValid: boolean;
}

/**
 * Hashes two child hashes together: H(left || right)
 */
function hashPair(left: string, right: string): string {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return bytesToHex(sha256(combined));
}

/**
 * Builds a complete Merkle Tree from an array of chunk leaf hashes (SHA-256)
 */
export function buildMerkleTree(leafHashes: string[]): MerkleTree {
  if (leafHashes.length === 0) {
    const emptyRoot = bytesToHex(sha256(utf8ToBytes('empty_nexxus_tree')));
    return { root: emptyRoot, leafCount: 0, layers: [[emptyRoot]] };
  }

  const layers: string[][] = [];
  layers.push([...leafHashes]);

  let currentLayer = layers[0];
  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      // If odd number of nodes, duplicate the last one as per standard Bitcoin/Merkle tree
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      nextLayer.push(hashPair(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = currentLayer[0];
  return {
    root,
    leafCount: leafHashes.length,
    layers,
  };
}

/**
 * Generates an audit proof (Merkle branch) for a specific chunk leaf index
 */
export function getMerkleProof(layers: string[][], leafIndex: number): MerkleProof {
  const siblingHashes: string[] = [];
  const isRightSibling: boolean[] = [];

  let idx = leafIndex;
  for (let l = 0; l < layers.length - 1; l++) {
    const currentLayer = layers[l];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    if (siblingIdx < currentLayer.length) {
      siblingHashes.push(currentLayer[siblingIdx]);
      isRightSibling.push(!isRight); // Sibling is on the right if current is left
    } else {
      // Duplicated leaf when odd
      siblingHashes.push(currentLayer[idx]);
      isRightSibling.push(true);
    }

    idx = Math.floor(idx / 2);
  }

  return { siblingHashes, isRightSibling };
}

/**
 * Verifies a Merkle proof branch against the expected root hash
 */
export function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProof,
  expectedRoot: string
): boolean {
  let current = leafHash;

  for (let i = 0; i < proof.siblingHashes.length; i++) {
    const sibling = proof.siblingHashes[i];
    const siblingIsOnRight = proof.isRightSibling[i];

    if (siblingIsOnRight) {
      current = hashPair(current, sibling);
    } else {
      current = hashPair(sibling, current);
    }
  }

  return current.toLowerCase() === expectedRoot.toLowerCase();
}

/**
 * Generates a random cryptographic Proof-of-Retrievability (PoR) challenge
 * Auditor sends random seed s in {0,1}^256 and chunk index i
 */
export function generatePorChallenge(fileRootHash: string, chunkCount: number): PorChallenge {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const challengeSeedHex = bytesToHex(randomBytes);
  
  // Use CSPRNG to pick chunk index uniformly
  const indexBuf = new Uint32Array(1);
  crypto.getRandomValues(indexBuf);
  const chunkIndex = indexBuf[0] % Math.max(1, chunkCount);

  return {
    challengeId: `por_ch_${Date.now()}_${chunkIndex}`,
    fileRootHash,
    chunkIndex,
    challengeSeedHex,
    timestamp: Date.now(),
    deadlineMs: 3000, // Strict 3 seconds timeout for onion transport
  };
}

/**
 * Computes PoR challenge response: H(chunk_data || challengeSeed)
 * Node must return proofResponse and Merkle branch to root within deadline
 */
export function computePorResponse(
  chunkBytes: Uint8Array,
  challenge: PorChallenge,
  merkleTree: MerkleTree,
  startedAt: number
): PorProofResponse {
  const seedBytes = hexToBytes(challenge.challengeSeedHex);
  const payload = new Uint8Array(chunkBytes.length + seedBytes.length);
  payload.set(chunkBytes, 0);
  payload.set(seedBytes, chunkBytes.length);

  const proofResponse = bytesToHex(sha256(payload));
  const chunkLeafHash = bytesToHex(sha256(chunkBytes));
  const merkleProof = getMerkleProof(merkleTree.layers, challenge.chunkIndex);
  const respondedInMs = Date.now() - startedAt;

  const isValidMerkle = verifyMerkleProof(chunkLeafHash, merkleProof, challenge.fileRootHash);
  const isValidTime = respondedInMs <= challenge.deadlineMs;

  return {
    challengeId: challenge.challengeId,
    chunkIndex: challenge.chunkIndex,
    chunkLeafHash,
    proofResponse,
    merkleProof,
    respondedInMs,
    isValid: isValidMerkle && isValidTime,
  };
}

/**
 * Auditor verifies the PoR response
 */
export function verifyAuditorPor(
  challenge: PorChallenge,
  response: PorProofResponse,
  expectedLeafHash: string
): { verified: boolean; reason?: string } {
  if (response.challengeId !== challenge.challengeId) {
    return { verified: false, reason: 'Mismatched Challenge ID' };
  }

  if (response.respondedInMs > challenge.deadlineMs) {
    return { verified: false, reason: `Response timeout exceeded (${response.respondedInMs}ms > ${challenge.deadlineMs}ms)` };
  }

  if (response.chunkLeafHash.toLowerCase() !== expectedLeafHash.toLowerCase()) {
    return { verified: false, reason: 'Chunk leaf hash does not match file manifest' };
  }

  const isMerkleValid = verifyMerkleProof(response.chunkLeafHash, response.merkleProof, challenge.fileRootHash);
  if (!isMerkleValid) {
    return { verified: false, reason: 'Invalid Merkle branch proof' };
  }

  return { verified: true };
}
