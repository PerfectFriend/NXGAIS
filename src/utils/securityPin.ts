import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export interface PinAuthResult {
  valid: boolean;
  isPanic: boolean;
  cooldownSeconds?: number;
}

const PIN_STORAGE_KEY = 'nexxus_pin_hash';
const PANIC_PIN_STORAGE_KEY = 'nexxus_panic_pin_hash';
const SALT_STORAGE_KEY = 'nexxus_pin_salt';
const ONBOARDED_KEY = 'nexxus_is_onboarded';
const FAILED_ATTEMPTS_KEY = 'nexxus_pin_failed_attempts';
const COOLDOWN_UNTIL_KEY = 'nexxus_pin_cooldown_until';

/**
 * Deterministically hashes a PIN with a salt
 */
export function hashPin(pin: string, salt: string): string {
  const combined = utf8ToBytes(`nexxus_pin_guard:${salt}:${pin}`);
  return bytesToHex(sha256(combined));
}

/**
 * Checks if the user has completed onboarding
 */
export function isUserOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

/**
 * Sets up primary and panic PINs
 */
export function setupPins(primaryPin: string, panicPin: string): void {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const primaryHash = hashPin(primaryPin, salt);
  const panicHash = hashPin(panicPin, salt);

  localStorage.setItem(SALT_STORAGE_KEY, salt);
  localStorage.setItem(PIN_STORAGE_KEY, primaryHash);
  localStorage.setItem(PANIC_PIN_STORAGE_KEY, panicHash);
  localStorage.setItem(ONBOARDED_KEY, 'true');
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
  localStorage.removeItem(COOLDOWN_UNTIL_KEY);
}

/**
 * Resets user onboarding and authentication state to allow switching accounts or logging out
 */
export function resetUserOnboarding(): void {
  localStorage.removeItem(ONBOARDED_KEY);
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PANIC_PIN_STORAGE_KEY);
  localStorage.removeItem(SALT_STORAGE_KEY);
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
  localStorage.removeItem(COOLDOWN_UNTIL_KEY);
  localStorage.removeItem('nexxus_identity');
}

/**
 * Calculates exponential doubling cooldown for wrong PIN attempts:
 * 1st fail: 5 seconds
 * 2nd fail: 10 seconds
 * 3rd fail: 20 seconds
 * 4th fail: 40 seconds
 * 5th fail: 80 seconds...
 */
export function calculateCooldownSeconds(failures: number): number {
  if (failures <= 0) return 0;
  return 5 * Math.pow(2, failures - 1);
}

/**
 * Gets remaining cooldown seconds, or 0 if none
 */
export function getRemainingCooldownSeconds(): number {
  const cooldownUntil = parseInt(localStorage.getItem(COOLDOWN_UNTIL_KEY) || '0', 10);
  const now = Date.now();
  if (cooldownUntil > now) {
    return Math.ceil((cooldownUntil - now) / 1000);
  }
  return 0;
}

/**
 * Verifies entered PIN against primary and panic PINs
 */
export function verifyPin(enteredPin: string): PinAuthResult {
  const salt = localStorage.getItem(SALT_STORAGE_KEY) || 'default_salt';
  const primaryHash = localStorage.getItem(PIN_STORAGE_KEY);
  const panicHash = localStorage.getItem(PANIC_PIN_STORAGE_KEY);

  // If not configured, allow fallback pin 1234
  if (!primaryHash) {
    if (enteredPin === '1234') {
      return { valid: true, isPanic: false };
    }
    if (enteredPin === '9999') {
      return { valid: true, isPanic: true };
    }
  }

  const enteredHash = hashPin(enteredPin, salt);

  // Check Panic PIN first (Duress unlock)
  if (panicHash && enteredHash === panicHash) {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(COOLDOWN_UNTIL_KEY);
    return { valid: true, isPanic: true };
  }

  // Check Primary PIN (Normal unlock)
  if (primaryHash && enteredHash === primaryHash) {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(COOLDOWN_UNTIL_KEY);
    return { valid: true, isPanic: false };
  }

  // Wrong PIN entered: increment failures and apply doubling cooldown
  const currentFailures = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10) + 1;
  localStorage.setItem(FAILED_ATTEMPTS_KEY, currentFailures.toString());

  const cooldownSecs = calculateCooldownSeconds(currentFailures);
  const cooldownUntil = Date.now() + cooldownSecs * 1000;
  localStorage.setItem(COOLDOWN_UNTIL_KEY, cooldownUntil.toString());

  return {
    valid: false,
    isPanic: false,
    cooldownSeconds: cooldownSecs,
  };
}
