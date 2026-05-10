'use strict';

// ═══════════════════════════════════════════════════════════════════
// THEME TOGGLE — flips between the two stylesheet links and persists
// the choice. Re-runs the transform so the SVG overlay picks up the
// new --overlay tones immediately.
// ═══════════════════════════════════════════════════════════════════

function setupTheme() {
  const themeDark  = document.getElementById('themeDark');
  const themeLight = document.getElementById('themeLight');
  const themeBtn   = document.getElementById('themeToggle');

  function applyTheme(mode) {
    const dark = mode === 'dark';
    themeDark.disabled  = !dark;
    themeLight.disabled =  dark;
    themeBtn.textContent = dark ? '☀ LIGHT' : '🌙 DARK';
    try { localStorage.setItem('raccoon-theme', mode); } catch (_) {}
    if (typeof applyVideoTransform === 'function') applyVideoTransform();
  }
  themeBtn.addEventListener('click', () => {
    applyTheme(themeDark.disabled ? 'dark' : 'light');
  });
  let stored = 'dark';
  try { stored = localStorage.getItem('raccoon-theme') || 'dark'; } catch (_) {}
  applyTheme(stored);
}
