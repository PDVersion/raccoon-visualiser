'use strict';

// ═══════════════════════════════════════════════════════════════════
// SHARED STATE — all mutable globals live here.
// Other scripts read/write via these `var` bindings (var ⇒ window).
// ═══════════════════════════════════════════════════════════════════

// Media elements + mode
var vid       = document.getElementById('vid');
var vidImg    = document.getElementById('vidImg');
var vidSprite = document.getElementById('vidSprite');
var DURATION  = 17.016667;
var mediaMode = 'video';   // 'video' | 'image' | 'sprite'

// BPM
var nativeBPM = null;
var targetBPM = 120;
var tapTimes  = [];
var tapTimer  = null;

// Loop
var loopA       = 0;
var loopB       = DURATION;
var loopEnabled = false;

// Crop / zoom
var crop      = { x:0, y:0, w:1, h:1 };
var hasCrop   = false;
var zoomLevel = 1.0;

var cropDrawMode = false;
var cropDrawing  = false;
var cropDragPx   = { x0:0, y0:0 };
var cropDragNorm = { nx:0, ny:0 };

var cropShape    = 'rect';      // 'rect' | 'circle' | 'freeform'
var cropPath     = null;        // freeform: array of {nx, ny}
var cropBgColor  = null;        // hex string when set, else null
var lastFreeformPxPath = null;

// Fullscreen
var isFS         = false;
var barVisible   = true;
var barPinned    = false;
var barHideTimer = null;

// Bounce
var bounceOn      = false;
var bounceX       = 0;
var bounceY       = 0;
var bounceVX      = 0;
var bounceVY      = 0;
var bounceSpeedPx = 180;
var bounceLastT   = 0;
var bounceRAF     = null;

// Library
var currentVideo = null;
var MEDIA_FOLDER = 'resources';

// Beat flash
var beatInterval = null;
