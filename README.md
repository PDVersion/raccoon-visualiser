# raccoon-visualiser

A static web app for looping raccoon (and friends) clips at any BPM,
with crop / zoom / bounce effects and an optional Spotify connection.
Each clip carries a manifest-defined source BPM so playback retimes
to your target BPM automatically.

## Layout

- `index.html` — markup only.
- `styles/` — base + dark/light theme stylesheets.
- `scripts/` — one feature per file:
  - `state.js` — shared mutable globals.
  - `media.js` — extension parsing and active-media accessors.
  - `transform.js` — zoom + crop CSS transform and SVG overlay.
  - `bpm.js` — target / native BPM, presets, tap tempo, beat flash.
  - `loop.js` — loop region rAF, timeline UI, draggable handles.
  - `playback.js` — play/pause buttons + keyboard shortcuts.
  - `library.js` — `resources/manifest.json` loader; renders the
    library list (with per-row BPM badge) and pre-seeds nativeBPM
    on every load.
  - `marker.js` — Source BPM editor panel (numeric input + reset +
    copy-as-JSON).
  - `crop.js` — crop drawing (rect / circle / freeform) and zoom buttons.
  - `effects.js` — crop shape, background colour, bounce engine.
  - `fullscreen.js` — fullscreen overlay and bar auto-hide.
  - `theme.js` — light/dark toggle.
  - `panels.js` — drag/collapse panel layout, persisted in localStorage.
  - `spotify.js` — PKCE OAuth, transport controls, BPM sync.
  - `main.js` — wires every `setupX()` and starts the app.
  - `db.js`, `decode.js`, `sprite.js`, `sprite-playback.js` — **dormant**.
    Not loaded by `index.html`. Kept on disk for the future
    animated-image retiming phase.
- `resources/` — drop `.mp4` / `.gif` / `.webp` files here and list them
  in `resources/manifest.json`.

## Source BPM

`resources/manifest.json` is a mixed array. Two entry shapes:

```json
[
  { "filename": "pedro_raccoon.mp4", "sourceBPM": 150 },
  "tappy_cat_2.gif"
]
```

When a clip with a `sourceBPM` loads, `nativeBPM` is set immediately and
the existing pipeline drives `vid.playbackRate = targetBPM / sourceBPM`
(clamped 0.0625–16). Spotify sync flows through the same path: a track
change updates `targetBPM`, and playback rate re-derives.

The **Source BPM** panel (where Beat Markers used to be) shows the
active clip's BPM and lets you tweak it for the session — handy for
dialing in a value before committing it. The status line tells you
whether the live value matches the manifest or is a session override.
A **Copy JSON** button writes `{"filename":"...","sourceBPM":...}` to
your clipboard so you can paste it into `manifest.json` to persist.

Tap-tempo coexists unchanged — taps still write `nativeBPM` directly.

### v1 limitations

- Only MP4 actually retimes. Animated GIF and WebP play at their native
  frame rate; the BPM badge still appears on their library row but
  doesn't yet drive playback. Animated-image retiming will return in a
  follow-up phase using the dormant `decode.js` / `sprite*.js`
  scaffolding.

## Spotify

1. Create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add the page's URL as a redirect URI (the app prints the exact value
   you need to paste in the Spotify panel).
3. Paste the Client ID into the panel and click **Sign in with Spotify**.

The app uses Authorisation Code + PKCE — no client secret, no backend.
Transport controls require Spotify Premium and an active device.
