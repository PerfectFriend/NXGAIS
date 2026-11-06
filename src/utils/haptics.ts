/**
 * Tactical Haptic Feedback Engine for NeXXus Mobile Sovereign Client.
 * Provides micro-vibrations for touches, sends, locks, and swipe interactions.
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'lock';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate([35, 20, 35]);
        break;
      case 'success':
        navigator.vibrate([15, 40, 20]);
        break;
      case 'warning':
        navigator.vibrate([30, 40, 30, 40, 50]);
        break;
      case 'lock':
        navigator.vibrate([50, 60, 50]);
        break;
    }
  } catch {
    // Graceful no-op if vibration is blocked by browser policies
  }
}
