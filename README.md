[![npm](https://img.shields.io/npm/v/%40obfious%2Fbrowser)](https://www.npmjs.com/package/@obfious/browser) [![bundle](https://img.shields.io/bundlephobia/minzip/%40obfious%2Fbrowser)](https://bundlephobia.com/package/@obfious/browser) [![CI](https://github.com/metaphor-cloud/obfious-oss/actions/workflows/ci.yml/badge.svg)](https://github.com/metaphor-cloud/obfious-oss/actions/workflows/ci.yml) [![license](https://img.shields.io/github/license/metaphor-cloud/obfious-oss)](LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

# obfious

**Client-side device identity using ECDSA keypairs and Pedersen commitments. Raw device signals never leave the browser.**

**[Live demo →](https://metaphor-cloud.github.io/obfious-oss/)**

Obfious is not a fingerprinting library. It generates a cryptographic device identity: a non-extractable ECDSA signing key bound to the browser, a zero-knowledge-compatible Pedersen commitment over hashed device signals, and local verification through hash vector comparison. No data is transmitted. No server is needed. The identity persists in IndexedDB and can be verified entirely client-side.

## Why this exists

Every fingerprinting library follows the same pattern: collect browser signals, hash them into a single identifier, transmit the result to a server. The server holds the data, makes the decisions, and owns the risk.

We built differently:

- **Persistent ECDSA keypair** generated in the browser's WebCrypto API with the private key marked `non-extractable`. It cannot be read by JavaScript. It stays in IndexedDB and proves device possession through challenge-response signing.
- **Pedersen commitment** that cryptographically binds the device's signal values without revealing them. The commitment is a point on the P-256 curve. It can be stored anywhere, transmitted to anyone, and verified later -- without exposing what signals produced it.
- **Local verification** by re-collecting signals, hashing them, and comparing the hash vector against the stored baseline using Hamming distance. The similarity score tells you whether it is the same device. No network call required.

## Quick start

```bash
npm install @obfious/browser
```

### TypeScript / ESM

```ts
import { Device } from '@obfious/browser';

// Create or load a device identity
const device = await Device.create();
console.log(device.id);         // "a1b2c3d4e5f67890"
console.log(device.commitment); // "02f4a8c3..."

// Sign a server challenge
const signature = await device.sign('server-challenge-abc123');

// Verify against a stored commitment
const result = await device.verify(device.commitment);
console.log(result.match);      // true
console.log(result.similarity); // 0.95
```

### CDN / Script tag

```html
<script src="https://unpkg.com/@obfious/browser/dist/obfious.umd.js"></script>
<script>
  (async () => {
    const device = await obfious.Device.create();
    console.log(device.id, device.commitment);

    const sig = await device.sign('challenge');
    const result = await device.verify(device.commitment);
    console.log('match:', result.match, 'similarity:', result.similarity);
  })();
</script>
```

## How it works

### Device keypair

Obfious generates an ECDSA P-256 keypair using the WebCrypto API (`crypto.subtle.generateKey`). The private key is created with `extractable: false`, meaning JavaScript cannot read the key material. The keypair is stored in IndexedDB and survives page reloads, tab closures, and browser restarts. Only code running in the same origin can access it.

The public key is exported as a base64url-encoded raw key (65 bytes uncompressed). A short device ID is derived from the first 16 hex characters of `SHA-256(publicKey)`.

### Signal collection

Ten signal collectors probe browser APIs for device-specific values:

| Collector | Source |
|-----------|--------|
| `canvas` | Canvas 2D rendering fingerprint |
| `webgl` | WebGL renderer, vendor, extensions |
| `audio` | AudioContext oscillator output |
| `fonts` | Font enumeration via width measurement |
| `screen` | Screen dimensions, pixel ratio, color depth |
| `platform` | Navigator properties (userAgent, platform, languages, hardwareConcurrency) |
| `storage` | Storage API availability (localStorage, sessionStorage, indexedDB) |
| `math` | Math function output precision |
| `timezone` | Timezone offset and IANA name |
| `webrtc` | WebRTC capability detection |

Each collector returns a string or `null` (if the API is unavailable). The string is then hashed with `SHA-256(componentName + ":" + value)` to produce a 32-byte digest. The raw signal value is discarded immediately after hashing. The resulting hash vector is an ordered array of hex-encoded digests, one per component.

Collectors run in parallel with a 200ms per-collector timeout. If a collector throws or times out, the component is recorded as `null`.

### Pedersen commitment

The Pedersen commitment is a cryptographic lock over the hash vector. Unlike a simple hash, a Pedersen commitment has two properties that matter:

1. **Information-theoretic hiding.** Given only the commitment, an adversary with unbounded compute cannot determine the committed values. This is stronger than computational hiding provided by hash functions. The blinding factor `r` ensures that the same signal values produce a different commitment each time a new identity is created.

2. **Homomorphic structure.** Pedersen commitments are additively homomorphic, which makes them directly compatible with zero-knowledge proof systems. This is the foundation for the ZK upgrade path.

The commitment is computed over the P-256 curve:

```
C = h_0 * G_0 + h_1 * G_1 + ... + h_n * G_n + r * H
```

Where:
- `h_i` is the signal hash for component `i`, reduced to a scalar mod the curve order
- `G_i` is a deterministic generator point derived from the component name (nothing-up-my-sleeve construction via hash-to-curve)
- `r` is a 256-bit random blinding factor generated at identity creation
- `H` is the blinding generator derived from the string `"blinding"`

The result is a compressed P-256 point (33 bytes, 66 hex characters). P-256 is used because it matches the ECDSA keypair curve and is natively supported by WebCrypto. The commitment is forward-compatible with ZK proof systems that operate over P-256.

A Pedersen commitment is **not a hash**. A SHA-256 hash of the same inputs would provide computational hiding but no homomorphic property and no information-theoretic hiding. The blinding factor makes the commitment perfectly hiding even if an attacker knows all signal values.

### Local verification

Verification re-collects all signal components, hashes them, and compares the new hash vector against the stored baseline component by component. The comparison is a Hamming distance calculation: count how many positions differ, divide by total to get a similarity score.

```
similarity = matching_components / total_components
match = similarity >= threshold (default: 0.65)
```

The result includes the similarity score, the count of drifted components, and an updated commitment reflecting the current signal state. No network call is made.

A threshold of `0.65` tolerates normal browser drift (font changes, screen resolution changes, browser updates) while catching device switches. Adjust based on your security requirements.

## Privacy model

### Stored client-side (IndexedDB, same-origin only)

- ECDSA P-256 keypair (private key non-extractable)
- Hash vector (SHA-256 digests of signal components)
- Component name ordering
- Blinding factor (256-bit random scalar)
- Commitment (compressed P-256 point)
- Creation timestamp

### What `export()` returns (safe to transmit)

- `id` -- short device identifier (16 hex chars)
- `publicKey` -- ECDSA P-256 public key (base64url)
- `commitment` -- Pedersen commitment (66 hex chars)
- `components` -- count of collected signals
- `createdAt` -- creation timestamp

### What is NEVER exposed

- Raw signal values (discarded after hashing)
- Individual signal hashes (stored locally, never exported)
- Blinding factor (stored locally, never exported)
- Private key (non-extractable, cannot be read by JavaScript)
- Any data transmitted to any server (there are no network calls)

## The upgrade path

Obfious is designed as the client-side foundation for a layered identity system.

### Stage 1: This library (available now)

Client-only device identity. Keypair generation, signal hashing, Pedersen commitment, local verification. Zero network calls. Install from npm and use immediately.

### Stage 2: Obfious API (coming)

Optional server integration. The hash vector (not raw signals) is transmitted to the Obfious API for cross-session verification, device graph analysis, and anomaly detection. The commitment proves the client has not tampered with the hash vector. Enable with the `apiKey` option.

### Stage 3: ZK verification (planned)

Zero-knowledge proofs over the Pedersen commitment. The client proves that the committed values satisfy a verification policy (e.g., "at least 7 of 10 components match") without revealing which components matched or what their values are. The Pedersen commitment's homomorphic structure makes this possible without changing the client-side data model.

The commitments generated today are forward-compatible with all three stages. Nothing changes on the client when you upgrade.

## API reference

### `Device.create(options?: DeviceOptions): Promise<Device>`

Create or load a device identity. If an identity exists in IndexedDB, loads it and re-collects signals. If signals have drifted significantly (>5%), updates the stored commitment. If no identity exists, generates a new keypair and computes the initial commitment.

Throws `ObfiousError` if the WebCrypto API is unavailable.

### `Device.exists(): Promise<boolean>`

Check whether a device identity exists in IndexedDB without loading it. Returns `false` if IndexedDB is unavailable.

### `Device.destroy(): Promise<void>`

Permanently delete the device identity from IndexedDB. Irreversible. The keypair, hash vector, blinding factor, and commitment are gone.

### `device.sign(challenge: string | Uint8Array): Promise<string>`

Sign a challenge using the device's non-extractable ECDSA private key. Returns a base64url-encoded signature. Use this for challenge-response authentication: send the signature and `device.publicKey` to your server, verify with any ECDSA P-256 implementation.

### `device.verify(commitment: string, options?: VerifyOptions): Promise<VerifyResult>`

Verify that this device matches a previously stored commitment. Entirely client-side. Re-collects current signals, compares hash vectors by Hamming distance, and returns the result.

```ts
interface VerifyResult {
  match: boolean;            // true if similarity >= threshold
  similarity: number;        // 0.0-1.0
  newCommitment: string;     // updated commitment for current signals
  driftedComponents: number; // count of changed components
}
```

### `device.export(): DeviceExport`

Export the transmittable parts of the device identity. Contains no signal data.

```ts
interface DeviceExport {
  id: string;         // 16 hex chars
  publicKey: string;  // base64url ECDSA P-256 public key
  commitment: string; // 66 hex chars (compressed P-256 point)
  components: number; // count of collected signals
  createdAt: number;  // Unix timestamp (ms)
}
```

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `device.id` | `string` | Short stable identifier (16 hex chars) |
| `device.publicKey` | `string` | ECDSA P-256 public key (base64url) |
| `device.commitment` | `string` | Pedersen commitment (hex) |
| `device.components` | `number` | Count of collected signal components |
| `device.createdAt` | `number` | Unix timestamp (ms) of first creation |

### `ObfiousError`

Custom error class thrown by the library. Extends `Error` with `name: 'ObfiousError'`.

## Configuration

```ts
interface DeviceOptions {
  exclude?: string[];   // Signal collectors to skip
  threshold?: number;   // Match threshold for verify() (default: 0.65)
  debug?: boolean;      // Log timing and component info to console
  apiKey?: string;      // Obfious API key (stub -- client-only for now)
}
```

### `exclude`

Array of collector names to skip. Valid names: `canvas`, `webgl`, `audio`, `fonts`, `screen`, `platform`, `storage`, `math`, `timezone`, `webrtc`.

Use this to disable collectors that cause issues in your environment or that you do not want contributing to the identity. Excluding a collector removes it from the hash vector and the commitment.

```ts
const device = await Device.create({ exclude: ['audio', 'webrtc'] });
```

### `threshold`

Similarity threshold for `verify()`. A value between `0.0` and `1.0`. Default: `0.65`.

- `0.65` -- tolerates 3-4 component changes out of 10. Good default for general use.
- `0.8` -- stricter, tolerates 2 changes. Better for high-security flows.
- `0.5` -- lenient, tolerates 5 changes. Useful when signals are volatile.

Can be overridden per-call via `device.verify(commitment, { threshold: 0.8 })`.

### `debug`

When `true`, logs collection timing, component counts, signal drift, and verification results to `console.warn`. Useful during development.

### `apiKey`

Reserved for Obfious API integration (Stage 2). Currently logs a warning and operates in client-only mode.

## Browser support

| Browser | Minimum version | Notes |
|---------|----------------|-------|
| Chrome | 80+ | Full support |
| Firefox | 78+ | Full support |
| Safari | 14+ | Full support |
| Edge | 80+ | Chromium-based, full support |
| iOS Safari | 14+ | Full support |
| Chrome Android | 80+ | Full support |

Requires `crypto.subtle` (WebCrypto API) and `indexedDB`. Both are available in all modern browsers. The library throws `ObfiousError` at creation time if WebCrypto is missing. If IndexedDB is unavailable, the identity is created in memory but will not persist across page loads.

## Contributing

### Setup

```bash
git clone https://github.com/metaphor-cloud/obfious-oss.git
cd obfious-oss
npm install
npm run dev
```

### Adding a collector

1. Create `src/collectors/<name>.ts` exporting an async function that returns `string | null`.
2. Append an entry to `COLLECTOR_REGISTRY` in `src/collectors/index.ts`. Never insert or reorder existing entries -- the hash vector lmetaphor-cloudut must remain stable.
3. Add tests in `tests/`.
4. Run `npm run size` and verify the bundle stays under 25KB gzipped.

### Running tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npx tsc --noEmit    # type checking
npm run lint        # eslint
```

### Code style

- TypeScript strict mode, no `any`.
- Functions document their throws, params, and return types with JSDoc.
- Collectors must never throw. Catch errors and return `null`.
- No runtime dependencies beyond `@noble/curves` and `@noble/hashes`.

### Pull requests

- One feature or fix per PR.
- Tests required for new functionality.
- Bundle size check must pass (< 25KB gzipped).
- CI must be green (lint, typecheck, test, build).

## Acknowledgments

- **[@noble/curves](https://github.com/paulmillr/noble-curves)** and **[@noble/hashes](https://github.com/paulmillr/noble-hashes)** by [Paul Miller](https://paulmillr.com/) -- audited, minimal cryptographic primitives used for Pedersen commitments and SHA-256 hashing.
- The Pedersen commitment scheme is based on the work of Torben Pryds Pedersen, "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing" (CRYPTO 1991).

## License

[MIT](LICENSE) -- Copyright (c) 2026 Metaphor
