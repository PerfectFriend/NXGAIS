/**
 * Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) utilities
 * Replaces Math.random() with standard Web Crypto API (crypto.getRandomValues).
 * Compatible with modern browsers and Node.js environments.
 */

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  // Fallback for Node.js environments if crypto is not globally mounted
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  return nodeCrypto.webcrypto as Crypto;
}

/**
 * Generates cryptographically secure random bytes
 */
export function secureRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

/**
 * Returns a cryptographically secure integer in range [0, maxExclusive)
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  
  // Unbiased rejection sampling for uint32
  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);

  let val: number;
  do {
    getCrypto().getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);

  return val % maxExclusive;
}

/**
 * Returns a cryptographically secure random float in range [0, 1)
 */
export function secureRandomFloat(): number {
  const buf = new Uint32Array(2);
  getCrypto().getRandomValues(buf);
  // 53 bits of randomness for standard double precision
  const mantissa = (buf[0] >>> 5) * 67108864 + (buf[1] >>> 6);
  return mantissa / 9007199254740992;
}

/**
 * Returns a secure random hex string of given byte length
 */
export function secureRandomHex(byteLength: number): string {
  const bytes = secureRandomBytes(byteLength);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
