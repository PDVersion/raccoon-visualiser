'use strict';

// ═══════════════════════════════════════════════════════════════════
// FULLSCREEN OVERLAY — moves the active media into a full-window
// container, drives the floating bar's auto-hide timer, and reseeds
// bounce when the arena size changes.
// ═══════════════════════════════════════════════════════════════════

function enterFS() {
  isFS = true;
  const fsOverlay = document.getElementById('fsOverlay');
  const fsVidWrap = document.getElementById('fsVideoWrap');

  fsOverlay.classList.add('active');
  // Move every media element so any kind (video / image / sprite) works in FS.
  fsVidWrap.insertBefore(vid,       document.getElementById('fsCropCanvas'));
  fsVidWrap.insertBefore(vidImg,    document.getElementById('fsCropCanvas'));
  fsVidWrap.insertBefore(vidSprite, document.getElementById('fsCropCanvas'));
  vid.style.maxWidth    = '100%'; vid.style.maxHeight    = '100%';
  vidImg.style.maxWidth = '100%'; vidImg.style.maxHeight = '100%';
  // Clear any stale bounce transform on the wrap since we now move the media.
  document.getElementById('videoWrap').style.transform = '';
  barPinned = false; showBar(true);
  if (fsOverlay.requestFullscreen) fsOverlay.requestFullscreen().catch(()=>{});
  requestAnimationFrame(() => {
    applyVideoTransform();
    updateTimeline();
    if (bounceOn) reseedBounceForArea();
  });
}

function exitFS() {
  isFS = false;
  const fsOverlay = document.getElementById('fsOverlay');
  const vidWrap   = document.getElementById('videoWrap');

  fsOverlay.classList.remove('active');
  vidWrap.insertBefore(vid,       document.getElementById('cropCanvas'));
  vidWrap.insertBefore(vidImg,    document.getElementById('cropCanvas'));
  vidWrap.insertBefore(vidSprite, document.getElementById('cropCanvas'));
  vid.style.maxWidth    = ''; vid.style.maxHeight    = '';
  vidImg.style.maxWidth = ''; vidImg.style.maxHeight = '';
  // Clear any FS bounce transform from the media before we switch modes.
  document.getElementById('fsVideoWrap').style.transform = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  requestAnimationFrame(() => {
    applyVideoTransform();
    updateTimeline();
    if (bounceOn) reseedBounceForArea();
  });
}

function showBar(reschedule) {
  if (barPinned) return;
  const fsBar      = document.getElementById('fsBar');
  const fsHideHint = document.getElementById('fsHideHint');
  barVisible = true;
  fsBar.classList.remove('hidden');
  fsHideHint.classList.remove('vis');
  if (reschedule) scheduleHide();
}

function hideBar() {
  const fsBar      = document.getElementById('fsBar');
  const fsHideHint = document.getElementById('fsHideHint');
  barVisible = false;
  fsBar.classList.add('hidden');
  fsHideHint.classList.add('vis');
}

function scheduleHide() {
  clearTimeout(barHideTimer);
  barHideTimer = setTimeout(() => { if (!barPinned) hideBar(); }, 3200);
}

function setupFullscreen() {
  document.getElementById('fsEnterBtn').addEventListener('click', enterFS);
  document.getElementById('fsExitBtn').addEventListener('click',  exitFS);

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isFS) exitFS();
  });

  const fsOverlay = document.getElementById('fsOverlay');
  const fsBar     = document.getElementById('fsBar');

  fsOverlay.addEventListener('mousemove', () => { if (isFS && !barPinned) showBar(true); });
  fsOverlay.addEventListener('click', e => {
    if (!isFS || e.target.closest('#fsBar') || cropDrawMode) return;
    if (barPinned || !barVisible) { barPinned = false; showBar(true); }
  });
  document.getElementById('fsHideBarBtn').addEventListener('click', () => {
    barPinned = !barPinned;
    barPinned ? (clearTimeout(barHideTimer), hideBar()) : showBar(true);
  });
  fsBar.addEventListener('mouseenter', () => clearTimeout(barHideTimer));
  fsBar.addEventListener('mouseleave', scheduleHide);
}
