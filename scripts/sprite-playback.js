'use strict';

// ═══════════════════════════════════════════════════════════════════
// SPRITE PLAYBACK — drives #vidSprite with a CSS @keyframes animation
// that scrubs through a horizontal sprite sheet via background-position.
// The animation duration is controlled by a CSS custom property that
// applyBPM() updates live, so Spotify track changes retime smoothly
// without restarting the animation.
//
// Math:
//   At the source BPM, one full sprite loop takes `baseDurationMs`
//   (the sum of the original per-frame delays). To play it at the
//   target BPM, scale the duration by sourceBPM / targetBPM.
// ═══════════════════════════════════════════════════════════════════

var _spriteCurrent = null;
var _spriteAnimSeq = 0;

function isSpriteMounted() {
  return !!_spriteCurrent;
}

function mountSprite(meta, sourceBPM) {
  unmountSprite();
  if (!meta || !meta.blob || !vidSprite) return;

  const blobUrl  = URL.createObjectURL(meta.blob);
  const animName = 'spriteAnim_' + (++_spriteAnimSeq);
  const styleEl  = document.createElement('style');
  styleEl.textContent =
    '@keyframes ' + animName + ' {' +
      'from { background-position: 0 0; }' +
      'to   { background-position: -' + (meta.count * meta.frameW) + 'px 0; }' +
    '}';
  document.head.appendChild(styleEl);

  vidSprite.style.width            = meta.frameW + 'px';
  vidSprite.style.height           = meta.frameH + 'px';
  vidSprite.style.backgroundImage  = 'url("' + blobUrl + '")';
  vidSprite.style.backgroundRepeat = 'no-repeat';
  vidSprite.style.backgroundPosition = '0 0';
  vidSprite.style.animation =
    animName + ' var(--sprite-duration, ' + meta.baseDurationMs + 'ms) steps(' + meta.count + ') infinite';

  _spriteCurrent = {
    blob:           meta.blob,
    blobUrl:        blobUrl,
    frameW:         meta.frameW,
    frameH:         meta.frameH,
    count:          meta.count,
    baseDurationMs: meta.baseDurationMs,
    sourceBPM:      sourceBPM,
    styleEl:        styleEl,
    animName:       animName
  };

  setSpriteBpm(targetBPM);
}

function setSpriteBpm(target) {
  if (!_spriteCurrent || !vidSprite) return;
  // Honour the global nativeBPM so a tap-tempo override or any setNative()
  // call (e.g. on load from the processed-media cache) takes effect — same
  // as the video path going through applyBPM().
  const src = nativeBPM || _spriteCurrent.sourceBPM;
  if (!src || !target) {
    vidSprite.style.setProperty('--sprite-duration', _spriteCurrent.baseDurationMs + 'ms');
    return;
  }
  const dur = _spriteCurrent.baseDurationMs * (src / target);
  vidSprite.style.setProperty('--sprite-duration', dur + 'ms');
}

function unmountSprite() {
  if (!_spriteCurrent) return;
  if (vidSprite) {
    vidSprite.style.animation       = 'none';
    vidSprite.style.backgroundImage = '';
    vidSprite.style.width           = '';
    vidSprite.style.height          = '';
    vidSprite.style.removeProperty('--sprite-duration');
  }
  if (_spriteCurrent.styleEl && _spriteCurrent.styleEl.parentNode) {
    _spriteCurrent.styleEl.parentNode.removeChild(_spriteCurrent.styleEl);
  }
  if (_spriteCurrent.blobUrl) {
    try { URL.revokeObjectURL(_spriteCurrent.blobUrl); } catch (_) {}
  }
  _spriteCurrent = null;
}

function currentSpriteMeta() {
  return _spriteCurrent;
}
