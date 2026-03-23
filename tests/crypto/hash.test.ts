import { describe, it, expect } from 'vitest';
import { hashSignal } from '../../src/crypto/hash.js';

describe('hashSignal', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await hashSignal('canvas', 'some-canvas-data');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable — same input always produces the same hash', async () => {
    const a = await hashSignal('canvas', 'fingerprint-data');
    const b = await hashSignal('canvas', 'fingerprint-data');
    expect(a).toBe(b);
  });

  it('isolates different component names with the same value', async () => {
    const canvas = await hashSignal('canvas', 'shared-value');
    const webgl = await hashSignal('webgl', 'shared-value');
    expect(canvas).not.toBe(webgl);
  });

  it('produces different hashes for different values with the same name', async () => {
    const a = await hashSignal('canvas', 'value-a');
    const b = await hashSignal('canvas', 'value-b');
    expect(a).not.toBe(b);
  });

  it('handles empty string values', async () => {
    const hash = await hashSignal('test', '');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles "null" string value (used when collector returns null)', async () => {
    const hash = await hashSignal('audio', 'null');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
