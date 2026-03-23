import { p256 } from '@noble/curves/p256';
import { deriveGenerator } from './generators.js';
import { hexEncode, hexDecode } from '../utils/encoding.js';

/**
 * Compute a Pedersen commitment over a hash vector.
 *
 * The commitment is: C = (h_0 * G_0) + (h_1 * G_1) + ... + (h_n * G_n) + (r * H)
 *
 * Where:
 * - h_i are signal hash values mapped to scalars (first 32 bytes of SHA-256, big-endian mod curve order)
 * - G_i are deterministic generator points derived from component names
 * - r is the random blinding factor
 * - H is the blinding generator derived from "blinding"
 *
 * The result is a compressed P-256 point (33 bytes → 66 hex chars).
 *
 * @param componentNames - Array of component names defining generator order
 * @param hashVector - Parallel array of hex-encoded SHA-256 hashes
 * @param blindingFactor - Hex-encoded 256-bit blinding scalar
 * @returns Hex-encoded compressed point (66 hex characters)
 *
 * @example
 * ```ts
 * const commitment = computeCommitment(
 *   ['canvas', 'webgl', 'audio'],
 *   ['a1b2...', 'c3d4...', 'e5f6...'],
 *   'deadbeef...'
 * );
 * ```
 */
export function computeCommitment(
  componentNames: string[],
  hashVector: string[],
  blindingFactor: string,
): string {
  const H = deriveGenerator('blinding');
  const r = hashHexToScalar(blindingFactor);

  // Start with r * H (blinding term)
  let commitment = H.multiply(r);

  // Add h_i * G_i for each component
  for (let i = 0; i < componentNames.length; i++) {
    const name = componentNames[i]!;
    const hash = hashVector[i]!;
    const G_i = deriveGenerator(name);
    const h_i = hashHexToScalar(hash);
    commitment = commitment.add(G_i.multiply(h_i));
  }

  // Encode as compressed point (33 bytes)
  const compressed = commitment.toRawBytes(true);
  return hexEncode(compressed);
}

/**
 * Convert a hex-encoded hash to a scalar in the P-256 field.
 * Takes the full 32 bytes, interprets as big-endian integer, reduces mod curve order.
 */
function hashHexToScalar(hex: string): bigint {
  // Ensure we have a full 64-char hex string (32 bytes)
  const padded = hex.padStart(64, '0').slice(0, 64);
  const n = BigInt('0x' + padded);
  const scalar = n % p256.CURVE.n;
  return scalar === 0n ? 1n : scalar;
}

/**
 * Decode a hex-encoded compressed point. Useful for verification.
 *
 * @param hex - 66-character hex string (compressed P-256 point)
 * @returns The decoded projective point
 */
export function decodeCommitment(hex: string): typeof p256.ProjectivePoint.BASE {
  const bytes = hexDecode(hex);
  return p256.ProjectivePoint.fromHex(bytes);
}
