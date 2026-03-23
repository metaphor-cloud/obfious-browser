import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  exportPublicKey,
  deriveDeviceId,
  sign,
  verify,
} from '../../src/crypto/keypair.js';
import { base64urlDecode } from '../../src/utils/encoding.js';

describe('generateKeypair', () => {
  it('generates an ECDSA P-256 keypair', async () => {
    const keypair = await generateKeypair();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
    expect(keypair.publicKey.algorithm).toMatchObject({ name: 'ECDSA' });
    expect(keypair.privateKey.algorithm).toMatchObject({ name: 'ECDSA' });
  });

  it('marks the private key as non-extractable', async () => {
    const keypair = await generateKeypair();
    expect(keypair.privateKey.extractable).toBe(false);
  });

  it('allows sign and verify usages', async () => {
    const keypair = await generateKeypair();
    expect(keypair.privateKey.usages).toContain('sign');
    expect(keypair.publicKey.usages).toContain('verify');
  });
});

describe('exportPublicKey', () => {
  it('returns a base64url-encoded string', async () => {
    const keypair = await generateKeypair();
    const exported = await exportPublicKey(keypair.publicKey);
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);
    // base64url should not contain +, /, or =
    expect(exported).not.toMatch(/[+/=]/);
  });

  it('returns the same value for the same key', async () => {
    const keypair = await generateKeypair();
    const a = await exportPublicKey(keypair.publicKey);
    const b = await exportPublicKey(keypair.publicKey);
    expect(a).toBe(b);
  });
});

describe('deriveDeviceId', () => {
  it('returns a 16-character hex string', async () => {
    const keypair = await generateKeypair();
    const id = await deriveDeviceId(keypair.publicKey);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same key', async () => {
    const keypair = await generateKeypair();
    const a = await deriveDeviceId(keypair.publicKey);
    const b = await deriveDeviceId(keypair.publicKey);
    expect(a).toBe(b);
  });

  it('produces different IDs for different keys', async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const id1 = await deriveDeviceId(kp1.publicKey);
    const id2 = await deriveDeviceId(kp2.publicKey);
    expect(id1).not.toBe(id2);
  });
});

describe('sign and verify', () => {
  it('signs a challenge and produces a base64url string', async () => {
    const keypair = await generateKeypair();
    const signature = await sign(keypair.privateKey, 'test-challenge');
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
    expect(signature).not.toMatch(/[+/=]/);
  });

  it('produces a valid signature that verifies with the public key', async () => {
    const keypair = await generateKeypair();
    const challenge = 'server-challenge-abc123';
    const sig = await sign(keypair.privateKey, challenge);
    const sigBytes = base64urlDecode(sig);
    const valid = await verify(keypair.publicKey, sigBytes.buffer, challenge);
    expect(valid).toBe(true);
  });

  it('fails verification with wrong data', async () => {
    const keypair = await generateKeypair();
    const sig = await sign(keypair.privateKey, 'original-data');
    const sigBytes = base64urlDecode(sig);
    const valid = await verify(keypair.publicKey, sigBytes.buffer, 'tampered-data');
    expect(valid).toBe(false);
  });

  it('different challenges produce different signatures', async () => {
    const keypair = await generateKeypair();
    const sig1 = await sign(keypair.privateKey, 'challenge-1');
    const sig2 = await sign(keypair.privateKey, 'challenge-2');
    expect(sig1).not.toBe(sig2);
  });

  it('accepts Uint8Array input', async () => {
    const keypair = await generateKeypair();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const sig = await sign(keypair.privateKey, data);
    const sigBytes = base64urlDecode(sig);
    const valid = await verify(keypair.publicKey, sigBytes.buffer, data);
    expect(valid).toBe(true);
  });
});
