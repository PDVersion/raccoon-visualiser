# raccoon-visualiser

A static web app for looping raccoon clips at any BPM, with crop / zoom /
bounce effects and an optional Spotify connection.

## Layout

- `index.html` — markup only.
- `styles/` — base + dark/light theme stylesheets.
- `scripts/` — one feature per file:
  - `state.js` — shared mutable globals.
  - `media.js` — extension parsing and active-media accessors.
  - `transform.js` — zoom + crop CSS transform and SVG overlay.
  - `bpm.js` — target/native BPM, presets, tap tempo, beat flash.
  - `loop.js` — loop region rAF, timeline UI, draggable handles.
  - `playback.js` — play/pause buttons + keyboard shortcuts.
  - `library.js` — `resources/manifest.json` loader and media swap.
  - `crop.js` — crop drawing (rect / circle / freeform) and zoom buttons.
  - `effects.js` — crop shape, background colour, bounce engine.
  - `fullscreen.js` — fullscreen overlay and bar auto-hide.
  - `theme.js` — light/dark toggle.
  - `panels.js` — drag/collapse panel layout, persisted in localStorage.
  - `spotify.js` — PKCE OAuth, transport controls, BPM sync.
  - `main.js` — wires every `setupX()` and starts the app.
- `resources/` — drop `.mp4` / `.gif` / `.webp` files here and list them
  in `resources/manifest.json`.

## Spotify

1. Create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add the page's URL as a redirect URI (the app prints the exact value
   you need to paste in the Spotify panel).
3. Paste the Client ID into the panel and click **Sign in with Spotify**.

The app uses Authorisation Code + PKCE — no client secret, no backend.
Transport controls require Spotify Premium and an active device.
