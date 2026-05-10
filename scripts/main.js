'use strict';

// ═══════════════════════════════════════════════════════════════════
// MAIN INIT — wires every module's setup function and installs the
// resize observers that keep the transform/timeline accurate.
// ═══════════════════════════════════════════════════════════════════

function setupResize() {
  new ResizeObserver(() => { applyVideoTransform(); updateTimeline(); })
    .observe(document.getElementById('videoWrap'));
  new ResizeObserver(() => { if (isFS) { applyVideoTransform(); updateTimeline(); } })
    .observe(document.getElementById('fsVideoWrap'));

  window.addEventListener('resize', () => {
    if (isFS) return;
    const sz = getActiveSize();
    if (sz.w && sz.h) onMediaReady(sz.w, sz.h);
    if (bounceOn) reseedBounceForArea();
  });
}

(function init() {
  initPanelLayout();
  setupTheme();
  setupBpm();
  setupLoop();
  setupPlayback();
  setupCrop();
  setupFullscreen();
  setupEffects();
  setupLibrary();
  setupSpotify();
  setupResize();

  loadVideoList();
  setTarget(120);
  updateTimeline();
  applyVideoTransform();
})();
