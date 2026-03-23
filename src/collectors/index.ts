import type { Collector } from '../types.js';
import { collectCanvas } from './canvas.js';
import { collectWebgl } from './webgl.js';
import { collectAudio } from './audio.js';
import { collectFonts } from './fonts.js';
import { collectScreen } from './screen.js';
import { collectPlatform } from './platform.js';
import { collectStorage } from './storage.js';
import { collectMath } from './math.js';
import { collectTimezone } from './timezone.js';
import { collectWebrtc } from './webrtc.js';

/**
 * Registry of all signal collectors in deterministic order.
 * The order defines the hash vector layout and must remain stable across versions.
 * New collectors should only be appended — never inserted or reordered.
 */
export const COLLECTOR_REGISTRY: ReadonlyArray<{ name: string; collect: Collector }> = [
  { name: 'canvas', collect: collectCanvas },
  { name: 'webgl', collect: collectWebgl },
  { name: 'audio', collect: collectAudio },
  { name: 'fonts', collect: collectFonts },
  { name: 'screen', collect: collectScreen },
  { name: 'platform', collect: collectPlatform },
  { name: 'storage', collect: collectStorage },
  { name: 'math', collect: collectMath },
  { name: 'timezone', collect: collectTimezone },
  { name: 'webrtc', collect: collectWebrtc },
];

/**
 * Get the ordered list of component names.
 *
 * @param exclude - Names to skip
 * @returns Array of component names in registry order
 */
export function getComponentNames(exclude?: string[]): string[] {
  const skip = new Set(exclude ?? []);
  return COLLECTOR_REGISTRY
    .filter((c) => !skip.has(c.name))
    .map((c) => c.name);
}

/**
 * Run all collectors (respecting exclusions) and return ordered signal values.
 * Each result is a string or null. Collectors are run in parallel.
 *
 * @param exclude - Collector names to skip
 * @param timeoutMs - Per-collector timeout in milliseconds (default: 200)
 * @returns Array of signal values in registry order
 */
export async function collectAll(
  exclude?: string[],
  timeoutMs = 200,
): Promise<Array<string | null>> {
  const skip = new Set(exclude ?? []);
  const active = COLLECTOR_REGISTRY.filter((c) => !skip.has(c.name));

  const results = await Promise.all(
    active.map(async (c) => {
      try {
        return await Promise.race([
          c.collect(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
      } catch {
        return null;
      }
    }),
  );

  return results;
}
