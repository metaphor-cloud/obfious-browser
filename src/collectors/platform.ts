import type { Collector } from '../types.js';

/**
 * Navigator properties: userAgent, language, platform, hardware capabilities.
 */
export const collectPlatform: Collector = async () => {
  try {
    if (typeof navigator === 'undefined') return null;

    const parts = [
      'ua:' + (navigator.userAgent ?? ''),
      'lang:' + (navigator.language ?? ''),
      'langs:' + (navigator.languages?.join(',') ?? ''),
      'plat:' + (navigator.platform ?? ''),
      'cores:' + (navigator.hardwareConcurrency ?? ''),
      'mem:' + ((navigator as unknown as Record<string, unknown>).deviceMemory ?? ''),
      'touch:' + (navigator.maxTouchPoints ?? 0),
    ];

    return parts.join('|');
  } catch {
    return null;
  }
};
