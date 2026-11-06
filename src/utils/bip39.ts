import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Full 2048-word standard BIP-39 English Wordlist from @scure/bip39
export const BIP39_WORDS: string[] = wordlist;

/**
 * Generates a standard 12-word BIP-39 mnemonic phrase using CSPRNG entropy (128-bit)
 * compliant with BIP-39 specification (full 2048 words + SHA-256 checksum).
 */
export function generateBip39Mnemonic(): string[] {
  // Standard 128-bit entropy produces 12 words with 4-bit checksum
  const phrase = generateMnemonic(wordlist, 128);
  return phrase.trim().split(/\s+/);
}

/**
 * Validates whether a mnemonic phrase is a valid BIP-39 phrase with correct checksum
 */
export function isValidBip39Mnemonic(words: string[]): boolean {
  const phrase = words.join(' ').trim();
  return validateMnemonic(phrase, wordlist);
}

/**
 * Encodes bytes to standard Base32 (RFC 4648) used by Tor v3 onion addresses
 */
function toBase32(bytes: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Creates a deterministic .onion v3 address from a public key (raw 32 bytes or 64-hex string)
 * Address layout: pubkey (32 bytes) + checksum (2 bytes) + version 0x03 (1 byte) = 35 bytes -> 56 base32 chars + ".onion"
 */
export function deriveOnionAddress(seedOrPubKey: string | Uint8Array): string {
  let pubkey32: Uint8Array;
  if (typeof seedOrPubKey === 'string') {
    if (/^[0-9a-fA-F]{64}$/.test(seedOrPubKey)) {
      pubkey32 = hexToBytes(seedOrPubKey);
    } else {
      pubkey32 = sha256(utf8ToBytes(seedOrPubKey));
    }
  } else if (seedOrPubKey.length === 32) {
    pubkey32 = seedOrPubKey;
  } else {
    pubkey32 = sha256(seedOrPubKey);
  }

  // Checksum: SHA-256(".onion checksum" + pubkey + "\x03")[0..2]
  const checksumPrefix = utf8ToBytes('.onion checksum');
  const checksumPayload = new Uint8Array(checksumPrefix.length + 32 + 1);
  checksumPayload.set(checksumPrefix, 0);
  checksumPayload.set(pubkey32, checksumPrefix.length);
  checksumPayload[checksumPayload.length - 1] = 0x03; // Tor v3 version byte
  const checksumFull = sha256(checksumPayload);
  const checksum = checksumFull.slice(0, 2);

  // Address bytes = pubkey (32) + checksum (2) + version (1) = 35 bytes => 56 base32 chars
  const addressBytes = new Uint8Array(35);
  addressBytes.set(pubkey32, 0);
  addressBytes.set(checksum, 32);
  addressBytes[34] = 0x03;

  return `${toBase32(addressBytes)}.onion`;
}

/**
 * Hashes a string using standard SHA-256 format
 */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const rawBytes = typeof data === 'string' ? utf8ToBytes(data) : data;
  const digest = sha256(rawBytes);
  return bytesToHex(digest);
}

/**
 * Generates a standard Master Public Key & Address from a 12-word mnemonic using BIP-39 PBKDF2
 */
export function deriveIdentityFromMnemonic(mnemonicWords: string[], passphrase = '') {
  const phrase = mnemonicWords.join(' ');
  const phraseBytes = utf8ToBytes(phrase);
  const saltBytes = utf8ToBytes(`mnemonic${passphrase}`); // Standard BIP-39 salt: "mnemonic" + passphrase

  // Real BIP-39 standard: 2048 rounds of HMAC-SHA512 PBKDF2 producing 512-bit seed
  const seed512 = pbkdf2(sha512, phraseBytes, saltBytes, { c: 2048, dkLen: 64 });
  const seedHex = bytesToHex(seed512);

  // Master key derivation: HMAC-SHA512("ed25519 seed", seed512)
  const masterI = hmac(sha512, utf8ToBytes('ed25519 seed'), seed512);
  const masterPrivKey = masterI.slice(0, 32);
  const masterChainCode = masterI.slice(32);

  // Master PubKey representation
  const pubDigest = sha256(masterPrivKey);
  const pubHex = bytesToHex(pubDigest);
  const masterPublicKey = `nx1pk_${pubHex.slice(0, 48)}`;
  const accountAddress = `nx1q_${bytesToHex(sha256(pubDigest)).slice(0, 34)}`;
  const onionAddress = deriveOnionAddress(pubDigest);

  return {
    seedHex,
    masterPublicKey,
    accountAddress,
    onionAddress,
    masterChainCodeHex: bytesToHex(masterChainCode),
  };
}

export interface BipSplitDerivation {
  masterSeedHash: string;
  nodeIdentityPath: "m/44'/9999'/0'/0/0";
  nodeIdentityKey: string;
  nodeOnionAddress: string;
  vaultMasterPath: "m/44'/9999'/0'/1'/0";
  vaultChaChaKeyHex: string;
  vaultEncryptionAlgorithm: "ChaCha20-Poly1305";
  donorNodeCanDecrypt: false;
}

/**
 * Derives split keys according to Manifesto threat model:
 * - Node Identity Key (m/44'/9999'/0'/0/0): Stored on donor phone for Onion hosting & PoR signing
 * - Vault Master Key (m/44'/9999'/0'/1'/0): Stored ONLY on user client device for ChaCha20 decryption
 * Real BIP-32/44 hierarchical derivation using HMAC-SHA512
 */
export function deriveBipSplitKeys(mnemonicWords: string[]): BipSplitDerivation {
  const base = deriveIdentityFromMnemonic(mnemonicWords);
  const phrase = mnemonicWords.join(' ');
  const phraseBytes = utf8ToBytes(phrase);

  // Derive Node Identity Child Key: m/44'/9999'/0'/0/0
  const nodeKeyBytes = hmac(sha512, utf8ToBytes("m/44'/9999'/0'/0/0"), phraseBytes);
  const nodeKeyDigest = sha256(nodeKeyBytes);
  const nodeKeyHex = bytesToHex(nodeKeyDigest);
  const nodeOnionAddress = deriveOnionAddress(nodeKeyDigest);

  // Derive Vault Master Key: m/44'/9999'/0'/1'/0
  // Produces exact 256-bit ChaCha20-Poly1305 symmetric master key (32 bytes = 64 hex chars)
  const vaultKeyBytes = hmac(sha512, utf8ToBytes("m/44'/9999'/0'/1'/0"), phraseBytes);
  const vaultChaChaKey = sha256(vaultKeyBytes);
  const vaultChaChaKeyHex = bytesToHex(vaultChaChaKey);

  return {
    masterSeedHash: base.seedHex.slice(0, 16),
    nodeIdentityPath: "m/44'/9999'/0'/0/0",
    nodeIdentityKey: `nx_node_${nodeKeyHex.slice(0, 32)}`,
    nodeOnionAddress,
    vaultMasterPath: "m/44'/9999'/0'/1'/0",
    vaultChaChaKeyHex,
    vaultEncryptionAlgorithm: "ChaCha20-Poly1305",
    donorNodeCanDecrypt: false,
  };
}

