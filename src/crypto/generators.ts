import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { hexEncode } from '../utils/encoding.js';

type ProjectivePoint = typeof p256.ProjectivePoint.BASE;

// Cache derived generators to avoid recomputation
const generatorCache = new Map<string, ProjectivePoint>();

/**
 * Hash a label string to a scalar in the P-256 field using SHA-256.
 * The output is reduced modulo the curve order to ensure it's a valid scalar.
 *
 * @param label - The label string to hash
 * @returns A bigint scalar suitable for point multiplication
 */
function hashToScalar(label: string): bigint {
  const hash = sha256(new TextEncoder().encode(label));
  const hex = hexEncode(hash);
  const n = BigInt('0x' + hex);
  // Reduce mod curve order. If result is 0, use 1 (astronomically unlikely).
  const scalar = n % p256.CURVE.n;
  return scalar === 0n ? 1n : scalar;
}

/**
 * Derive a deterministic generator point for a given label.
 * Uses a nothing-up-my-sleeve construction: `SHA-256("obfious-generator:" + label)`
 * is mapped to a scalar, then multiplied by the base point.
 *
 * Each unique label produces a unique generator point. Results are cached.
 *
 * @param label - Component name (e.g., "canvas", "webgl") or "blinding"
 * @returns A point on the P-256 curve
 *
 * @example
 * ```ts
 * const G_canvas = deriveGenerator("canvas");
 * const H = deriveGenerator("blinding");
 * ```
 */
export function deriveGenerator(label: string): ProjectivePoint {
  const cached = generatorCache.get(label);
  if (cached) return cached;

  const scalar = hashToScalar('obfious-generator:' + label);
  const point = p256.ProjectivePoint.BASE.multiply(scalar);
  generatorCache.set(label, point);
  return point;
}

/**
 * Generate a random 256-bit blinding factor as a hex string.
 * The value is reduced mod the curve order to ensure it's a valid scalar.
 *
 * @returns Hex-encoded 256-bit scalar
 */
export function generateBlindingFactor(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = hexEncode(bytes);
  const n = BigInt('0x' + hex);
  const scalar = n % p256.CURVE.n;
  const reduced = scalar === 0n ? 1n : scalar;
  return reduced.toString(16).padStart(64, '0');
}
