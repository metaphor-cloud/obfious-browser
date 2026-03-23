import type { DeviceOptions, DeviceExport, VerifyResult, VerifyOptions, StoredIdentity } from './types.js';
import { ObfiousError } from './types.js';
import { generateKeypair, exportPublicKey, deriveDeviceId, sign as ecdsaSign } from './crypto/keypair.js';
import { hashSignal } from './crypto/hash.js';
import { computeCommitment } from './crypto/commitment.js';
import { generateBlindingFactor } from './crypto/generators.js';
import { collectAll, getComponentNames } from './collectors/index.js';
import { loadIdentity, saveIdentity, identityExists, deleteIdentity } from './storage/indexeddb.js';

const DEFAULT_THRESHOLD = 0.65;

/**
 * A cryptographic device identity.
 *
 * Generates an ECDSA P-256 keypair, collects browser signal components,
 * hashes them, and computes a Pedersen commitment. The identity persists
 * in IndexedDB with the private key marked as non-extractable.
 *
 * @example
 * ```ts
 * const device = await Device.create();
 * console.log(device.id);         // "a1b2c3d4e5f67890"
 * console.log(device.commitment); // "02f4a8c3..."
 *
 * const sig = await device.sign('challenge');
 * const result = await device.verify(storedCommitment);
 * ```
 */
export class Device {
  /** Short stable identifier — first 16 hex chars of SHA-256(publicKey) */
  readonly id: string;
  /** Full ECDSA P-256 public key (base64url-encoded) */
  readonly publicKey: string;
  /** Pedersen commitment to signal hash vector (hex) */
  readonly commitment: string;
  /** Count of signal components collected */
  readonly components: number;
  /** Unix timestamp (ms) of first creation */
  readonly createdAt: number;

  private readonly _keypair: CryptoKeyPair;
  private readonly _hashVector: string[];
  private readonly _componentNames: string[];
  private readonly _blindingFactor: string;
  private readonly _options: DeviceOptions;
  private constructor(
    id: string,
    publicKey: string,
    commitment: string,
    components: number,
    createdAt: number,
    keypair: CryptoKeyPair,
    hashVector: string[],
    componentNames: string[],
    blindingFactor: string,
    options: DeviceOptions,
  ) {
    this.id = id;
    this.publicKey = publicKey;
    this.commitment = commitment;
    this.components = components;
    this.createdAt = createdAt;
    this._keypair = keypair;
    this._hashVector = hashVector;
    this._componentNames = componentNames;
    this._blindingFactor = blindingFactor;
    this._options = options;
  }

