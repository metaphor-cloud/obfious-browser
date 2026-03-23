import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadIdentity,
  saveIdentity,
  identityExists,
  deleteIdentity,
} from '../../src/storage/indexeddb.js';
import { generateKeypair } from '../../src/crypto/keypair.js';
import type { StoredIdentity } from '../../src/types.js';

async function createMockIdentity(): Promise<StoredIdentity> {
  const keypair = await generateKeypair();
  return {
    keypair,
    hashVector: ['aa'.repeat(32), 'bb'.repeat(32)],
    componentNames: ['canvas', 'webgl'],
    blindingFactor: 'cc'.repeat(32),
    commitment: '02' + 'dd'.repeat(32),
    createdAt: Date.now(),
  };
}

describe('IndexedDB storage', () => {
  beforeEach(async () => {
    // Clean up before each test
    await deleteIdentity();
  });

  it('loadIdentity returns null when no identity exists', async () => {
    const result = await loadIdentity();
    expect(result).toBeNull();
  });

  it('identityExists returns false when no identity exists', async () => {
    const exists = await identityExists();
    expect(exists).toBe(false);
  });

  it('saveIdentity then loadIdentity roundtrip', async () => {
    const identity = await createMockIdentity();
    await saveIdentity(identity);

    const loaded = await loadIdentity();
    expect(loaded).not.toBeNull();
    expect(loaded!.hashVector).toEqual(identity.hashVector);
    expect(loaded!.componentNames).toEqual(identity.componentNames);
    expect(loaded!.blindingFactor).toBe(identity.blindingFactor);
    expect(loaded!.commitment).toBe(identity.commitment);
    expect(loaded!.createdAt).toBe(identity.createdAt);
  });

  it('identityExists returns true after saving', async () => {
    const identity = await createMockIdentity();
    await saveIdentity(identity);

    const exists = await identityExists();
    expect(exists).toBe(true);
  });

  it('saveIdentity overwrites existing identity', async () => {
    const first = await createMockIdentity();
    await saveIdentity(first);

    const second = await createMockIdentity();
    second.commitment = '03' + 'ee'.repeat(32);
    await saveIdentity(second);

    const loaded = await loadIdentity();
    expect(loaded!.commitment).toBe(second.commitment);
  });

  it('deleteIdentity removes the identity', async () => {
    const identity = await createMockIdentity();
    await saveIdentity(identity);

    await deleteIdentity();

    const loaded = await loadIdentity();
    expect(loaded).toBeNull();

    const exists = await identityExists();
    expect(exists).toBe(false);
  });

  it('deleteIdentity is safe to call when no identity exists', async () => {
    // Should not throw
    await deleteIdentity();
    const exists = await identityExists();
    expect(exists).toBe(false);
  });
});
