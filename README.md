# raccoon-visualiser

A static web app for looping raccoon (and friends) clips at any BPM, with
crop / zoom / bounce effects and an optional Spotify connection. Mark a
clip's native beats once and every subsequent load retimes it to your
target BPM automatically.

## Layout

- `index.html` — markup only.
- `styles/` — base + dark/light theme stylesheets.
- `scripts/` — one feature per file:
  - `state.js` — shared mutable globals.
  - `media.js` — extension parsing and active-media accessors.
  - `db.js` — IndexedDB-backed cache of derived data (source BPMs,
    marker positions, sprite sheets) keyed by file path.
  - `decode.js` — frame extraction. Video: hidden `<video>` + canvas
    seeking. Animated image: WebCodecs `ImageDecoder` with a
    `gifuct-js` fallback (lazy-loaded from `esm.sh`) for GIFs in
    browsers without it.
  - `transform.js` — zoom + crop CSS transform and SVG overlay.
  - `bpm.js` — target / native BPM, presets, tap tempo, beat flash.
  - `loop.js` — loop region rAF, timeline UI, draggable handles.
  - `playback.js` — play/pause buttons + keyboard shortcuts.
  - `sprite.js` — composites decoded frames into a horizontal PNG
    sprite sheet (warns on >4 MB or >100 frames, refuses >16384 px).
  - `sprite-playback.js` — drives `#vidSprite` via CSS `@keyframes` +
    a `--sprite-duration` variable that `applyBPM()` updates live.
  - `library.js` — `resources/manifest.json` loader, marker shortcuts,
    cache lookup that picks the right playback path on load.
  - `marker.js` — beat-marker panel; user clicks frame thumbnails on
    every beat and the mean inter-marker interval becomes the clip's
    cached source BPM. Coexists with tap-tempo (markers are per-media,
    tap is a global override).
  - `crop.js` — crop drawing (rect / circle / freeform) and zoom buttons.
  - `effects.js` — crop shape, background colour, bounce engine.
  - `fullscreen.js` — fullscreen overlay and bar auto-hide.
  - `theme.js` — light/dark toggle.
  - `panels.js` — drag/collapse panel layout, persisted in localStorage.
  - `spotify.js` — PKCE OAuth, transport controls, BPM sync.
  - `main.js` — wires every `setupX()` and starts the app.
- `resources/` — drop `.mp4` / `.gif` / `.webp` files here and list them
  in `resources/manifest.json`.

## Beat markers

Click **✎** on any library row to open the Beat Markers panel. Tap each
thumbnail where a beat lands (peak of a bounce, downbeat of a spin):

- Minimum 4 markers, 8–12 recommended.
- The panel warns on irregular intervals (stddev / mean > 15 %).
- It warns again if the resulting playback rate would fall outside the
  recommended 0.25–2.0× range and suggests a better target BPM.
- Save persists the source BPM, marker positions, and — for animated
  images — a composited sprite sheet to IndexedDB. The next time the
  clip loads, the BPM is auto-applied and (for images) the sprite-sheet
  playback path takes over so no decode runs.

A `●` next to a library row indicates a cached source BPM.

## Spotify

1. Create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add the page's URL as a redirect URI (the app prints the exact value
   you need to paste in the Spotify panel).
3. Paste the Client ID into the panel and click **Sign in with Spotify**.

The app uses Authorisation Code + PKCE — no client secret, no backend.
Transport controls require Spotify Premium and an active device. When a
new track starts, its tempo retimes both `<video>` (`playbackRate`) and
sprite playback (`--sprite-duration` CSS variable) smoothly.

## Dependencies

The app ships as static files with no build step. Browser-native APIs
do the heavy lifting:

- Canvas seeking on a hidden `<video>` for video thumbnail extraction.
- WebCodecs `ImageDecoder` for animated GIF / WebP decoding (Chrome 94+,
  Firefox 130+, Safari 17.4+).
- `gifuct-js@2.1.2` from [esm.sh](https://esm.sh) — lazy-loaded only on
  older browsers as a GIF-decoder fallback. Animated WebP on browsers
  without `ImageDecoder` surfaces a clear error.

Cached data (source BPMs, marker positions, sprite blobs) lives in
IndexedDB under the database name `raccoon-visualiser`.
