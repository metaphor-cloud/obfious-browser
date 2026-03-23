/**
 * Options for configuring device identity creation and behavior.
 */
export interface DeviceOptions {
  /** Signal collector names to skip (e.g., ['audio', 'webrtc']) */
  exclude?: string[];
  /** Match threshold for verify() — default 0.65. Range: 0.0–1.0 */
  threshold?: number;
  /** Log timing and component counts to console */
  debug?: boolean;
  /** Obfious commercial API key (stub — client-only mode for now) */
  apiKey?: string;
}

/**
 * Result of a client-side device verification against a stored commitment.
 */
export interface VerifyResult {
  /** true if similarity >= threshold */
  match: boolean;
  /** 0.0–1.0 ratio of matching signal components */
  similarity: number;
  /** Updated Pedersen commitment reflecting current signal state */
  newCommitment: string;
  /** Count of signal components that changed since enrollment */
  driftedComponents: number;
}

/**
 * Safe-to-transmit subset of a device identity. Contains no signal data.
 */
export interface DeviceExport {
  /** Short stable identifier (first 16 hex chars of SHA-256(publicKey)) */
  id: string;
  /** Full ECDSA P-256 public key (base64url-encoded) */
  publicKey: string;
  /** Pedersen commitment to signal hash vector (hex) */
  commitment: string;
  /** Count of signal components collected */
  components: number;
  /** Unix timestamp (ms) of first creation */
  createdAt: number;
}

/**
 * Internal representation of a stored device identity in IndexedDB.
 */
export interface StoredIdentity {
  /** Non-extractable ECDSA P-256 keypair */
  keypair: CryptoKeyPair;
  /** Array of hex SHA-256 hashes — one per signal component */
  hashVector: string[];
  /** Parallel array of component names (defines vector ordering) */
  componentNames: string[];
  /** Hex-encoded 256-bit random scalar for Pedersen blinding */
  blindingFactor: string;
  /** Hex-encoded compressed Pedersen commitment point (33 bytes → 66 hex chars) */
  commitment: string;
  /** Unix timestamp (ms) of first creation */
  createdAt: number;
}

/**
 * A signal collector function. Returns the signal value as a string, or null
 * if the API is unavailable. Must never throw.
 */
export type Collector = () => Promise<string | null>;

/**
 * Verify options passed to device.verify().
 */
export interface VerifyOptions {
  /** Override the default match threshold for this verification */
  threshold?: number;
}

/**
 * Error thrown by the Obfious library.
 */
export class ObfiousError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObfiousError';
  }
}
