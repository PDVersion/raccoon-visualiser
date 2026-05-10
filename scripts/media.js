'use strict';

// ═══════════════════════════════════════════════════════════════════
// MEDIA HELPERS — extension parsing + active-media accessors used by
// every other script that has to handle both video and image clips.
// ═══════════════════════════════════════════════════════════════════

var IMAGE_EXTS = ['gif', 'webp', 'apng', 'png', 'jpg', 'jpeg'];

function extOf(name) {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function isImageMedia(name) {
  return IMAGE_EXTS.includes(extOf(name));
}

function getActiveMedia() {
  if (mediaMode === 'sprite') return vidSprite;
  if (mediaMode === 'image')  return vidImg;
  return vid;
}

function getActiveSize() {
  if (mediaMode === 'sprite') {
    const meta = (typeof currentSpriteMeta === 'function') ? currentSpriteMeta() : null;
    if (meta) return { w: meta.frameW, h: meta.frameH };
    return { w: vidSprite.clientWidth || 1, h: vidSprite.clientHeight || 1 };
  }
  if (mediaMode === 'image') return { w: vidImg.naturalWidth || 1, h: vidImg.naturalHeight || 1 };
  return { w: vid.videoWidth || 9, h: vid.videoHeight || 16 };
}

function fmtDur(s) {
  if (!isFinite(s) || s <= 0) return '';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