  /**
   * Create or load a device identity.
   *
   * If an identity exists in IndexedDB, loads it, re-collects signals, and
   * updates the commitment if signals have drifted significantly.
   * If no identity exists, generates a new keypair, collects signals, and
   * computes the initial Pedersen commitment.
   *
   * @param options - Configuration options
   * @returns A Device instance
   * @throws {ObfiousError} If WebCrypto is unavailable
   *
   * @example
   * ```ts
   * const device = await Device.create();
   * const device2 = await Device.create({ exclude: ['audio'], debug: true });
   * ```
   */
  static async create(options: DeviceOptions = {}): Promise<Device> {
    if (!crypto?.subtle) {
      throw new ObfiousError(
        'WebCrypto API is required but not available in this environment. ' +
        'Obfious requires a browser with crypto.subtle support.',
      );
    }

    if (options.apiKey) {
      console.warn(
        'Obfious API integration coming in a future version. ' +
        'For now, the library operates in client-only mode. ' +
        'Visit obfious.com for server-side features.',
      );
    }

    const debug = options.debug ?? false;
    const startTime = debug ? performance.now() : 0;

    // Try to load existing identity
    let stored: StoredIdentity | null = null;
    let persistent = true;
    try {
      stored = await loadIdentity();
    } catch {
      if (debug) console.warn('[obfious] IndexedDB unavailable — identity will not persist');
      persistent = false;
    }

    // Collect current signals
    const componentNames = getComponentNames(options.exclude);
    if (debug) console.warn(`[obfious] Collecting ${componentNames.length} signal components...`);

    const collectStart = debug ? performance.now() : 0;
    const signals = await collectAll(options.exclude);
    if (debug) console.warn(`[obfious] Collection took ${(performance.now() - collectStart).toFixed(1)}ms`);

    // Hash each signal
    const hashVector = await Promise.all(
      componentNames.map((name, i) => hashSignal(name, signals[i] ?? 'null')),
    );

    const collected = signals.filter((s) => s !== null).length;

    if (stored) {
      // Existing identity — check for drift
      const id = await deriveDeviceId(stored.keypair.publicKey);
      const pubKey = await exportPublicKey(stored.keypair.publicKey);

      // Compare hash vectors (use stored component names for alignment)
      let drifted = 0;
      for (let i = 0; i < componentNames.length; i++) {
        const name = componentNames[i]!;
        const storedIdx = stored.componentNames.indexOf(name);
        if (storedIdx === -1 || stored.hashVector[storedIdx] !== hashVector[i]) {
          drifted++;
        }
      }
      // Count components that were in stored but not in current
      for (const name of stored.componentNames) {
        if (!componentNames.includes(name)) drifted++;
      }

      const total = Math.max(componentNames.length, stored.componentNames.length);
      const similarity = total > 0 ? (total - drifted) / total : 1;

      // Update stored identity if there's meaningful drift
      if (similarity < 0.95) {
        if (debug) console.warn(`[obfious] Signal drift detected: ${drifted} components changed (similarity: ${similarity.toFixed(2)})`);
        const newCommitment = computeCommitment(componentNames, hashVector, stored.blindingFactor);
        const updated: StoredIdentity = {
          ...stored,
          hashVector,
          componentNames,
          commitment: newCommitment,
        };
        if (persistent) {
          try { await saveIdentity(updated); } catch { /* best effort */ }
        }

        if (debug) console.warn(`[obfious] Loaded existing identity in ${(performance.now() - startTime).toFixed(1)}ms`);

        return new Device(
          id, pubKey, newCommitment, collected, stored.createdAt,
          stored.keypair, hashVector, componentNames, stored.blindingFactor,
          options,
        );
      }

      if (debug) console.warn(`[obfious] Loaded existing identity in ${(performance.now() - startTime).toFixed(1)}ms`);

      // No significant drift — use the stored commitment for consistency
      return new Device(
        id, pubKey, stored.commitment, collected, stored.createdAt,
        stored.keypair, stored.hashVector, stored.componentNames, stored.blindingFactor,
        options,
      );
    }

    // New identity
    const keypair = await generateKeypair();
    const id = await deriveDeviceId(keypair.publicKey);
    const pubKey = await exportPublicKey(keypair.publicKey);
    const blindingFactor = generateBlindingFactor();
    const commitment = computeCommitment(componentNames, hashVector, blindingFactor);
    const createdAt = Date.now();

    const identity: StoredIdentity = {
      keypair,
      hashVector,
      componentNames,
      blindingFactor,
      commitment,
      createdAt,
    };

    if (persistent) {
      try {
        await saveIdentity(identity);
      } catch {
        if (debug) console.warn('[obfious] Failed to persist identity to IndexedDB');
        persistent = false;
      }
    }

    if (debug) console.warn(`[obfious] Created new identity in ${(performance.now() - startTime).toFixed(1)}ms`);

    return new Device(
      id, pubKey, commitment, collected, createdAt,
      keypair, hashVector, componentNames, blindingFactor,
      options,
    );
  }

  /**
   * Check if a device identity exists in IndexedDB without loading it.
   * Useful for conditional UI flows (e.g., "returning user" vs "new device").
   *
   * @returns true if an identity is stored
   *
   * @example
   * ```ts
   * if (await Device.exists()) {
   *   console.log('Welcome back');
   * }
   * ```
   */
  static async exists(): Promise<boolean> {
    try {
      return await identityExists();
    } catch {
      return false;
    }
  }

