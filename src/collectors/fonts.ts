import type { Collector } from '../types.js';

// Probe fonts — a diverse set that covers common OS-specific installations
const PROBE_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  // Windows-specific
  'Calibri', 'Cambria', 'Consolas', 'Segoe UI',
  // macOS-specific
  'Helvetica Neue', 'Menlo', 'Monaco', 'San Francisco', 'SF Pro',
  // Linux-specific
  'DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'Noto Sans',
  // CJK
  'MS Gothic', 'MS PGothic', 'Hiragino Sans', 'SimSun',
  // Miscellaneous
  'Futura', 'Garamond', 'Rockwell', 'Copperplate',
];

const FALLBACK_FONTS = ['monospace', 'sans-serif', 'serif'] as const;
const TEST_STRING = 'mmmmmmmmmmlli';
const TEST_SIZE = '72px';

/**
 * Detect installed fonts by measuring text width differences.
 * For each probe font, measures text rendered with that font + fallback
 * versus the fallback alone. A width difference indicates the font is installed.
 */
export const collectFonts: Collector = async () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Measure baseline widths for each fallback
    const baselines = new Map<string, number>();
    for (const fallback of FALLBACK_FONTS) {
      ctx.font = `${TEST_SIZE} ${fallback}`;
      baselines.set(fallback, ctx.measureText(TEST_STRING).width);
    }

    const installed: string[] = [];

    for (const font of PROBE_FONTS) {
      let detected = false;
      for (const fallback of FALLBACK_FONTS) {
        ctx.font = `${TEST_SIZE} "${font}", ${fallback}`;
        const width = ctx.measureText(TEST_STRING).width;
        const baselineWidth = baselines.get(fallback)!;
        if (Math.abs(width - baselineWidth) > 0.1) {
          detected = true;
          break;
        }
      }
      if (detected) {
        installed.push(font);
      }
    }

    return installed.join(',');
  } catch {
    return null;
  }
};
