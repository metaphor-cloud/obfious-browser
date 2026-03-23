import { hexEncode } from '../utils/encoding.js';

/**
 * Hash a signal component using SHA-256. The input is `name:value` to ensure
 * that different component names with the same value produce different hashes.
 *
 * @param name - The component name (e.g., "canvas", "webgl")
 * @param value - The signal value. If the collector returned null, pass "null".
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```ts
 * const hash = await hashSignal("canvas", "data:image/png;base64,...");
 * // "a1b2c3d4..."
 * ```
 */
export async function hashSignal(name: string, value: string): Promise<string> {
  const input = new TextEncoder().encode(name + ':' + value);
  const hash = await crypto.subtle.digest('SHA-256', input);
  return hexEncode(hash);
}
