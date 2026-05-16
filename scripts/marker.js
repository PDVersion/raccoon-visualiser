'use strict';

// ═══════════════════════════════════════════════════════════════════
// SOURCE BPM EDITOR — repurposed marker panel. Lets the user override
// the active clip's source BPM live (session only) and copy a snippet
// to paste back into resources/manifest.json for persistence.
//
// All edits route through setNative(), the same pipeline tap-tempo
// uses, so playback rate updates immediately for video. Animated
// images currently play at native rate regardless — retiming for them
// is dormant scaffolding (see scripts/sprite*.js, scripts/decode.js).
// ═══════════════════════════════════════════════════════════════════

function _statusText() {
  if (!currentVideo) return 'No clip loaded';
  if (nativeBPM == null) {
    return currentManifestBPM
      ? 'Manifest BPM not yet applied — pick a target BPM to start playback'
      : 'Not set — type a BPM above';
  }
  if (currentManifestBPM != null && Math.abs(nativeBPM - currentManifestBPM) < 0.05) {
    return 'From manifest';
  }
  return currentManifestBPM != null
    ? `Session override (manifest: ${currentManifestBPM})`
    : 'Session override (no manifest value)';
}

function refreshSourceBpmEditor() {
  const input  = document.getElementById('sourceBpmInput');
  const status = document.getElementById('sourceBpmStatus');
  const reset  = document.getElementById('sourceBpmResetBtn');
  const copy   = document.getElementById('sourceBpmCopyBtn');
  if (!input || !status) return;

  const hasClip = !!currentVideo;
  input.disabled = !hasClip;
  copy.disabled  = !hasClip || nativeBPM == null;
  reset.disabled = !hasClip || currentManifestBPM == null
    || (nativeBPM != null && Math.abs(nativeBPM - currentManifestBPM) < 0.05);

  // Only overwrite the input if the user isn't actively editing it.
  if (document.activeElement !== input) {
    input.value = (nativeBPM != null) ? nativeBPM.toFixed(1) : '';
  }
  status.textContent = _statusText();
}

function _onInputChange() {
  const input = document.getElementById('sourceBpmInput');
  const v = parseFloat(input.value);
  if (!isFinite(v) || v <= 0) return;
  setNative(v);
}

function _onReset() {
  if (currentManifestBPM != null) setNative(currentManifestBPM);
}

async function _onCopyJson() {
  if (!currentVideo || nativeBPM == null) return;
  const filename = currentVideo.split('/').pop();
  const snippet  = JSON.stringify({ filename, sourceBPM: parseFloat(nativeBPM.toFixed(2)) });
  const status   = document.getElementById('sourceBpmStatus');
  try {
    await navigator.clipboard.writeText(snippet);
    if (status) {
      const original = status.textContent;
      status.textContent = 'Copied — paste into resources/manifest.json';
      setTimeout(() => { if (status.textContent.startsWith('Copied')) refreshSourceBpmEditor(); }, 1800);
    }
  } catch (_) {
    // Clipboard unavailable (insecure context, denied, etc) — surface the snippet.
    if (status) status.textContent = 'Copy failed — snippet: ' + snippet;
  }
}

function setupMarker() {
  const input = document.getElementById('sourceBpmInput');
  const reset = document.getElementById('sourceBpmResetBtn');
  const copy  = document.getElementById('sourceBpmCopyBtn');
  if (!input) return;

  input.addEventListener('change', _onInputChange);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') _onInputChange(); });
  reset.addEventListener('click',  _onReset);
  copy.addEventListener('click',   _onCopyJson);

  refreshSourceBpmEditor();
}
