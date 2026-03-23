import { describe, it, expect } from 'vitest';
import { computeCommitment, decodeCommitment } from '../../src/crypto/commitment.js';
import { deriveGenerator, generateBlindingFactor } from '../../src/crypto/generators.js';

describe('computeCommitment', () => {
  const componentNames = ['canvas', 'webgl', 'audio'];
  const hashVector = [
    'a'.repeat(64),
    'b'.repeat(64),
    'c'.repeat(64),
  ];
  const blindingFactor = '1'.repeat(64);

  it('returns a 66-character hex string (compressed P-256 point)', () => {
    const commitment = computeCommitment(componentNames, hashVector, blindingFactor);
    expect(commitment).toMatch(/^[0-9a-f]{66}$/);
  });

  it('starts with 02 or 03 (compressed point prefix)', () => {
    const commitment = computeCommitment(componentNames, hashVector, blindingFactor);
    expect(commitment.slice(0, 2)).toMatch(/^0[23]$/);
  });

  it('is deterministic — same inputs produce the same commitment', () => {
    const a = computeCommitment(componentNames, hashVector, blindingFactor);
    const b = computeCommitment(componentNames, hashVector, blindingFactor);
    expect(a).toBe(b);
  });

  it('different blinding factors produce different commitments', () => {
    const bf1 = '1'.repeat(64);
    const bf2 = '2'.repeat(64);
    const c1 = computeCommitment(componentNames, hashVector, bf1);
    const c2 = computeCommitment(componentNames, hashVector, bf2);
    expect(c1).not.toBe(c2);
  });

  it('different hash vectors produce different commitments', () => {
    const hv1 = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const hv2 = ['d'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const c1 = computeCommitment(componentNames, hv1, blindingFactor);
    const c2 = computeCommitment(componentNames, hv2, blindingFactor);
    expect(c1).not.toBe(c2);
  });

  it('can be decoded back to a valid point', () => {
    const commitment = computeCommitment(componentNames, hashVector, blindingFactor);
    const point = decodeCommitment(commitment);
    expect(point).toBeDefined();
    // Re-encode and compare
    expect(point.toHex(true)).toBe(commitment);
  });
});

describe('deriveGenerator', () => {
  it('returns a deterministic point for the same label', () => {
    const a = deriveGenerator('canvas');
    const b = deriveGenerator('canvas');
    expect(a.toHex(true)).toBe(b.toHex(true));
  });

  it('returns different points for different labels', () => {
    const canvas = deriveGenerator('canvas');
    const webgl = deriveGenerator('webgl');
    expect(canvas.toHex(true)).not.toBe(webgl.toHex(true));
  });

  it('blinding generator is different from component generators', () => {
    const blinding = deriveGenerator('blinding');
    const canvas = deriveGenerator('canvas');
    expect(blinding.toHex(true)).not.toBe(canvas.toHex(true));
  });
});

describe('generateBlindingFactor', () => {
  it('returns a 64-character hex string', () => {
    const bf = generateBlindingFactor();
    expect(bf).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates different values each time (random)', () => {
    const a = generateBlindingFactor();
    const b = generateBlindingFactor();
    expect(a).not.toBe(b);
  });
});
