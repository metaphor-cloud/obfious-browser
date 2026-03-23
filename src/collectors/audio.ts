import type { Collector } from '../types.js';

/**
 * AudioContext oscillator fingerprint.
 * Different audio stacks produce slightly different float frequency data
 * when processing the same oscillator → compressor → analyser chain.
 */
export const collectAudio: Collector = async () => {
  let ctx: AudioContext | null = null;
  try {
    const AudioCtx = globalThis.AudioContext ?? (globalThis as unknown as Record<string, unknown>).webkitAudioContext;
    if (!AudioCtx) return null;

    ctx = new (AudioCtx as typeof AudioContext)();

    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, ctx.currentTime);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, ctx.currentTime);
    compressor.knee.setValueAtTime(40, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    oscillator.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    oscillator.start(0);

    // Render a short buffer
    await new Promise((resolve) => setTimeout(resolve, 50));

    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);

    oscillator.stop();
    oscillator.disconnect();
    compressor.disconnect();
    analyser.disconnect();

    // Use a subset of frequency bins for the fingerprint
    const sample = Array.from(data.slice(0, 64))
      .map((v) => (isFinite(v) ? v.toFixed(2) : '0'))
      .join(',');

    return sample;
  } catch {
    return null;
  } finally {
    // Always close the audio context to prevent resource leaks,
    // including when the outer timeout in collectAll fires.
    if (ctx) {
      ctx.close().catch(() => {});
    }
  }
};
