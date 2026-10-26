/**
 * DeviceDetector — Single utility for platform detection.
 *
 * Computed once at boot (first import), exposed as a frozen readonly object.
 * All game scenes can `import { DeviceInfo } from './DeviceDetector'` and branch on
 * `DeviceInfo.isMobile` without touching shared classes or introducing dependencies.
 *
 * Detection heuristic:
 *  1. navigator.userAgent regex for common mobile/tablet tokens.
 *  2. Primary pointer type `coarse` (touch screens).
 *  3. navigator.maxTouchPoints > 0 as a fallback.
 *
 * The result is computed once and frozen — subsequent reads are essentially free.
 */

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;

  // 1. User-Agent string test
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);

  // 2. Pointer media query (coarse = touch)
  let coarsePointer = false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  }

  // 3. Touch points fallback
  const hasTouchPoints = navigator.maxTouchPoints > 0;

  return mobileUA || (coarsePointer && hasTouchPoints);
}

export interface DeviceDetectorInfo {
  /** True on touch/mobile devices, false on desktop. Computed once at boot. */
  readonly isMobile: boolean;
}

/**
 * Singleton device info — import this anywhere to branch on platform.
 *
 * Usage:
 * ```ts
 * import { DeviceInfo } from '../utils/DeviceDetector';
 * if (DeviceInfo.isMobile) { setupMobileControls(); }
 * ```
 */
export const DeviceInfo: DeviceDetectorInfo = Object.freeze({
  isMobile: detectMobile()
});
