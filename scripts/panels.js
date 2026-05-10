'use strict';

// ═══════════════════════════════════════════════════════════════════
// PANEL LAYOUT — distributes panels across the left/right tracks,
// supports drag-reordering between tracks and per-panel collapse,
// and persists the result in localStorage.
// ═══════════════════════════════════════════════════════════════════

const LAYOUT_KEY = 'raccoon.layout.v2';
const DEFAULT_LAYOUT = {
  left:  ['library', 'view', 'effects'],
  right: ['spotify', 'bpm-display', 'bpm', 'loop'],
  collapsed: []
};

function readLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.left) && Array.isArray(obj.right)) return obj;
  } catch (_) {}
  return null;
}

function saveLayout() {
  const left  = [...document.querySelectorAll('#trackLeft  > .panel')].map(p => p.dataset.panelId);
  const right = [...document.querySelectorAll('#trackRight > .panel')].map(p => p.dataset.panelId);
  const collapsed = [...document.querySelectorAll('.panel.collapsed')].map(p => p.dataset.panelId);
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ left, right, collapsed })); }
  catch (_) {}
}

function applyLayout(layout) {
  const trackLeft  = document.getElementById('trackLeft');
  const trackRight = document.getElementById('trackRight');
  const known = new Set();

  function moveById(id, track) {
    const el = document.querySelector(`.panel[data-panel-id="${id}"]`);
    if (!el) return;
    track.appendChild(el);
    known.add(id);
  }
  layout.left.forEach(id  => moveById(id, trackLeft));
  layout.right.forEach(id => moveById(id, trackRight));

  // Any panels not mentioned in the layout (e.g. new defaults added later)
  // get appended to the right track so they're not orphaned in the pool.
  document.querySelectorAll('#panelPool > .panel').forEach(p => {
    if (!known.has(p.dataset.panelId)) trackRight.appendChild(p);
  });

  // Collapsed state
  const collapsedSet = new Set(layout.collapsed || []);
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('collapsed', collapsedSet.has(p.dataset.panelId));
  });
}

function setupPanelDrag() {
  let dragId = null;

  document.addEventListener('dragstart', e => {
    const handle = e.target.closest('.panel-handle');
    if (!handle) return;
    const panel = handle.closest('.panel');
    if (!panel) return;
    dragId = panel.dataset.panelId;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {}
    panel.classList.add('dragging');
  });
  document.addEventListener('dragend', () => {
    document.querySelectorAll('.panel.dragging').forEach(p => p.classList.remove('dragging'));
    document.querySelectorAll('.track.drop-target').forEach(t => t.classList.remove('drop-target'));
    dragId = null;
  });

  document.querySelectorAll('.track').forEach(track => {
    track.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      track.classList.add('drop-target');
    });
    track.addEventListener('dragleave', e => {
      if (e.target === track) track.classList.remove('drop-target');
    });
    track.addEventListener('drop', e => {
      if (!dragId) return;
      e.preventDefault();
      track.classList.remove('drop-target');
      const dragged = document.querySelector(`.panel[data-panel-id="${dragId}"]`);
      if (!dragged) return;

      // Insertion point: panel under the cursor's vertical position.
      const after = [...track.querySelectorAll(':scope > .panel:not(.dragging)')]
        .find(p => {
          const r = p.getBoundingClientRect();
          return e.clientY < r.top + r.height / 2;
        });
      if (after) track.insertBefore(dragged, after);
      else track.appendChild(dragged);
      saveLayout();
    });
  });
}

function setupPanelCollapse() {
  document.querySelectorAll('.panel-collapse-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const panel = btn.closest('.panel');
      if (!panel) return;
      panel.classList.toggle('collapsed');
      saveLayout();
    });
  });
}

function initPanelLayout() {
  applyLayout(readLayout() || DEFAULT_LAYOUT);
  setupPanelDrag();
  setupPanelCollapse();
}
