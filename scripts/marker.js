'use strict';

// ═══════════════════════════════════════════════════════════════════
// BEAT-MARKER PANEL — user clicks frame thumbnails where a beat lands
// (peak of a bounce, downbeat of a spin, etc). The mean inter-marker
// interval gives the clip's source BPM. Saving persists the BPM and
// markers so the next load auto-applies them, and (for animated
// images) also persists a sprite sheet that drives a CSS-keyframes
// playback path so subsequent loads skip the decode + composite cost.
//
// Marker positions are stored in milliseconds for both kinds:
//   • video : (video.currentTime * 1000)
//   • image : cumulative frame delay up to that frame
// This keeps _computeStats() unit-free.
// ═══════════════════════════════════════════════════════════════════

var MARKER_MIN          = 4;       // minimum markers required to save
var MARKER_IRREG_THRESH = 0.15;    // stddev / mean — beyond this we warn
var MARKER_RATE_MIN     = 0.25;    // recommended playback-rate range
var MARKER_RATE_MAX     = 2.0;

var _mk = {
  fileKey:    null,
  mediaKind:  null,   // 'video' | 'gif' | 'webp'
  thumbs:     [],     // [{ tMs, bitmap }]
  fullFrames: [],     // image only — full-res frames retained for sprite build
  markers:    [],     // marker positions in ms, sorted ascending
  durationMs: 0,
  abortCtl:   null,
  isOpen:     false
};

function _halfWindowMs() {
  if (_mk.thumbs.length < 2) return 100;
  return (_mk.thumbs[1].tMs - _mk.thumbs[0].tMs) / 2;
}

function _computeStats() {
  if (_mk.markers.length < 2) {
    return { sourceBPM: null, mean: 0, stddev: 0 };
  }
  const ints = [];
  for (let i = 1; i < _mk.markers.length; i++) {
    ints.push(_mk.markers[i] - _mk.markers[i - 1]);
  }
  const mean   = ints.reduce((a, b) => a + b, 0) / ints.length;
  const varc   = ints.reduce((s, x) => s + (x - mean) * (x - mean), 0) / ints.length;
  const stddev = Math.sqrt(varc);
  return { sourceBPM: mean > 0 ? 60000 / mean : null, mean, stddev };
}

function _renderStats() {
  const stats = _computeStats();
  document.getElementById('markerCount').textContent = String(_mk.markers.length);
  document.getElementById('markerBpm').textContent   = stats.sourceBPM ? stats.sourceBPM.toFixed(1) : '—';

  const warn = document.getElementById('markerWarn');
  const msgs = [];
  if (_mk.markers.length < MARKER_MIN) {
    msgs.push(`Need ≥ ${MARKER_MIN} markers (have ${_mk.markers.length}; aim for 8–12)`);
  } else {
    const irreg = stats.mean > 0 ? stats.stddev / stats.mean : 0;
    if (irreg > MARKER_IRREG_THRESH) {
      msgs.push(`Irregular markers (±${Math.round(irreg * 100)}%) — try aligning to the bounce peak`);
    }
    if (stats.sourceBPM) {
      const rate = targetBPM / stats.sourceBPM;
      if (rate < MARKER_RATE_MIN || rate > MARKER_RATE_MAX) {
        const lo = (stats.sourceBPM * MARKER_RATE_MIN).toFixed(0);
        const hi = (stats.sourceBPM * MARKER_RATE_MAX).toFixed(0);
        msgs.push(`Target ${targetBPM.toFixed(0)} needs ${rate.toFixed(2)}× — recommended range ${lo}–${hi} BPM`);
      }
    }
  }
  if (msgs.length) { warn.textContent = msgs.join(' · '); warn.classList.remove('hidden'); }
  else             { warn.textContent = '';                warn.classList.add('hidden'); }

  document.getElementById('markerSaveBtn').disabled = _mk.markers.length < MARKER_MIN || !stats.sourceBPM;
}

function _toggleMarkerAt(thumbIdx) {
  const t   = _mk.thumbs[thumbIdx].tMs;
  const win = _halfWindowMs();
  const hit = _mk.markers.findIndex(m => Math.abs(m - t) < win);
  if (hit >= 0) _mk.markers.splice(hit, 1);
  else { _mk.markers.push(t); _mk.markers.sort((a, b) => a - b); }
  _renderStrip();
  _renderStats();
}

