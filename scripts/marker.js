'use strict';

// ═══════════════════════════════════════════════════════════════════
// BEAT-MARKER PANEL — user clicks frame thumbnails where a beat lands
// (peak of a bounce, downbeat of a spin, etc). The mean inter-marker
// interval gives the clip's source BPM. Saving persists the BPM and
// the markers so the next load auto-applies it.
//
// In phase 2 only the video path is wired; phase 3 will extend
// extractThumbs() to handle animated images.
// ═══════════════════════════════════════════════════════════════════

var MARKER_MIN          = 4;       // minimum markers required to save
var MARKER_IRREG_THRESH = 0.15;    // stddev / mean — beyond this we warn
var MARKER_RATE_MIN     = 0.25;    // recommended playback-rate range
var MARKER_RATE_MAX     = 2.0;

var _mk = {
  fileKey:    null,
  mediaKind:  null,
  thumbs:     [],     // [{ tSec, bitmap }] (video); image variant added in phase 3
  markers:    [],     // marker positions in seconds, sorted ascending
  abortCtl:   null,
  isOpen:     false
};

function _halfWindowSec() {
  if (_mk.thumbs.length < 2) return 0.1;
  return (_mk.thumbs[1].tSec - _mk.thumbs[0].tSec) / 2;
}

function _computeStats() {
  if (_mk.markers.length < 2) {
    return { sourceBPM: null, mean: 0, stddev: 0 };
  }
  const ints = [];
  for (let i = 1; i < _mk.markers.length; i++) {
    ints.push((_mk.markers[i] - _mk.markers[i - 1]) * 1000);
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
  const t   = _mk.thumbs[thumbIdx].tSec;
  const win = _halfWindowSec();
  const hit = _mk.markers.findIndex(m => Math.abs(m - t) < win);
  if (hit >= 0) _mk.markers.splice(hit, 1);
  else { _mk.markers.push(t); _mk.markers.sort((a, b) => a - b); }
  _renderStrip();
  _renderStats();
}

function _renderStrip() {
  const strip = document.getElementById('markerStrip');
  strip.innerHTML = '';
  const win = _halfWindowSec();
  _mk.thumbs.forEach((thumb, idx) => {
    const cell = document.createElement('div');
    cell.className = 'marker-cell';
    const isMarked = _mk.markers.some(m => Math.abs(m - thumb.tSec) < win);
    if (isMarked) cell.classList.add('marked');
    const c = bitmapToCanvas(thumb.bitmap);
    cell.appendChild(c);
    const label = document.createElement('span');
    label.className = 'marker-cell-label';
    label.textContent = thumb.tSec.toFixed(1) + 's';
    cell.appendChild(label);
    cell.addEventListener('click', () => _toggleMarkerAt(idx));
    strip.appendChild(cell);
  });
}

function _setProgress(visible, pct) {
  const p   = document.getElementById('markerProgress');
  const out = document.getElementById('markerProgressPct');
  if (!p) return;
  if (!visible) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  if (out) out.textContent = (pct != null ? Math.round(pct * 100) + '%' : '…');
}

async function openMarker(fileKey, mediaKind) {
  if (_mk.isOpen) closeMarker();
  _mk.fileKey   = fileKey;
  _mk.mediaKind = mediaKind;
  _mk.thumbs    = [];
  _mk.markers   = [];
  _mk.isOpen    = true;
  _mk.abortCtl  = ('AbortController' in window) ? new AbortController() : null;

  const panel = document.querySelector('.panel[data-panel-id="markers"]');
  if (panel) panel.classList.remove('collapsed');
  document.getElementById('markerEmpty').classList.add('hidden');
  document.getElementById('markerActive').classList.remove('hidden');
  document.getElementById('markerFilename').textContent = fileKey.split('/').pop();
  document.getElementById('markerStrip').innerHTML = '';
  _renderStats();

  _setProgress(true, 0);
  try {
    if (mediaKind === 'video') {
      const res = await extractVideoThumbnails(fileKey, {
        onProgress: (d, t) => _setProgress(true, d / t),
        signal:     _mk.abortCtl ? _mk.abortCtl.signal : undefined
      });
      _mk.thumbs = res.thumbs.map(t => ({ tSec: t.t, bitmap: t.bitmap }));
    } else {
      throw new Error('Animated-image marker is built in phase 3');
    }
  } catch (e) {
    if (e && e.message === 'aborted') return;
    _setProgress(false);
    const warn = document.getElementById('markerWarn');
    warn.textContent = 'Failed to extract frames: ' + (e && e.message ? e.message : String(e));
    warn.classList.remove('hidden');
    return;
  }
  _setProgress(false);

  // Restore saved markers
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
  _mk.isOpen   = false;
  _mk.fileKey  = null;
  _mk.thumbs   = [];
  _mk.markers  = [];
  _mk.abortCtl = null;
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
  if (currentVideo === _mk.fileKey) {
    setNative(stats.sourceBPM);
    if (mediaMode === 'video' && vid.paused) vid.play().catch(() => {});
  }
}

async function _saveMarkers() {
  const stats = _computeStats();
  if (!stats.sourceBPM || _mk.markers.length < MARKER_MIN) return;
  await processedCache.put(_mk.fileKey, {
    sourceBPM: stats.sourceBPM,
    markers:   _mk.markers.slice(),
    mediaKind: _mk.mediaKind
  });
  if (currentVideo === _mk.fileKey) setNative(stats.sourceBPM);
  if (typeof markLibraryItemAsMarked === 'function') {
    markLibraryItemAsMarked(_mk.fileKey, true);
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
