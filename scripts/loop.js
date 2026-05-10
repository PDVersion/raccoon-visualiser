'use strict';

// ═══════════════════════════════════════════════════════════════════
// LOOP REGION + TIMELINE — rAF polling enforces the loop boundaries
// (timeupdate fires too rarely to be reliable) and keeps both the
// normal and fullscreen timelines in sync.
// ═══════════════════════════════════════════════════════════════════

function rafLoop() {
  if (!vid.paused && loopEnabled) {
    const t = vid.currentTime;
    if (t >= loopB - 0.04 || t < loopA - 0.04) {
      vid.currentTime = loopA;
    }
  }
  // Update cursors every frame
  const dur  = vid.duration || DURATION || 1;
  const pct  = vid.currentTime / dur;
  const tl   = document.getElementById('timeline');
  const fstl = document.getElementById('fsTimeline');
  document.getElementById('cursor').style.left   = (pct * tl.clientWidth)   + 'px';
  document.getElementById('fsCursor').style.left = (pct * fstl.clientWidth) + 'px';
  requestAnimationFrame(rafLoop);
}

function syncLoopBtns() {
  document.getElementById('loopToggle').classList.toggle('on', loopEnabled);
  document.getElementById('fsLoopBtn').classList.toggle('on',  loopEnabled);
  // When we manage looping ourselves, turn off the native video loop
  vid.loop = !loopEnabled;
}

function updateTimeline() {
  const dur = vid.duration || DURATION || 1;
  const pA  = loopA / dur, pB = loopB / dur;

  const tl = document.getElementById('timeline');
  const w  = tl.clientWidth;
  document.getElementById('region').style.left      = (pA * w) + 'px';
  document.getElementById('region').style.width     = ((pB - pA) * w) + 'px';
  document.getElementById('handleA').style.left     = (pA * w) + 'px';
  document.getElementById('handleB').style.left     = (pB * w) + 'px';
  document.getElementById('loopADisplay').textContent   = loopA.toFixed(2) + 's';
  document.getElementById('loopBDisplay').textContent   = loopB.toFixed(2) + 's';
  document.getElementById('loopDurDisplay').textContent = (loopB - loopA).toFixed(2) + 's';

  const fstl = document.getElementById('fsTimeline');
  const fw   = fstl.clientWidth;
  document.getElementById('fsRegion').style.left   = (pA * fw) + 'px';
  document.getElementById('fsRegion').style.width  = ((pB - pA) * fw) + 'px';
  document.getElementById('fsHandleA').style.left  = (pA * fw) + 'px';
  document.getElementById('fsHandleB').style.left  = (pB * fw) + 'px';
}

function makeHandleDraggable(handleId, isA) {
  const handle = document.getElementById(handleId);
  const tlId   = handleId.startsWith('fs') ? 'fsTimeline' : 'timeline';
  let dragging = false;

  function getT(cx) {
    const tl   = document.getElementById(tlId);
    const rect = tl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * (vid.duration || DURATION);
  }
  function start(e) {
    e.preventDefault && e.preventDefault();
    dragging = true;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   stop);
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('touchend',  stop);
  }
  function move(e) {
    if (!dragging) return;
    e.preventDefault && e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const t  = getT(cx);
    if (isA) loopA = Math.min(t, loopB - 0.1);
    else     loopB = Math.max(t, loopA + 0.1);
    updateTimeline();
  }
  function stop() {
    dragging = false;
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup',   stop);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend',  stop);
  }
  handle.addEventListener('mousedown', start);
  handle.addEventListener('touchstart', e => { e.preventDefault(); start(e); }, {passive:false});
}

function addSeek(tlId) {
  document.getElementById(tlId).addEventListener('click', e => {
    const aId = tlId === 'timeline' ? 'handleA' : 'fsHandleA';
    const bId = tlId === 'timeline' ? 'handleB' : 'fsHandleB';
    if (e.target.id === aId || e.target.id === bId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    vid.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (vid.duration || DURATION);
  });
}

function setupLoop() {
  ['loopToggle','fsLoopBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () => {
      loopEnabled = !loopEnabled;
      syncLoopBtns();
    })
  );

  document.getElementById('setABtn').addEventListener('click', () => {
    loopA = Math.min(vid.currentTime, loopB - 0.1); updateTimeline();
  });
  document.getElementById('setBBtn').addEventListener('click', () => {
    loopB = Math.max(vid.currentTime, loopA + 0.1); updateTimeline();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    loopA = 0; loopB = vid.duration || DURATION; updateTimeline();
  });
  document.getElementById('previewBtn').addEventListener('click', () => {
    vid.currentTime = loopA;
    loopEnabled = true; syncLoopBtns();
    if (vid.paused) vid.play();
  });

  makeHandleDraggable('handleA',   true);
  makeHandleDraggable('handleB',   false);
  makeHandleDraggable('fsHandleA', true);
  makeHandleDraggable('fsHandleB', false);
  addSeek('timeline');
  addSeek('fsTimeline');

  requestAnimationFrame(rafLoop);
}