var MARKER_THUMB_H = 64;   // px — must match .marker-cell canvas height in CSS

function _renderStrip() {
  const strip = document.getElementById('markerStrip');
  strip.innerHTML = '';
  const win = _halfWindowMs();
  _mk.thumbs.forEach((thumb, idx) => {
    const cell = document.createElement('div');
    cell.className = 'marker-cell';
    const isMarked = _mk.markers.some(m => Math.abs(m - thumb.tMs) < win);
    if (isMarked) cell.classList.add('marked');
    // Render the canvas at the displayed size so a full-resolution decoded
    // frame doesn't sit in memory at native pixels (animated webp / gif
    // sources are often 512²+).
    const aspect = thumb.bitmap.width / thumb.bitmap.height;
    const h = MARKER_THUMB_H;
    const w = Math.max(8, Math.round(h * aspect));
    const c = bitmapToCanvas(thumb.bitmap, w, h);
    cell.appendChild(c);
    const label = document.createElement('span');
    label.className = 'marker-cell-label';
    label.textContent = (thumb.tMs / 1000).toFixed(2) + 's';
    cell.appendChild(label);
    cell.addEventListener('click', () => _toggleMarkerAt(idx));
    strip.appendChild(cell);
  });
}

function _setProgress(visible, pct, label) {
  const p   = document.getElementById('markerProgress');
  const txt = document.getElementById('markerProgressText');
  const out = document.getElementById('markerProgressPct');
  if (!p) return;
  if (!visible) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  if (txt && label) txt.textContent = label;
  if (out) out.textContent = (pct != null ? Math.round(pct * 100) + '%' : '…');
}

async function openMarker(fileKey, mediaKind) {
  if (_mk.isOpen) closeMarker();
  _mk.fileKey    = fileKey;
  _mk.mediaKind  = mediaKind;
  _mk.thumbs     = [];
  _mk.fullFrames = [];
  _mk.markers    = [];
  _mk.durationMs = 0;
  _mk.isOpen     = true;
  _mk.abortCtl   = ('AbortController' in window) ? new AbortController() : null;

  const panel = document.querySelector('.panel[data-panel-id="markers"]');
  if (panel) panel.classList.remove('collapsed');
  document.getElementById('markerEmpty').classList.add('hidden');
  document.getElementById('markerActive').classList.remove('hidden');
  document.getElementById('markerFilename').textContent = fileKey.split('/').pop();
  document.getElementById('markerStrip').innerHTML = '';
  document.getElementById('markerWarn').classList.add('hidden');
  _renderStats();

  _setProgress(true, 0, mediaKind === 'video' ? 'Extracting frames…' : 'Decoding image…');
  try {
    if (mediaKind === 'video') {
      const res = await extractVideoThumbnails(fileKey, {
        onProgress: (d, t) => _setProgress(true, d / t),
        signal:     _mk.abortCtl ? _mk.abortCtl.signal : undefined
      });
      _mk.thumbs     = res.thumbs.map(t => ({ tMs: t.t * 1000, bitmap: t.bitmap }));
      _mk.durationMs = res.duration * 1000;
    } else if (mediaKind === 'gif' || mediaKind === 'webp') {
      const res = await decodeAnimatedImage(fileKey, {
        kind:       mediaKind,
        onProgress: (d, t) => _setProgress(true, d / t)
      });
      let tCum = 0;
      _mk.thumbs = res.frames.map(f => {
        const thumb = { tMs: tCum, bitmap: f.bitmap };
        tCum += f.delayMs;
        return thumb;
      });
      _mk.fullFrames = res.frames;
      _mk.durationMs = res.totalDurationMs;
    } else {
      throw new Error('Unsupported media kind: ' + mediaKind);
    }
  } catch (e) {
    if (e && e.message === 'aborted') return;
    _setProgress(false);
    const warn = document.getElementById('markerWarn');
    warn.textContent = 'Failed to load frames: ' + (e && e.message ? e.message : String(e));
    warn.classList.remove('hidden');
    return;
  }
  _setProgress(false);

  // Restore saved markers (per the user's preference; matches the existing
  // session every time the same clip is re-opened).
  try {
    const cached = await processedCache.get(fileKey);
    if (cached && Array.isArray(cached.markers)) {
      _mk.markers = cached.markers.slice().sort((a, b) => a - b);
    }
  } catch (_) {}

  _renderStrip();
  _renderStats();
}

