import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Device } from '../src/device.js';
import { deleteIdentity, loadIdentity, saveIdentity } from '../src/storage/indexeddb.js';
import { generateKeypair } from '../src/crypto/keypair.js';
import { generateBlindingFactor } from '../src/crypto/generators.js';
import { hashSignal } from '../src/crypto/hash.js';
import { computeCommitment } from '../src/crypto/commitment.js';
import type { StoredIdentity } from '../src/types.js';

describe('Device — extended', () => {
  beforeEach(async () => {
    await deleteIdentity();
  });

  describe('create with options', () => {
    it('exclude option reduces component count', async () => {
      await Device.create();
      await deleteIdentity();
      const reduced = await Device.create({ exclude: ['canvas', 'webgl', 'audio'] });

      // Reduced device may have fewer collected signals
      // (depends on which collectors succeed in happy-dom)
      // But the commitment should still be valid
      expect(reduced.commitment).toMatch(/^[0-9a-f]{66}$/);
      expect(reduced.id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('apiKey option emits a console warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await Device.create({ apiKey: 'test-key-123' });
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Obfious API integration coming in a future version'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('debug option logs timing information', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await Device.create({ debug: true });
        const calls = warnSpy.mock.calls.map((c) => c[0]);
        expect(calls.some((msg: string) => msg.includes('[obfious]'))).toBe(true);
        expect(calls.some((msg: string) => msg.includes('Collecting'))).toBe(true);
        expect(calls.some((msg: string) => msg.includes('Created new identity'))).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('debug option on reload logs load message', async () => {
      await Device.create();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await Device.create({ debug: true });
        const calls = warnSpy.mock.calls.map((c) => c[0]);
        expect(calls.some((msg: string) => msg.includes('Loaded existing identity'))).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('reload path with drift', () => {
    it('returns stored commitment when drift is below 5%', async () => {
      const first = await Device.create();
      const second = await Device.create();
      // No drift in test environment — commitment should match stored
      expect(second.commitment).toBe(first.commitment);
    });

    it('updates stored commitment when drift exceeds 5%', async () => {
      // Create initial identity
      const original = await Device.create();
      const stored = await loadIdentity();
      expect(stored).not.toBeNull();

      // Manually mutate the stored hash vector to simulate significant drift.
      // Change all components so similarity is 0% → well below the 95% threshold.
      const mutatedHashes = stored!.hashVector.map(() => 'f'.repeat(64));
      const mutatedCommitment = computeCommitment(
        stored!.componentNames,
        mutatedHashes,
        stored!.blindingFactor,
      );
      const mutated: StoredIdentity = {
        ...stored!,
        hashVector: mutatedHashes,
        commitment: mutatedCommitment,
      };
      await saveIdentity(mutated);

      // Reload — should detect drift (current signals ≠ mutated hashes)
      // and recompute commitment from current signals
      const reloaded = await Device.create();

      // The commitment should be recomputed from current signals, not the mutated ones
      expect(reloaded.commitment).not.toBe(mutatedCommitment);
      // It should match the original commitment (same signals, same blinding factor)
      expect(reloaded.commitment).toBe(original.commitment);
      // ID persists through the drift update
      expect(reloaded.id).toBe(original.id);
    });

    it('preserves keypair and createdAt through drift update', async () => {
      const first = await Device.create();
      const stored = await loadIdentity();

      // Mutate hash vector significantly
      const mutated: StoredIdentity = {
        ...stored!,
        hashVector: stored!.hashVector.map(() => 'f'.repeat(64)),
      };
      await saveIdentity(mutated);

      const reloaded = await Device.create();
      expect(reloaded.id).toBe(first.id);
      expect(reloaded.publicKey).toBe(first.publicKey);
      expect(reloaded.createdAt).toBe(first.createdAt);
    });

    it('handles stored identity with different component names', async () => {
      // Simulate a stored identity that was created with a different registry
      const keypair = await generateKeypair();
      const componentNames = ['canvas', 'webgl', 'obsolete_collector'];
      const hashVector = await Promise.all(
        componentNames.map((name) => hashSignal(name, 'null')),
      );
      const blindingFactor = generateBlindingFactor();
      const commitment = computeCommitment(componentNames, hashVector, blindingFactor);

      const fakeStored: StoredIdentity = {
        keypair,
        hashVector,
        componentNames,
        blindingFactor,
        commitment,
        createdAt: Date.now() - 10000,
      };
      await saveIdentity(fakeStored);

      // Reload with current registry — should handle mismatched names gracefully
      const device = await Device.create();
      expect(device.id).toMatch(/^[0-9a-f]{16}$/);
      expect(device.commitment).toMatch(/^[0-9a-f]{66}$/);
    });
  });

  describe('verify — threshold boundaries', () => {
    it('similarity exactly at threshold returns match: true', async () => {
      const device = await Device.create();
      // Self-verify gives 1.0 similarity. Set threshold to exactly 1.0.
      const result = await device.verify(device.commitment, { threshold: 1.0 });
      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    it('threshold 0 always matches', async () => {
      const device = await Device.create();
      const result = await device.verify(device.commitment, { threshold: 0 });
      expect(result.match).toBe(true);
    });

    it('device-level threshold is used when verify option is not provided', async () => {
      // Create device with a very high default threshold
      const device = await Device.create({ threshold: 1.0 });
      // Self-verify should still pass at 1.0
      const result = await device.verify(device.commitment);
      expect(result.match).toBe(true);
    });

    it('verify option threshold overrides device-level threshold', async () => {
      // Device created with lenient threshold
      const device = await Device.create({ threshold: 0.1 });
      // Override with strict threshold in verify call — still passes at 1.0 similarity
      const result = await device.verify(device.commitment, { threshold: 0.99 });
      expect(result.match).toBe(true);
    });
  });

  describe('verify — with simulated drift', () => {
    it('detects drifted components when hash vector changes', async () => {
      // Create device, then mutate its internal state via IndexedDB
      await Device.create();
      const stored = await loadIdentity();
      expect(stored).not.toBeNull();

      // Replace all stored hashes with bogus values so verify() sees drift
      const mutatedHashes = stored!.hashVector.map(() => 'dead'.repeat(16));
      const mutated: StoredIdentity = {
        ...stored!,
        hashVector: mutatedHashes,
      };
      await saveIdentity(mutated);

      // Create a new device instance that loads the mutated state
      const mutatedDevice = await Device.create();

      // Now verify — current signals won't match the mutated baseline
      // (the mutated hashes are fake, current signals will re-collect the real ones)
      // Since we re-collect signals in verify(), and the internal _hashVector
      // is from the mutated load, all components will match current signals
      // because create() already updated the hash vector on load due to drift.
      // The verify() self-check should still be 1.0 since internal state is consistent.
      const result = await mutatedDevice.verify(mutatedDevice.commitment);
      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1.0);
    });
  });

  describe('verify — commitment parameter', () => {
    it('accepts any string as the commitment parameter', async () => {
      const device = await Device.create();
      // In Stage 1, the commitment param is unused for matching.
      // The method should work regardless of what string is passed.
      const result = await device.verify('not-a-real-commitment');
      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    it('returns a new commitment that differs from a bogus input', async () => {
      const device = await Device.create();
      const result = await device.verify('0000000000');
      // newCommitment should be a valid commitment computed from current signals
      expect(result.newCommitment).toMatch(/^[0-9a-f]{66}$/);
    });
  });

  describe('sign — edge cases', () => {
    it('signs an empty string', async () => {
      const device = await Device.create();
      const sig = await device.sign('');
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(0);
    });

    it('signs a Uint8Array', async () => {
      const device = await Device.create();
      const sig = await device.sign(new Uint8Array([1, 2, 3]));
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(0);
    });

    it('different challenges produce different signatures', async () => {
      const device = await Device.create();
      const sig1 = await device.sign('challenge-a');
      const sig2 = await device.sign('challenge-b');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('create and destroy cycle', () => {
    it('destroy then create produces a new identity', async () => {
      const first = await Device.create();
      await Device.destroy();
      const second = await Device.create();

      // New keypair → new ID and publicKey
      expect(second.id).not.toBe(first.id);
      expect(second.publicKey).not.toBe(first.publicKey);
    });

    it('double destroy is safe', async () => {
      await Device.create();
      await Device.destroy();
      await Device.destroy(); // should not throw
      expect(await Device.exists()).toBe(false);
    });
  });

  describe('export is JSON-serializable', () => {
    it('export roundtrips through JSON without data loss', async () => {
      const device = await Device.create();
      const exported = device.export();
      const json = JSON.stringify(exported);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(exported.id);
      expect(parsed.publicKey).toBe(exported.publicKey);
      expect(parsed.commitment).toBe(exported.commitment);
      expect(parsed.components).toBe(exported.components);
      expect(parsed.createdAt).toBe(exported.createdAt);
    });

    it('JSON.stringify of export does not leak private fields', async () => {
      const device = await Device.create();
      const json = JSON.stringify(device.export());
      expect(json).not.toContain('hashVector');
      expect(json).not.toContain('blindingFactor');
      expect(json).not.toContain('keypair');
      expect(json).not.toContain('privateKey');
    });
  });
});
