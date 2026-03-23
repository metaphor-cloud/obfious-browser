import type { Collector } from '../types.js';

/**
 * Canvas 2D rendering fingerprint.
 * Renders text, shapes, and emoji at specific sizes/colors, then hashes the result.
 * Different GPUs and font rendering engines produce subtly different pixel outputs.
 */
export const collectCanvas: Collector = async () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#f0e68c';
    ctx.fillRect(0, 0, 256, 128);

    // Text with specific font stack
    ctx.fillStyle = '#c0392b';
    ctx.font = '18px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Obfious 🔒 <canvas>', 4, 4);

    // Second line with different font
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 14px "Times New Roman", serif';
    ctx.fillText('device identity ✦ 2024', 4, 30);

    // Geometric shapes
    ctx.fillStyle = 'rgba(52, 152, 219, 0.7)';
    ctx.beginPath();
    ctx.arc(200, 80, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
    ctx.fillRect(10, 60, 50, 50);

    // Gradient
    const gradient = ctx.createLinearGradient(80, 60, 180, 110);
    gradient.addColorStop(0, '#e74c3c');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(80, 60, 100, 50);

    // Anti-aliased line
    ctx.strokeStyle = '#1abc9c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.bezierCurveTo(50, 80, 150, 120, 256, 60);
    ctx.stroke();

    return canvas.toDataURL();
  } catch {
    return null;
  }
};
