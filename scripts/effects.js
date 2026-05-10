'use strict';

// ═══════════════════════════════════════════════════════════════════
// EFFECTS — crop shape selector, outside-crop colour palette, and the
// "bounce" arena that floats the cropped frame around DVD-screensaver
// style. Bounce composes with the existing crop transform in FS mode.
// ═══════════════════════════════════════════════════════════════════

function getBounceTargets() {
  if (isFS) {
    // Move the active media element inside the fullscreen wrap.
    const stage = document.getElementById('fsVideoWrap');
    const mover = getActiveMedia();
    return { stage, mover, useMediaTransform: true };
  }
  const stage = document.getElementById('videoStage');
  const mover = document.getElementById('videoWrap');
  return { stage, mover, useMediaTransform: false };
}

function getBounceArea() {
  const { stage } = getBounceTargets();
  return { w: stage.clientWidth, h: stage.clientHeight };
}

function applyBounceTransform() {
  const { mover, useMediaTransform } = getBounceTargets();
  if (useMediaTransform) {
    applyMediaTransformWithBounce(bounceX, bounceY);
  } else {
    mover.style.transform = `translate(${bounceX}px, ${bounceY}px)`;
  }
}

// Variant of applyVideoTransform that adds a bounce offset to the media's
// translate. Used in fullscreen mode where there is no separate wrap to move.
function applyMediaTransformWithBounce(bx, by) {
  const wrap = document.getElementById('fsVideoWrap');
  const { offX, offY, rendW, rendH, wW, wH } = getRenderedBounds(wrap);
  if (!rendW || !rendH) return;
  const cwPx = crop.w * rendW, chPx = crop.h * rendH;
  const baseScale = Math.min(wW / cwPx, wH / chPx);
  const scale = baseScale * zoomLevel;
  const cropCX = offX + crop.x * rendW + cwPx / 2;
  const cropCY = offY + crop.y * rendH + chPx / 2;
  const tx = wW / 2 - cropCX * scale + bx;
  const ty = wH / 2 - cropCY * scale + by;
  const active = getActiveMedia();
  active.style.transformOrigin = 'top left';
  active.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function bounceTick(now) {
  if (!bounceOn) { bounceRAF = null; return; }
  const dt = bounceLastT ? Math.min(0.05, (now - bounceLastT) / 1000) : 0;
  bounceLastT = now;

  const { stage, mover, useMediaTransform } = getBounceTargets();
  const w = stage.clientWidth, h = stage.clientHeight;

  let ww, wh;
  if (useMediaTransform) {
    ww = mover.clientWidth  || mover.naturalWidth  || 0;
    wh = mover.clientHeight || mover.naturalHeight || 0;
    ww = Math.min(ww, w);
    wh = Math.min(wh, h);
  } else {
    ww = mover.clientWidth;
    wh = mover.clientHeight;
  }

  bounceX += bounceVX * dt;
  bounceY += bounceVY * dt;

  const maxX = Math.max(0, w - ww);
  const maxY = Math.max(0, h - wh);
  if (bounceX < 0)    { bounceX = 0;    bounceVX = Math.abs(bounceVX); }
  if (bounceX > maxX) { bounceX = maxX; bounceVX = -Math.abs(bounceVX); }
  if (bounceY < 0)    { bounceY = 0;    bounceVY = Math.abs(bounceVY); }
  if (bounceY > maxY) { bounceY = maxY; bounceVY = -Math.abs(bounceVY); }

  applyBounceTransform();
  bounceRAF = requestAnimationFrame(bounceTick);
}

function startBounce() {
  bounceOn = true;
  const { stage, mover } = getBounceTargets();
  const w = stage.clientWidth, h = stage.clientHeight;
  const mw = mover.clientWidth || 0, mh = mover.clientHeight || 0;
  bounceX = Math.random() * Math.max(0, w - mw);
  bounceY = Math.random() * Math.max(0, h - mh);
  const angle = Math.random() * Math.PI * 2;
  bounceVX = Math.cos(angle) * bounceSpeedPx;
  bounceVY = Math.sin(angle) * bounceSpeedPx;
  bounceLastT = 0;
  const tb = document.getElementById('bounceToggle');
  tb.textContent = '↗ BOUNCE ON';
  tb.classList.add('active');
  bounceRAF = requestAnimationFrame(bounceTick);
}

function stopBounce() {
  bounceOn = false;
  if (bounceRAF) cancelAnimationFrame(bounceRAF);
  bounceRAF = null;
  bounceX = 0; bounceY = 0;
  document.getElementById('videoWrap').style.transform   = '';
  document.getElementById('fsVideoWrap').style.transform = '';
  applyVideoTransform();
  const tb = document.getElementById('bounceToggle');
  tb.textContent = '↗ BOUNCE OFF';
  tb.classList.remove('active');
}

// Reseed when entering/exiting fullscreen so position rescales into the
// new arena instead of being abruptly clipped.
function reseedBounceForArea() {
  const { stage, mover } = getBounceTargets();
  const w = stage.clientWidth, h = stage.clientHeight;
  const mw = mover.clientWidth || 0, mh = mover.clientHeight || 0;
  const maxX = Math.max(0, w - mw), maxY = Math.max(0, h - mh);
  bounceX = Math.min(Math.max(0, bounceX), maxX);
  bounceY = Math.min(Math.max(0, bounceY), maxY);
  if (maxX === 0) bounceX = 0;
  if (maxY === 0) bounceY = 0;
  document.getElementById('videoWrap').style.transform   = '';
  document.getElementById('fsVideoWrap').style.transform = '';
}

function setupEffects() {
  document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cropShape = btn.dataset.shape;
      if (hasCrop) applyVideoTransform();
    });
  });

  document.querySelectorAll('#colorPalette .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#colorPalette .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const c = sw.dataset.color;
      cropBgColor = (c === 'none') ? null : c;
      applyVideoTransform();
    });
  });

  document.getElementById('bounceToggle').addEventListener('click', () => {
    bounceOn ? stopBounce() : startBounce();
  });

  const bsEl  = document.getElementById('bounceSpeed');
  const bsVal = document.getElementById('bounceSpeedVal');
  bsEl.addEventListener('input', () => {
    bounceSpeedPx = parseFloat(bsEl.value);
    bsVal.textContent = bounceSpeedPx + ' px/s';
    const cur = Math.hypot(bounceVX, bounceVY) || 1;
    bounceVX = bounceVX / cur * bounceSpeedPx;
    bounceVY = bounceVY / cur * bounceSpeedPx;
  });
}
