import type { Collector } from '../types.js';

/**
 * Screen properties: resolution, color depth, pixel ratio, available dimensions.
 */
export const collectScreen: Collector = async () => {
  try {
    if (typeof screen === 'undefined') return null;

    const parts = [
      'w:' + screen.width,
      'h:' + screen.height,
      'aw:' + screen.availWidth,
      'ah:' + screen.availHeight,
      'cd:' + screen.colorDepth,
      'pd:' + screen.pixelDepth,
      'dpr:' + (globalThis.devicePixelRatio ?? 1),
    ];

    return parts.join('|');
  } catch {
    return null;
  }
};
