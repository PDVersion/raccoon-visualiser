'use strict';

// ═══════════════════════════════════════════════════════════════════
// BPM CONTROLS — target slider, native BPM, tap tempo, presets, and
// the beat-flash that pulses the BPM readout in time with the music.
// ═══════════════════════════════════════════════════════════════════

function applyBPM() {
  const rate = nativeBPM ? Math.max(0.0625, Math.min(16, targetBPM / nativeBPM)) : 1;
  vid.playbackRate = rate;
  const d = targetBPM.toFixed(1);
  document.getElementById('speedBadge').textContent   = rate.toFixed(3) + '×';
  document.getElementById('bpmDisplay').textContent   = d;
  document.getElementById('bpmText').value            = d;
  document.getElementById('bpmSlider').value          = Math.min(220, Math.max(40, targetBPM));
  document.getElementById('fsBpmDisplay').textContent = d;
  document.getElementById('fsBpmInput').value         = d;
  highlightPreset();
}

function setTarget(bpm) {
  targetBPM = Math.max(1, Math.min(400, parseFloat(bpm) || 120));
  applyBPM();
}

function setNative(bpm) {
  nativeBPM = Math.max(1, parseFloat(bpm));
  document.getElementById('nativeDisplay').textContent = nativeBPM.toFixed(1);
  document.getElementById('infoRow').textContent =
    `Native ${nativeBPM.toFixed(1)} BPM → playing at ${(targetBPM/nativeBPM).toFixed(3)}× speed.`;
  applyBPM();
}

function highlightPreset() {
  document.querySelectorAll('.preset-btn').forEach(b =>
    b.classList.toggle('active', parseFloat(b.dataset.bpm) === Math.round(targetBPM))
  );
}

function setupBpm() {
  document.getElementById('bpmSlider').addEventListener('input', e => setTarget(e.target.value));
  ['bpmText','fsBpmInput'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', e => setTarget(e.target.value));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') setTarget(e.target.value); });
  });

  document.getElementById('presets').addEventListener('click', e => {
    if (e.target.classList.contains('preset-btn')) setTarget(e.target.dataset.bpm);
  });

  // Tap tempo — average inter-tap interval over a rolling window.
  document.getElementById('tapBtn').addEventListener('click', () => {
    const now = performance.now();
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapTimes = []; }, 2500);
    tapTimes.push(now);
    if (tapTimes.length > 8) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const ints = [];
      for (let i = 1; i < tapTimes.length; i++) ints.push(tapTimes[i] - tapTimes[i-1]);
      const avg = ints.reduce((a,b) => a+b, 0) / ints.length;
      const tapped = 60000 / avg;
      document.getElementById('nativeDisplay').textContent = tapped.toFixed(1) + ' (tapped)';
      document.getElementById('setNativeBtn').dataset.pending = tapped.toFixed(2);
    }
  });

  document.getElementById('setNativeBtn').addEventListener('click', () => {
    const raw = document.getElementById('setNativeBtn').dataset.pending
      || document.getElementById('nativeDisplay').textContent;
    const v = parseFloat(raw);
    if (!isNaN(v) && v > 0) setNative(v);
  });

  // Beat flash — pulse the readouts at the target tempo while playing.
  function startBeatFlash() {
    clearInterval(beatInterval);
    if (!vid.paused && nativeBPM) {
      beatInterval = setInterval(() => {
        ['bpmDisplay','fsBpmDisplay'].forEach(id => {
          const el = document.getElementById(id);
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 80);
        });
      }, 60000 / targetBPM);
    }
  }
  vid.addEventListener('play',  startBeatFlash);
  vid.addEventListener('pause', () => clearInterval(beatInterval));
}
