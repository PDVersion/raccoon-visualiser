'use strict';

// ═══════════════════════════════════════════════════════════════════
// DORMANT — not loaded by index.html. Re-add the <script> tag when
// animated-image retiming (sprite-sheet path) is re-enabled.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// MEDIA DECODE — frame extraction for the beat-marker UI.
//
// Video: hidden <video> element + canvas seeking. No external deps.
//
// Animated image: prefers WebCodecs ImageDecoder (Chrome 94+, FF 130+,
// Safari 17.4+) for both GIF and WebP. Falls back to gifuct-js (loaded
// lazily from esm.sh) for GIFs in browsers without ImageDecoder.
// Animated WebP in such browsers has no fallback — we surface a clear
// error to the user.
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

// ── Animated image (GIF / WebP) ────────────────────────────────────
// Returns { frames: [{ bitmap, delayMs }], totalDurationMs, width, height }.

async function _imageDecoderSupports(mime) {
  if (!('ImageDecoder' in window)) return false;
  try {
    const supported = await ImageDecoder.isTypeSupported(mime);
    return !!supported;
  } catch (_) { return false; }
}

async function _decodeViaImageDecoder(srcUrl, mime, onProgress) {
  const data = await (await fetch(srcUrl)).arrayBuffer();
  const dec  = new ImageDecoder({ data, type: mime });
  try {
    await dec.completed;
    const track      = dec.tracks.selectedTrack;
    const frameCount = track && track.frameCount;
    if (!frameCount) throw new Error('decoder reported 0 frames');
    const frames = [];
    let width = 0, height = 0;
    for (let i = 0; i < frameCount; i++) {
      const r   = await dec.decode({ frameIndex: i });
      const img = r.image;
      width  = img.displayWidth;
      height = img.displayHeight;
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0);
      const bitmap = await createImageBitmap(c);
      const delayMs = img.duration ? Math.max(20, Math.round(img.duration / 1000)) : 100;
      try { img.close(); } catch (_) {}
      frames.push({ bitmap, delayMs });
      if (onProgress) onProgress(i + 1, frameCount);
    }
    const totalDurationMs = frames.reduce((a, b) => a + b.delayMs, 0);
    return { frames, totalDurationMs, width, height };
  } finally {
    try { dec.close(); } catch (_) {}
  }
}

let _gifuctPromise = null;
function _loadGifuct() {
  if (!_gifuctPromise) {
    _gifuctPromise = import('https://esm.sh/gifuct-js@2.1.2')
      .catch(err => { _gifuctPromise = null; throw err; });
  }
  return _gifuctPromise;
}

async function _decodeGifFallback(srcUrl, onProgress) {
  const mod = await _loadGifuct();
  const parseGIF         = mod.parseGIF         || (mod.default && mod.default.parseGIF);
  const decompressFrames = mod.decompressFrames || (mod.default && mod.default.decompressFrames);
  if (!parseGIF || !decompressFrames) throw new Error('gifuct-js exports missing');

  const buf       = await (await fetch(srcUrl)).arrayBuffer();
  const gif       = parseGIF(buf);
  const rawFrames = decompressFrames(gif, true);
  if (!rawFrames.length) throw new Error('GIF has no frames');

  const { width, height } = gif.lsd;
  const composite = document.createElement('canvas');
  composite.width = width; composite.height = height;
  const cctx = composite.getContext('2d');

  const frames = [];
  for (let i = 0; i < rawFrames.length; i++) {
    const f = rawFrames[i];
    // Disposal 3 = restore-previous: snapshot before drawing the patch.
    let restore = null;
    if (f.disposalType === 3) restore = cctx.getImageData(0, 0, width, height);

    const patch = new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height);
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = f.dims.width; patchCanvas.height = f.dims.height;
    patchCanvas.getContext('2d').putImageData(patch, 0, 0);
    cctx.drawImage(patchCanvas, f.dims.left, f.dims.top);

    const snapshot = document.createElement('canvas');
    snapshot.width = width; snapshot.height = height;
    snapshot.getContext('2d').drawImage(composite, 0, 0);
    const bitmap = await createImageBitmap(snapshot);

    if      (f.disposalType === 2) cctx.clearRect(0, 0, width, height);
    else if (f.disposalType === 3 && restore) cctx.putImageData(restore, 0, 0);

    frames.push({ bitmap, delayMs: f.delay > 0 ? f.delay : 100 });
    if (onProgress) onProgress(i + 1, rawFrames.length);
  }
  const totalDurationMs = frames.reduce((a, b) => a + b.delayMs, 0);
  return { frames, totalDurationMs, width, height };
}

async function decodeAnimatedImage(srcUrl, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const kind = (opts.kind || extOf(srcUrl)).toLowerCase();
  const mime = kind === 'gif' ? 'image/gif' : kind === 'webp' ? 'image/webp' : null;
  if (!mime) throw new Error('Unsupported animated image kind: ' + kind);

  if (await _imageDecoderSupports(mime)) {
    try { return await _decodeViaImageDecoder(srcUrl, mime, onProgress); }
    catch (e) {
      if (kind === 'gif') return _decodeGifFallback(srcUrl, onProgress);
      throw e;
    }
  }
  if (kind === 'gif')  return _decodeGifFallback(srcUrl, onProgress);
  throw new Error('Your browser cannot decode animated WebP. Try Chrome, Firefox, or Safari 17.4+.');
}
