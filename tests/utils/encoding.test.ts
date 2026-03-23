import { describe, it, expect } from 'vitest';
import { hexEncode, hexDecode, base64urlEncode, base64urlDecode } from '../../src/utils/encoding.js';

describe('hexEncode', () => {
  it('encodes bytes to lowercase hex', () => {
    expect(hexEncode(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });

  it('zero-pads single-digit values', () => {
    expect(hexEncode(new Uint8Array([0x00, 0x01, 0x0f]))).toBe('00010f');
  });

  it('handles empty input', () => {
    expect(hexEncode(new Uint8Array([]))).toBe('');
  });

  it('accepts ArrayBuffer input', () => {
    const buf = new Uint8Array([0xca, 0xfe]).buffer;
    expect(hexEncode(buf)).toBe('cafe');
  });
});

describe('hexDecode', () => {
  it('decodes hex to bytes', () => {
    const bytes = hexDecode('deadbeef');
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('handles empty string', () => {
    expect(hexDecode('')).toEqual(new Uint8Array([]));
  });

  it('roundtrips with hexEncode', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    expect(hexDecode(hexEncode(original))).toEqual(original);
  });
});

describe('base64url', () => {
  it('encodes without +, /, or = characters', () => {
    // Bytes that would produce +, /, = in standard base64
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
    const encoded = base64urlEncode(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('roundtrips correctly', () => {
    const original = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
    const decoded = base64urlDecode(base64urlEncode(original));
    expect(decoded).toEqual(original);
  });

  it('handles empty input', () => {
    expect(base64urlEncode(new Uint8Array([]))).toBe('');
    expect(base64urlDecode('')).toEqual(new Uint8Array([]));
  });

  it('handles non-multiple-of-3 lengths (padding edge cases)', () => {
    // 1 byte -> 2 base64 chars (no padding in base64url)
    const one = base64urlEncode(new Uint8Array([0xff]));
    expect(base64urlDecode(one)).toEqual(new Uint8Array([0xff]));

    // 2 bytes -> 3 base64 chars
    const two = base64urlEncode(new Uint8Array([0xff, 0xfe]));
    expect(base64urlDecode(two)).toEqual(new Uint8Array([0xff, 0xfe]));
  });
});
