'use strict';

// ═══════════════════════════════════════════════════════════════════
// VIDEO TRANSFORM — composes zoom + crop into a single CSS transform
// on the active media element, and projects the crop overlay through
// that same transform so it stays aligned at every zoom level.
// ═══════════════════════════════════════════════════════════════════

function getRenderedBounds(wrapEl) {
  const wW = wrapEl.clientWidth, wH = wrapEl.clientHeight;
  const sz = getActiveSize();
  const vW = sz.w, vH = sz.h;
  const wAR = wW / wH, vAR = vW / vH;
  let rendW, rendH;
  if (vAR > wAR) { rendW = wW; rendH = wW / vAR; }
  else           { rendH = wH; rendW = wH * vAR; }
  return { offX:(wW-rendW)/2, offY:(wH-rendH)/2, rendW, rendH, wW, wH };
}

function applyVideoTransform() {
  const wrapId = isFS ? 'fsVideoWrap' : 'videoWrap';
  const wrap   = document.getElementById(wrapId);
  const { offX, offY, rendW, rendH, wW, wH } = getRenderedBounds(wrap);
  if (!rendW || !rendH) return;

  const cxPx = crop.x * rendW, cyPx = crop.y * rendH;
  const cwPx = crop.w * rendW, chPx = crop.h * rendH;
  const baseScale = Math.min(wW / cwPx, wH / chPx);
  const scale = baseScale * zoomLevel;
  const cropCX = offX + cxPx + cwPx / 2;
  const cropCY = offY + cyPx + chPx / 2;
  const tx = wW / 2 - cropCX * scale;
  const ty = wH / 2 - cropCY * scale;

  // Apply transform to the active media element only; clear the inactive one.
  const active = getActiveMedia();
  active.style.transformOrigin = 'top left';
  active.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  const inactive = active === vid ? vidImg : vid;
  inactive.style.transform = '';

  const zpct = Math.round(zoomLevel * 100);
  document.getElementById('zoomVal').textContent  = zpct + '%';
  document.getElementById('fsZoomVal').textContent = zpct + '%';

  drawCropOverlay(wrapId, offX, offY, rendW, rendH, wW, wH, tx, ty, scale);
}

function drawCropOverlay(wrapId, offX, offY, rendW, rendH, wW, wH, tx, ty, scale) {
  const svgId = wrapId === 'fsVideoWrap' ? 'fsCropSvg' : 'cropSvg';
  const svg   = document.getElementById(svgId);
  if (!hasCrop) { svg.classList.remove('vis'); return; }

  // Project a point that lives in the wrap's pre-transform coordinate space
  // through the same translate+scale that's applied to the media element,
  // and normalize to the wrap's [0..1] viewBox. This is what makes the
  // crop overlay align with the now-zoomed-in media after applyVideoTransform.
  const proj  = (px, py) => ({ x: (px * scale + tx) / wW, y: (py * scale + ty) / wH });
  const projR = (px, py) => ({ w: (px * scale) / wW,      h: (py * scale) / wH });

  const cs = 0.013;
  const outsideFill = cropBgColor || 'rgba(0,0,0,0.5)';

  let cutoutShape;
  let borderShape = '';
  if (cropShape === 'circle') {
    const cxPx = offX + crop.x * rendW + (crop.w * rendW) / 2;
    const cyPx = offY + crop.y * rendH + (crop.h * rendH) / 2;
    const c = proj(cxPx, cyPx);
    // Use the smaller of the two scaled radii so the circle stays a circle
    // even when the wrap's aspect ratio differs from the media's.
    const rN = Math.min(crop.w * rendW, crop.h * rendH) / 2 * scale / Math.min(wW, wH);
    cutoutShape = `<circle cx="${c.x}" cy="${c.y}" r="${rN}" fill="black"/>`;
    if (!cropBgColor) {
      borderShape = `<circle cx="${c.x}" cy="${c.y}" r="${rN}"
        fill="none" stroke="#ffb800" stroke-width="0.004" stroke-dasharray="0.02 0.012"/>`;
    }
  } else if (cropShape === 'freeform' && cropPath && cropPath.length > 2) {
    const pts = cropPath.map(p => {
      const px = offX + p.nx * rendW;
      const py = offY + p.ny * rendH;
      const pp = proj(px, py);
      return `${pp.x.toFixed(4)},${pp.y.toFixed(4)}`;
    }).join(' ');
    cutoutShape = `<polygon points="${pts}" fill="black"/>`;
    if (!cropBgColor) {
      borderShape = `<polygon points="${pts}" fill="none"
        stroke="#ffb800" stroke-width="0.004" stroke-dasharray="0.02 0.012"/>`;
    }
  } else { // rect
    const a = proj(offX + crop.x * rendW, offY + crop.y * rendH);
    const r = projR(crop.w * rendW, crop.h * rendH);
    const nx1 = a.x, ny1 = a.y, nw = r.w, nh = r.h;
    cutoutShape = `<rect x="${nx1}" y="${ny1}" width="${nw}" height="${nh}" fill="black"/>`;
    if (!cropBgColor) {
      borderShape = `
        <rect x="${nx1}" y="${ny1}" width="${nw}" height="${nh}"
              fill="none" stroke="#ffb800" stroke-width="0.004" stroke-dasharray="0.02 0.012"/>
        <rect x="${nx1-cs/2}" y="${ny1-cs/2}" width="${cs}" height="${cs}" fill="#ffb800"/>
        <rect x="${nx1+nw-cs/2}" y="${ny1-cs/2}" width="${cs}" height="${cs}" fill="#ffb800"/>
        <rect x="${nx1-cs/2}" y="${ny1+nh-cs/2}" width="${cs}" height="${cs}" fill="#ffb800"/>
        <rect x="${nx1+nw-cs/2}" y="${ny1+nh-cs/2}" width="${cs}" height="${cs}" fill="#ffb800"/>
      `;
    }
  }

  svg.setAttribute('viewBox', '0 0 1 1');
  svg.innerHTML = `
    <defs>
      <mask id="cm${svgId}">
        <rect x="0" y="0" width="1" height="1" fill="white"/>
        ${cutoutShape}
      </mask>
    </defs>
    <rect x="0" y="0" width="1" height="1" fill="${outsideFill}" mask="url(#cm${svgId})"/>
    ${borderShape}
  `;
  svg.classList.add('vis');
}
