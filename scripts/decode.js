'use strict';

// ═══════════════════════════════════════════════════════════════════
// MEDIA DECODE — frame extraction for the beat-marker UI.
//
// Phase 1 (this file) implements video thumbnails only, using a hidden
// <video> element + canvas seeking — no external libraries, no FFmpeg.
// Phase 3 will add animated-image decoding (gifuct-js for GIF,
// WebCodecs ImageDecoder for animated WebP).
// ═══════════════════════════════════════════════════════════════════

var THUMB_INTERVAL_MS = 200;   // ~5 thumbnails per second
var THUMB_MAX_WIDTH   = 160;   // px; height scaled to preserve aspect ratio
var THUMB_MAX_COUNT   = 240;   // cap so a long clip doesn't blow memory

function _seekVideo(video, t) {
  return new Promise((resolve, reject) => {
    function onSeeked() {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error',  onError);
      resolve();
    }
    function onError() {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error',  onError);
      reject(video.error || new Error('video seek failed'));
    }
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error',  onError);
    try { video.currentTime = t; }
    catch (e) { onError(); }
  });
}

function _loadVideoMeta(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && video.duration) { resolve(); return; }
    function onMeta() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error',          onError);
      resolve();
    }
    function onError() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error',          onError);
      reject(video.error || new Error('video metadata load failed'));
    }
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error',          onError);
  });
}

// Returns { thumbs: [{ t: seconds, bitmap: ImageBitmap }], duration, w, h }.
// `onProgress(done, total)` is called after each frame is grabbed.
async function extractVideoThumbnails(srcUrl, opts = {}) {
  const intervalMs = opts.intervalMs || THUMB_INTERVAL_MS;
  const maxCount   = opts.maxCount   || THUMB_MAX_COUNT;
  const onProgress = opts.onProgress || (() => {});
  const signal     = opts.signal;

  const video = document.createElement('video');
  video.muted       = true;
  video.playsInline = true;
  video.preload     = 'auto';
  video.crossOrigin = 'anonymous';
  video.src         = srcUrl;

  try {
    await _loadVideoMeta(video);
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error('video has no readable duration');
    }
    const vW = video.videoWidth  || 1;
    const vH = video.videoHeight || 1;
    const scale = Math.min(1, THUMB_MAX_WIDTH / vW);
    const cW = Math.max(1, Math.round(vW * scale));
    const cH = Math.max(1, Math.round(vH * scale));

    const stepSec = intervalMs / 1000;
    let count = Math.max(1, Math.ceil(duration / stepSec));
    if (count > maxCount) count = maxCount;
    const stride = duration / count;

    const canvas = document.createElement('canvas');
    canvas.width = cW; canvas.height = cH;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    const thumbs = [];
    for (let i = 0; i < count; i++) {
      if (signal && signal.aborted) throw new Error('aborted');
      const t = Math.min(duration - 0.001, i * stride);
      await _seekVideo(video, t);
      ctx.clearRect(0, 0, cW, cH);
      ctx.drawImage(video, 0, 0, cW, cH);
      const bitmap = await createImageBitmap(canvas);
      thumbs.push({ t, bitmap });
      onProgress(i + 1, count);
    }
    return { thumbs, duration, w: vW, h: vH };
  } finally {
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
  }
}

// Convert an ImageBitmap to a sized <canvas> the marker UI can render into a
// strip. Returned canvases are detached from the original bitmaps.
function bitmapToCanvas(bitmap, w, h) {
  const c = document.createElement('canvas');
  c.width  = w || bitmap.width;
  c.height = h || bitmap.height;
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}
