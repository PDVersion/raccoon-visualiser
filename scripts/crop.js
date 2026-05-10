'use strict';

// ═══════════════════════════════════════════════════════════════════
// CROP DRAWING + ZOOM — rubber-band/freeform drawing on a canvas, and
// the +/- buttons / wheel that drive zoomLevel through the transform.
// ═══════════════════════════════════════════════════════════════════

function screenToNorm(clientX, clientY) {
  const wrapId = isFS ? 'fsVideoWrap' : 'videoWrap';
  const wrap   = document.getElementById(wrapId);
  const rect   = wrap.getBoundingClientRect();
  const { offX, offY, rendW, rendH } = getRenderedBounds(wrap);
  return {
    nx: (clientX - rect.left - offX) / rendW,
    ny: (clientY - rect.top  - offY) / rendH
  };
}

function drawRubberBand(canvas, x0, y0, x1, y1) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  if (cropShape === 'circle') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const r  = Math.hypot(x1 - x0, y1 - y0) / 2;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
    ctx.rect(rx, ry, rw, rh);
  }
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#ffb800';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (cropShape === 'circle') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const r  = Math.hypot(x1 - x0, y1 - y0) / 2;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
    ctx.strokeRect(rx, ry, rw, rh);
    const cs = 6;
    ctx.fillStyle = '#ffb800';
    ctx.setLineDash([]);
    [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) =>
      ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs)
    );
  }
}

function drawFreeformPath(canvas, points) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!points || points.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#ffb800';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}

function setupCropDraw(canvasId) {
  const canvas = document.getElementById(canvasId);

  function onDown(clientX, clientY) {
    if (!cropDrawMode) return false;
    cropDrawing = true;
    const rect = canvas.getBoundingClientRect();
    cropDragPx   = { x0: clientX - rect.left, y0: clientY - rect.top };
    cropDragNorm = screenToNorm(clientX, clientY);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cropShape === 'freeform') {
      lastFreeformPxPath = [{ x: cropDragPx.x0, y: cropDragPx.y0, nx: cropDragNorm.nx, ny: cropDragNorm.ny }];
    } else {
      lastFreeformPxPath = null;
    }
    return true;
  }
  function onMove(clientX, clientY) {
    if (!cropDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const px1  = clientX - rect.left, py1 = clientY - rect.top;
    if (cropShape === 'freeform') {
      const norm = screenToNorm(clientX, clientY);
      lastFreeformPxPath.push({ x: px1, y: py1, nx: norm.nx, ny: norm.ny });
      drawFreeformPath(canvas, lastFreeformPxPath);
    } else {
      drawRubberBand(canvas, cropDragPx.x0, cropDragPx.y0, px1, py1);
    }
  }
  function onUp(clientX, clientY) {
    if (!cropDrawing) return;
    cropDrawing = false;
    const end = screenToNorm(clientX, clientY);

    if (cropShape === 'freeform') {
      const path = lastFreeformPxPath || [];
      if (path.length > 3) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of path) {
          if (p.nx < minX) minX = p.nx;
          if (p.ny < minY) minY = p.ny;
          if (p.nx > maxX) maxX = p.nx;
          if (p.ny > maxY) maxY = p.ny;
        }
        const w = maxX - minX, h = maxY - minY;
        if (w > 0.02 && h > 0.02) {
          crop = { x: minX, y: minY, w, h };
          cropPath = path.map(p => ({ nx: p.nx, ny: p.ny }));
          hasCrop = true;
        }
      }
      lastFreeformPxPath = null;
    } else if (cropShape === 'circle') {
      const cx = (cropDragNorm.nx + end.nx) / 2;
      const cy = (cropDragNorm.ny + end.ny) / 2;
      const r  = Math.hypot(end.nx - cropDragNorm.nx, end.ny - cropDragNorm.ny) / 2;
      if (r > 0.01) {
        crop = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
        cropPath = null;
        hasCrop = true;
      }
    } else { // rect
      const x = Math.min(cropDragNorm.nx, end.nx);
      const y = Math.min(cropDragNorm.ny, end.ny);
      const w = Math.abs(end.nx - cropDragNorm.nx);
      const h = Math.abs(end.ny - cropDragNorm.ny);
      if (w > 0.02 && h > 0.02) {
        crop = { x, y, w, h };
        cropPath = null;
        hasCrop = true;
      }
    }
    exitCropMode();
    applyVideoTransform();
  }

  canvas.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  canvas.addEventListener('mouseup',   e => onUp(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', e => {
    // If mouse leaves canvas mid-draw, commit what we have.
    if (cropDrawing) onUp(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    onDown(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive:false});
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.changedTouches.length)
      onUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, {passive:false});
}

function enterCropMode() {
  cropDrawMode = true;
  const canvasId = isFS ? 'fsCropCanvas' : 'cropCanvas';
  const wrapId   = isFS ? 'fsVideoWrap'  : 'videoWrap';
  const canvas   = document.getElementById(canvasId);
  const wrap     = document.getElementById(wrapId);
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  Object.assign(canvas.style, {
    position:'absolute', inset:'0',
    width:  wrap.clientWidth  + 'px',
    height: wrap.clientHeight + 'px',
    display: 'block',
    cursor:  'crosshair',
    zIndex:  '25'
  });
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function exitCropMode() {
  cropDrawMode = false; cropDrawing = false;
  document.getElementById('cropCanvas').style.display   = 'none';
  document.getElementById('fsCropCanvas').style.display = 'none';
  document.getElementById('cropToggleBtn').classList.remove('active');
  document.getElementById('fsCropBtn').classList.remove('y');
}

function resetCrop() {
  crop = { x:0, y:0, w:1, h:1 }; hasCrop = false; zoomLevel = 1;
  cropPath = null;
  exitCropMode();
  document.getElementById('cropSvg').classList.remove('vis');
  document.getElementById('fsCropSvg').classList.remove('vis');
  applyVideoTransform();
}

function adjustZoom(delta) {
  zoomLevel = Math.max(0.1, Math.min(10, zoomLevel + delta));
  applyVideoTransform();
}

function setupCrop() {
  setupCropDraw('cropCanvas');
  setupCropDraw('fsCropCanvas');

  document.getElementById('cropToggleBtn').addEventListener('click', () => {
    if (cropDrawMode) { exitCropMode(); return; }
    document.getElementById('cropToggleBtn').classList.add('active');
    enterCropMode();
  });
  document.getElementById('fsCropBtn').addEventListener('click', () => {
    if (cropDrawMode) { exitCropMode(); return; }
    document.getElementById('fsCropBtn').classList.add('y');
    enterCropMode();
  });

  document.getElementById('cropResetBtn').addEventListener('click',   resetCrop);
  document.getElementById('fsCropResetBtn').addEventListener('click', resetCrop);

  document.getElementById('zoomIn').addEventListener('click',     () => adjustZoom( 0.1));
  document.getElementById('zoomOut').addEventListener('click',    () => adjustZoom(-0.1));
  document.getElementById('fsZoomInBtn').addEventListener('click', () => adjustZoom( 0.1));
  document.getElementById('fsZoomOutBtn').addEventListener('click',() => adjustZoom(-0.1));

  ['videoWrap','fsVideoWrap'].forEach(id =>
    document.getElementById(id).addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey || isFS) {
        e.preventDefault();
        adjustZoom(e.deltaY < 0 ? 0.05 : -0.05);
      }
    }, {passive:false})
  );
}
