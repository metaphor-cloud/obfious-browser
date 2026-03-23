import type { Collector } from '../types.js';

/**
 * Math function precision quirks.
 * Different JS engines and CPU architectures produce subtly different
 * floating-point results for transcendental functions.
 */
export const collectMath: Collector = async () => {
  try {
    const values = [
      Math.acos(0.123456789),
      Math.asin(0.123456789),
      Math.atan(0.123456789),
      Math.atan2(0.123456789, 0.987654321),
      Math.cos(0.123456789),
      Math.exp(1),
      Math.log(2),
      Math.sin(0.123456789),
      Math.sqrt(2),
      Math.tan(0.123456789),
      Math.log2(7),
      Math.log10(7),
      Math.cbrt(100),
      Math.cosh(1),
      Math.sinh(1),
      Math.tanh(1),
      Math.expm1(1),
      Math.log1p(0.5),
      Math.hypot(3, 4),
    ];

    return values.map((v) => v.toString()).join(',');
  } catch {
    return null;
  }
};
