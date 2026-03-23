/**
 * Encode a byte array to a hex string.
 *
 * @param bytes - The byte array to encode
 * @returns Lowercase hex string
 *
 * @example
 * ```ts
 * hexEncode(new Uint8Array([0xde, 0xad])) // "dead"
 * ```
 */
export function hexEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < u8.length; i++) {
    hex += (u8[i]! >>> 0).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Decode a hex string to a Uint8Array.
 *
 * @param hex - Hex string to decode (must be even length)
 * @returns Decoded bytes
 */
export function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encode a byte array to a base64url string (no padding).
 *
 * @param bytes - The byte array to encode
 * @returns Base64url-encoded string without padding
 *
 * @example
 * ```ts
 * base64urlEncode(new Uint8Array([1, 2, 3])) // "AQID"
 * ```
 */
export function base64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a base64url string to a Uint8Array.
 *
 * @param str - Base64url-encoded string
 * @returns Decoded bytes
 */
export function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
