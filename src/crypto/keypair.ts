import { base64urlEncode } from '../utils/encoding.js';
import { hexEncode } from '../utils/encoding.js';
import { ObfiousError } from '../types.js';

/**
 * Generate an ECDSA P-256 keypair using WebCrypto.
 * The private key is marked as non-extractable — it can be used for signing
 * but never read by JavaScript. This is the strongest client-side key protection
 * available in browsers.
 *
 * @returns A CryptoKeyPair with extractable=false private key
 * @throws {ObfiousError} If WebCrypto is unavailable
 *
 * @example
 * ```ts
 * const keypair = await generateKeypair();
 * ```
 */
export async function generateKeypair(): Promise<CryptoKeyPair> {
  if (!crypto?.subtle) {
    throw new ObfiousError(
      'WebCrypto API is required but not available in this environment. ' +
      'Obfious requires a browser with crypto.subtle support.',
    );
  }

  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // non-extractable
    ['sign', 'verify'],
  );
}

/**
 * Export the public key as a base64url-encoded string (raw format).
 *
 * @param publicKey - The CryptoKey to export
 * @returns Base64url-encoded raw public key (65 bytes uncompressed)
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  return base64urlEncode(raw);
}

/**
 * Derive a short device ID from a public key.
 * Takes the first 16 hex characters of SHA-256(raw public key bytes).
 *
 * @param publicKey - The CryptoKey to derive an ID from
 * @returns 16-character hex string
 */
export async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return hexEncode(hash).slice(0, 16);
}

/**
 * Sign a challenge with the device's private key using ECDSA with SHA-256.
 *
 * @param privateKey - The non-extractable private CryptoKey
 * @param data - The data to sign (string or Uint8Array)
 * @returns Base64url-encoded ECDSA signature
 *
 * @example
 * ```ts
 * const signature = await sign(keypair.privateKey, 'server-challenge-123');
 * ```
 */
export async function sign(
  privateKey: CryptoKey,
  data: string | Uint8Array,
): Promise<string> {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    bytes as unknown as ArrayBuffer,
  );
  return base64urlEncode(signature);
}

/**
 * Verify an ECDSA signature against a public key.
 * Primarily used internally for testing and demo purposes.
 *
 * @param publicKey - The CryptoKey to verify against
 * @param signature - Raw signature bytes
 * @param data - The original signed data
 * @returns true if the signature is valid
 */
export async function verify(
  publicKey: CryptoKey,
  signature: ArrayBuffer,
  data: string | Uint8Array,
): Promise<boolean> {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signature,
    bytes as unknown as ArrayBuffer,
  );
}