function closeMarker() {
  if (_mk.abortCtl) { try { _mk.abortCtl.abort(); } catch (_) {} }
  _mk.isOpen     = false;
  _mk.fileKey    = null;
  _mk.thumbs     = [];
  _mk.fullFrames = [];
  _mk.markers    = [];
  _mk.abortCtl   = null;
  document.getElementById('markerActive').classList.add('hidden');
  document.getElementById('markerEmpty').classList.remove('hidden');
  document.getElementById('markerStrip').innerHTML = '';
  _setProgress(false);
}

function _clearMarkers() {
  _mk.markers = [];
  _renderStrip();
  _renderStats();
}

function _previewMarkers() {
  const stats = _computeStats();
  if (!stats.sourceBPM) return;
  if (currentVideo !== _mk.fileKey) return;
  setNative(stats.sourceBPM);  // applyBPM() handles video + sprite paths
  if (mediaMode === 'video' && vid.paused) vid.play().catch(() => {});
}

async function _saveMarkers() {
  const stats = _computeStats();
  if (!stats.sourceBPM || _mk.markers.length < MARKER_MIN) return;
  const record = {
    sourceBPM: stats.sourceBPM,
    markers:   _mk.markers.slice(),
    mediaKind: _mk.mediaKind
  };

  // For animated images, also build (and cache) a sprite sheet so future
  // loads of this clip can skip the decode + composite step.
  if (_mk.mediaKind === 'gif' || _mk.mediaKind === 'webp') {
    _setProgress(true, null, 'Building sprite sheet…');
    try {
      const sprite = await buildSpriteSheet(_mk.fullFrames);
      record.sprite = {
        blob:           sprite.blob,
        frameW:         sprite.frameW,
        frameH:         sprite.frameH,
        count:          sprite.count,
        baseDurationMs: sprite.baseDurationMs
      };
      if (sprite.warnings && sprite.warnings.length) {
        const warn = document.getElementById('markerWarn');
        warn.textContent = 'Sprite is ' + sprite.warnings.join(', ') + '. May stutter on low-end devices.';
        warn.classList.remove('hidden');
      }
    } catch (e) {
      _setProgress(false);
      const warn = document.getElementById('markerWarn');
      warn.textContent = 'Sprite build failed: ' + (e && e.message ? e.message : String(e));
      warn.classList.remove('hidden');
      return;
    }
    _setProgress(false);
  }

  try {
    await processedCache.put(_mk.fileKey, record);
  } catch (e) {
    const warn = document.getElementById('markerWarn');
    warn.textContent = 'Could not save: ' + (e && e.message ? e.message : String(e));
    warn.classList.remove('hidden');
    return;
  }

  if (typeof markLibraryItemAsMarked === 'function') {
    markLibraryItemAsMarked(_mk.fileKey, true);
  }

  // Apply immediately if the saved clip is the one currently on stage.
  if (currentVideo === _mk.fileKey) {
    if (record.sprite) {
      // Re-enter loadVideo so it picks up the new cache entry and swaps
      // to sprite-mode playback.
      const activeItem = document.querySelector('.video-item.active');
      if (typeof loadVideo === 'function') loadVideo(_mk.fileKey, activeItem);
    } else {
      setNative(stats.sourceBPM);
    }
  }
  closeMarker();
}

function setupMarker() {
  const close = document.getElementById('markerCloseBtn');
  const clear = document.getElementById('markerClearBtn');
  const save  = document.getElementById('markerSaveBtn');
  const prev  = document.getElementById('markerPreviewBtn');
  if (close) close.addEventListener('click', () => closeMarker());
  if (clear) clear.addEventListener('click', _clearMarkers);
  if (save)  save.addEventListener('click',  _saveMarkers);
  if (prev)  prev.addEventListener('click',  _previewMarkers);
}