  /**
   * Permanently delete the device identity from IndexedDB.
   * Irreversible — the keypair, hash vector, blinding factor, and commitment are gone.
   *
   * @example
   * ```ts
   * await Device.destroy();
   * console.log(await Device.exists()); // false
   * ```
   */
  static async destroy(): Promise<void> {
    try {
      await deleteIdentity();
    } catch {
      // IndexedDB may not be available — nothing to delete
    }
  }

  /**
   * Sign a challenge using the device's non-extractable ECDSA private key.
   * This proves possession of the device — only code running on this device,
   * in this browser, with access to this IndexedDB, can produce a valid signature.
   *
   * @param challenge - The challenge to sign (string or Uint8Array)
   * @returns Base64url-encoded ECDSA signature
   *
   * @example
   * ```ts
   * // Server sends a challenge
   * const sig = await device.sign('server-challenge-abc123');
   * // Send sig + device.publicKey to server for verification
   * ```
   */
  async sign(challenge: string | Uint8Array): Promise<string> {
    return ecdsaSign(this._keypair.privateKey, challenge);
  }

  /**
   * Verify that this device matches a previously stored commitment.
   * Entirely client-side — no network calls.
   *
   * Re-collects current signals, compares the hash vectors component-by-component,
   * and returns the similarity score. The threshold determines whether it's a "match".
   *
   * **Stage 1 note:** The `commitment` parameter is accepted for API compatibility but
   * matching uses hash vector comparison (Hamming distance), not commitment verification.
   * In Stage 3 (ZK verification), this parameter will be used for zero-knowledge proof
   * verification against the commitment directly.
   *
   * @param commitment - A previously stored commitment string (from device.commitment or device.export())
   * @param options - Override threshold for this verification
   * @returns Verification result with match, similarity, new commitment, and drift count
   *
   * @example
   * ```ts
   * // Store commitment during enrollment
   * const stored = device.commitment;
   *
   * // Later, verify same device
   * const result = await device.verify(stored);
   * if (result.match) {
   *   console.log(`Same device (${(result.similarity * 100).toFixed(0)}% match)`);
   * }
   * ```
   */
  async verify(_commitment: string, options?: VerifyOptions): Promise<VerifyResult> {
    const threshold = options?.threshold ?? this._options.threshold ?? DEFAULT_THRESHOLD;
    const debug = this._options.debug ?? false;

    const startTime = debug ? performance.now() : 0;

    // Re-collect current signals
    const signals = await collectAll(this._options.exclude);
    const currentHashVector = await Promise.all(
      this._componentNames.map((name, i) => hashSignal(name, signals[i] ?? 'null')),
    );

    // Compare hash vectors (Hamming distance)
    let matches = 0;
    let drifted = 0;
    const total = this._componentNames.length;

    for (let i = 0; i < total; i++) {
      if (currentHashVector[i] === this._hashVector[i]) {
        matches++;
      } else {
        drifted++;
      }
    }

    const similarity = total > 0 ? matches / total : 1;

    // Compute new commitment for current signal state
    const newCommitment = computeCommitment(
      this._componentNames,
      currentHashVector,
      this._blindingFactor,
    );

    if (debug) {
      console.warn(
        `[obfious] Verification: ${matches}/${total} match ` +
        `(${(similarity * 100).toFixed(1)}%), ${drifted} drifted, ` +
        `${(performance.now() - startTime).toFixed(1)}ms`,
      );
    }

    return {
      match: similarity >= threshold,
      similarity,
      newCommitment,
      driftedComponents: drifted,
    };
  }

  /**
   * Export the storable/transmittable parts of the device identity.
   * Contains NO signal data — safe to store in any database or send to any server.
   *
   * @returns The exportable identity fields
   *
   * @example
   * ```ts
   * const data = device.export();
   * // Send to your server
   * await fetch('/api/register-device', {
   *   method: 'POST',
   *   body: JSON.stringify(data),
   * });
   * ```
   */
  export(): DeviceExport {
    return {
      id: this.id,
      publicKey: this.publicKey,
      commitment: this.commitment,
      components: this.components,
      createdAt: this.createdAt,
    };
  }
}
