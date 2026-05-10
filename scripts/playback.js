'use strict';

// ═══════════════════════════════════════════════════════════════════
// PLAY / PAUSE — buttons in the BPM panel and on the FS bar both run
// through here, plus arrow-key seek and Space-to-toggle in fullscreen.
// ═══════════════════════════════════════════════════════════════════

function syncPlayBtns() {
  const p = vid.paused;
  document.getElementById('playBtn').textContent   = p ? '▶' : '⏸';
  document.getElementById('fsPlayBtn').textContent = p ? '▶' : '⏸';
  document.getElementById('fsPlayBtn').classList.toggle('go', p);
}

function setupPlayback() {
  ['playBtn','fsPlayBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () =>
      vid.paused ? vid.play() : vid.pause()
    )
  );
  vid.addEventListener('play',  syncPlayBtns);
  vid.addEventListener('pause', syncPlayBtns);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isFS) exitFS();
    if (e.key === ' ' && isFS) { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    if (e.key === 'ArrowRight') vid.currentTime = Math.min(vid.duration || DURATION, vid.currentTime + 0.5);
    if (e.key === 'ArrowLeft')  vid.currentTime = Math.max(0, vid.currentTime - 0.5);
  });
}
