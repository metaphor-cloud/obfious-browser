import { describe, it, expect, beforeEach } from 'vitest';
import { Device } from '../src/device.js';
import { deleteIdentity } from '../src/storage/indexeddb.js';
import { base64urlDecode } from '../src/utils/encoding.js';
import { verify } from '../src/crypto/keypair.js';
import { ObfiousError } from '../src/types.js';

describe('Device', () => {
  beforeEach(async () => {
    await deleteIdentity();
  });

  describe('create', () => {
    it('returns a device with all expected properties', async () => {
      const device = await Device.create();
      expect(device.id).toMatch(/^[0-9a-f]{16}$/);
      expect(typeof device.publicKey).toBe('string');
      expect(device.publicKey.length).toBeGreaterThan(0);
      expect(device.commitment).toMatch(/^[0-9a-f]{66}$/);
      expect(typeof device.components).toBe('number');
      expect(device.components).toBeGreaterThanOrEqual(0);
      expect(typeof device.createdAt).toBe('number');
      expect(device.createdAt).toBeGreaterThan(0);
    });

    it('persists to IndexedDB — second create loads same id and publicKey', async () => {
      const first = await Device.create();
      const second = await Device.create();
      expect(second.id).toBe(first.id);
      expect(second.publicKey).toBe(first.publicKey);
    });

    it('preserves createdAt across loads', async () => {
      const first = await Device.create();
      const second = await Device.create();
      expect(second.createdAt).toBe(first.createdAt);
    });
  });

  describe('exists', () => {
    it('returns false before any device is created', async () => {
      const exists = await Device.exists();
      expect(exists).toBe(false);
    });

    it('returns true after a device is created', async () => {
      await Device.create();
      const exists = await Device.exists();
      expect(exists).toBe(true);
    });
  });

  describe('destroy', () => {
    it('removes the identity from storage', async () => {
      await Device.create();
      expect(await Device.exists()).toBe(true);

      await Device.destroy();
      expect(await Device.exists()).toBe(false);
    });

    it('is safe to call when no device exists', async () => {
      // Should not throw
      await Device.destroy();
      expect(await Device.exists()).toBe(false);
    });
  });

  describe('sign', () => {
    it('produces a base64url-encoded ECDSA signature', async () => {
      const device = await Device.create();
      const sig = await device.sign('test-challenge');
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(0);
      expect(sig).not.toMatch(/[+/=]/);
    });

    it('signature is valid against the device public key', async () => {
      const device = await Device.create();
      const challenge = 'server-challenge-xyz';
      const sig = await device.sign(challenge);

      // Import the public key for verification
      const pubKeyBytes = base64urlDecode(device.publicKey);
      const pubKey = await crypto.subtle.importKey(
        'raw',
        pubKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify'],
      );

      const sigBytes = base64urlDecode(sig);
      const valid = await verify(pubKey, sigBytes.buffer, challenge);
      expect(valid).toBe(true);
    });
  });

  describe('export', () => {
    it('returns only safe-to-store fields', async () => {
      const device = await Device.create();
      const exported = device.export();

      expect(exported).toEqual({
        id: device.id,
        publicKey: device.publicKey,
        commitment: device.commitment,
        components: device.components,
        createdAt: device.createdAt,
      });
    });

    it('does not contain signal data, hash vectors, or blinding factor', async () => {
      const device = await Device.create();
      const exported = device.export() as Record<string, unknown>;

      expect(exported).not.toHaveProperty('hashVector');
      expect(exported).not.toHaveProperty('blindingFactor');
      expect(exported).not.toHaveProperty('keypair');
      expect(exported).not.toHaveProperty('componentNames');
    });

    it('has exactly the DeviceExport keys', async () => {
      const device = await Device.create();
      const exported = device.export();
      const keys = Object.keys(exported).sort();
      expect(keys).toEqual(['commitment', 'components', 'createdAt', 'id', 'publicKey']);
    });
  });

  describe('verify', () => {
    it('self-verify returns match true and similarity 1.0', async () => {
      const device = await Device.create();
      const result = await device.verify(device.commitment);
      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1.0);
      expect(result.driftedComponents).toBe(0);
      expect(result.newCommitment).toBe(device.commitment);
    });

    it('returns a valid newCommitment hex string', async () => {
      const device = await Device.create();
      const result = await device.verify(device.commitment);
      expect(result.newCommitment).toMatch(/^[0-9a-f]{66}$/);
    });

    it('respects threshold option — high threshold with full match passes', async () => {
      const device = await Device.create();
      const result = await device.verify(device.commitment, { threshold: 0.99 });
      // Self-verify should be 1.0 similarity, so even 0.99 threshold passes
      expect(result.match).toBe(true);
    });
  });

  describe('WebCrypto unavailable', () => {
    it('throws ObfiousError when crypto.subtle is missing', async () => {
      const originalCrypto = globalThis.crypto;
      try {
        Object.defineProperty(globalThis, 'crypto', {
          value: { subtle: undefined },
          configurable: true,
        });
        await expect(Device.create()).rejects.toThrow(ObfiousError);
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          configurable: true,
        });
      }
    });
  });
});
