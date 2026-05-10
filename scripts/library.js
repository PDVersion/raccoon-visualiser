'use strict';

// ═══════════════════════════════════════════════════════════════════
// MEDIA LIBRARY — reads resources/manifest.json (the single source of
// truth) and renders a clickable list. Click a row to load the file
// into the main video/image stage.
// ═══════════════════════════════════════════════════════════════════

function buildVideoItem(filename, isActive) {
  const item = document.createElement('div');
  item.className = 'video-item' + (isActive ? ' active' : '');
  const name  = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const isImg = isImageMedia(filename);
  const icon  = isImg ? '◉' : '▶';
  const tag   = isImg ? `<span class="video-item-tag">${extOf(filename).toUpperCase()}</span>` : '';
  item.innerHTML = `
    <span class="video-item-icon">${icon}</span>
    <span class="video-item-name" title="${filename}">${name}</span>
    ${tag}
    <span class="video-item-dur" id="vdur-${encodeURIComponent(filename)}"></span>
  `;
  item.addEventListener('click', () => loadVideo(MEDIA_FOLDER + '/' + filename, item));

  // Probe duration in background — videos only.
  if (!isImg) {
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = MEDIA_FOLDER + '/' + filename;
    probe.addEventListener('loadedmetadata', () => {
      const el = document.getElementById('vdur-' + encodeURIComponent(filename));
      if (el) el.textContent = fmtDur(probe.duration);
      probe.src = '';
    });
  }

  return item;
}

async function loadVideoList() {
  const listEl = document.getElementById('videoList');

  let files = [];
  try {
    const res = await fetch(MEDIA_FOLDER + '/manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) files = data.filter(f => typeof f === 'string');
    }
  } catch (_) { /* fall through to empty */ }

  listEl.innerHTML = '';

  if (files.length === 0) {
    listEl.innerHTML = `<div class="no-videos">No media found.<br>
      Add files to <code>${MEDIA_FOLDER}/</code> and list them in
      <code>${MEDIA_FOLDER}/manifest.json</code>.</div>`;
    return;
  }

  const items = files.map((f, i) => {
    const item = buildVideoItem(f, i === 0);
    listEl.appendChild(item);
    return item;
  });

  // Autoload the first manifest entry so the stage always reflects the manifest.
  loadVideo(MEDIA_FOLDER + '/' + files[0], items[0]);
}

function loadVideo(src, itemEl) {
  currentVideo = src;
  // Reset everything
  hasCrop = false; crop = { x:0, y:0, w:1, h:1 }; zoomLevel = 1;
  cropPath = null;
  loopEnabled = false; syncLoopBtns();
  nativeBPM = null;
  const nd = document.getElementById('nativeDisplay');  if (nd) nd.textContent = '--';
  const ir = document.getElementById('infoRow');
  if (ir) ir.textContent =
    'Tap the beat of the video to set native BPM, then pick a target BPM above.\nVideo playback rate = Target ÷ Native.';
  document.querySelectorAll('.video-item').forEach(el => el.classList.remove('active'));
  if (itemEl) itemEl.classList.add('active');
  ['cropSvg','fsCropSvg'].forEach(id => document.getElementById(id).classList.remove('vis'));

  const filename  = src.split('/').pop();
  const wantImage = isImageMedia(filename);

  if (wantImage) {
    // Stop any video playback and switch to image mode
    try { vid.pause(); } catch (_) {}
    vid.removeAttribute('src');
    vid.load();
    mediaMode = 'image';
    document.getElementById('videoWrap').dataset.mode = 'image';
    vid.hidden = true;
    vidImg.hidden = false;
    vidImg.style.transform = '';
    vidImg.src = src;
  } else {
    mediaMode = 'video';
    document.getElementById('videoWrap').dataset.mode = 'video';
    vidImg.hidden = true;
    vid.hidden = false;
    vidImg.removeAttribute('src');
    vid.src = src;
    vid.load();
  }
  updatePanelVisibilityForMode();
  applyVideoTransform();
}

function updatePanelVisibilityForMode() {
  const isImage = mediaMode === 'image';
  document.querySelectorAll('[data-needs="video"]').forEach(el => {
    el.classList.toggle('hidden-by-mode', isImage);
  });
}

// ── Adapt the video-wrap aspect ratio when new media loads ──
function onMediaReady(natW, natH) {
  if (mediaMode === 'video') {
    DURATION = vid.duration || DURATION;
    loopA = 0; loopB = DURATION;
    updateTimeline();
  }
  applyBPM();

  const wrap  = document.getElementById('videoWrap');
  const stage = document.getElementById('videoStage');
  if (natW && natH && stage) {
    const ar = natW / natH;
    const stageW = stage.clientWidth  || 480;
    const stageH = stage.clientHeight || 360;
    let w = stageW, h = stageW / ar;
    if (h > stageH) { h = stageH; w = stageH * ar; }
    wrap.style.width  = w + 'px';
    wrap.style.height = h + 'px';
  }

  applyVideoTransform();
  if (mediaMode === 'video') {
    vid.play().catch(() => {});
    syncPlayBtns();
  }
}

function setupLibrary() {
  vid.addEventListener('loadedmetadata', () => {
    if (mediaMode !== 'video') return;
    onMediaReady(vid.videoWidth, vid.videoHeight);
  });
  vidImg.addEventListener('load', () => {
    if (mediaMode !== 'image') return;
    onMediaReady(vidImg.naturalWidth, vidImg.naturalHeight);
  });
}
