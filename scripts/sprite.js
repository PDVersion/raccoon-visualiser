'use strict';

// ═══════════════════════════════════════════════════════════════════
// SPRITE-SHEET BUILDER — composites an array of decoded frames into
// a single horizontal PNG sprite sheet, preserving transparency.
// The returned blob is stored in the processed-media cache so the
// expensive decode + composite step only runs once per file.
// ═══════════════════════════════════════════════════════════════════

var SPRITE_MAX_WIDTH_PX   = 16384;   // soft texture-limit guard
var SPRITE_WARN_BYTES     = 4 * 1024 * 1024;  // 4 MB warning threshold
var SPRITE_WARN_FRAMES    = 100;

async function buildSpriteSheet(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    throw new Error('No frames to composite');
  }
  const first  = frames[0].bitmap;
  const frameW = first.width;
  const frameH = first.height;
  const count  = frames.length;
  const totalW = frameW * count;

  if (totalW > SPRITE_MAX_WIDTH_PX) {
    throw new Error(
      `Sprite would be ${totalW}px wide; browser texture limit is ~${SPRITE_MAX_WIDTH_PX}. ` +
      `Try a shorter clip or fewer frames.`
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width  = totalW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < count; i++) {
    const f = frames[i];
    // Frames are assumed to share the canvas-sized intrinsic dimensions
    // produced by decodeAnimatedImage(); drawing aligned avoids resampling.
    ctx.drawImage(f.bitmap, i * frameW, 0);
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Sprite PNG encoding failed')),
      'image/png'
    );
  });

  const baseDurationMs = frames.reduce((a, f) => a + f.delayMs, 0);
  const warnings = [];
  if (blob.size  > SPRITE_WARN_BYTES)  warnings.push(`large (${(blob.size / 1048576).toFixed(1)} MB)`);
  if (count      > SPRITE_WARN_FRAMES) warnings.push(`${count} frames`);

  return { blob, frameW, frameH, count, baseDurationMs, warnings };
}
