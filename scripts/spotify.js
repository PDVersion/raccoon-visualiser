'use strict';

// ═══════════════════════════════════════════════════════════════════
// SPOTIFY INTEGRATION — Authorisation Code + PKCE flow (no client
// secret, no server). The user supplies a Client ID, we redirect to
// Spotify, exchange the returned code for tokens, then poll the Web
// API for currently-playing track + tempo and expose transport
// controls (play/pause, next/prev, repeat, volume).
//
// Notes:
//   • Redirect URI must be registered in the Spotify Developer
//     Dashboard. The app uses `window.location.origin + pathname`
//     for the active page.
//   • Control endpoints (play, pause, next, prev, volume, repeat)
//     require Spotify Premium. Free accounts can still see what is
//     currently playing.
//   • The `audio-features` endpoint (used here for BPM) was deprecated
//     by Spotify for new applications in late 2024. Apps registered
//     before that change still receive a tempo; for newer apps the
//     BPM field will simply show "—".
// ═══════════════════════════════════════════════════════════════════

const SPOTIFY = {
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state'
  ].join(' '),
  AUTH_URL:  'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token',
  API_BASE:  'https://api.spotify.com/v1'
};

const SPOTIFY_KEYS = {
  clientId:    'spotify_client_id',
  verifier:    'spotify_verifier',
  accessToken: 'spotify_access_token',
  refreshToken:'spotify_refresh_token',
  expiresAt:   'spotify_expires_at',
  syncBpm:     'spotify_sync_bpm'
};

let spotifyPollTimer  = null;
let spotifyLastTrackId = null;
let spotifyRepeatState = 'off';
let spotifyTrackTempo  = null;
let spotifyVolumeLocal = 50;

function spotifyClientId()    { return localStorage.getItem(SPOTIFY_KEYS.clientId) || ''; }
function spotifyAccessToken() { return localStorage.getItem(SPOTIFY_KEYS.accessToken); }
function spotifyRefreshToken(){ return localStorage.getItem(SPOTIFY_KEYS.refreshToken); }
function spotifyIsLoggedIn()  { return !!spotifyAccessToken(); }
function spotifyTokenExpired(){
  const exp = parseInt(localStorage.getItem(SPOTIFY_KEYS.expiresAt) || '0', 10);
  return Date.now() >= (exp - 30000);
}

function spotifySetClientId(id) {
  const trimmed = (id || '').trim();
  if (trimmed) localStorage.setItem(SPOTIFY_KEYS.clientId, trimmed);
  else localStorage.removeItem(SPOTIFY_KEYS.clientId);
  spotifyUpdateUI();
}

// ── PKCE helpers ──────────────────────────────────────────────────
function spotifyGenVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
  let out = '';
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}

async function spotifyChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Auth flow ─────────────────────────────────────────────────────
async function spotifyLogin() {
  const id = spotifyClientId();
  if (!id) {
    spotifySetStatus('Enter your Spotify Client ID first.', true);
    return;
  }
  const verifier = spotifyGenVerifier();
  localStorage.setItem(SPOTIFY_KEYS.verifier, verifier);
  const challenge = await spotifyChallenge(verifier);
  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             id,
    scope:                 SPOTIFY.SCOPES,
    redirect_uri:          SPOTIFY.REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge:        challenge
  });
  window.location = SPOTIFY.AUTH_URL + '?' + params.toString();
}

async function spotifyHandleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const error  = params.get('error');
  if (error) {
    spotifySetStatus('Spotify login error: ' + error, true);
    history.replaceState({}, '', SPOTIFY.REDIRECT_URI);
    return;
  }
  if (!code) return;
  const verifier = localStorage.getItem(SPOTIFY_KEYS.verifier);
  const id       = spotifyClientId();
  if (!verifier || !id) return;

  const body = new URLSearchParams({
    client_id:     id,
    grant_type:    'authorization_code',
    code:          code,
    redirect_uri:  SPOTIFY.REDIRECT_URI,
    code_verifier: verifier
  });

  try {
    const res = await fetch(SPOTIFY.TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) {
      const txt = await res.text();
      spotifySetStatus('Token exchange failed: ' + txt, true);
      return;
    }
    const data = await res.json();
    spotifySaveTokens(data);
    spotifySetStatus('Connected.', false);
  } catch (e) {
    spotifySetStatus('Login failed: ' + e.message, true);
  } finally {
    localStorage.removeItem(SPOTIFY_KEYS.verifier);
    history.replaceState({}, '', SPOTIFY.REDIRECT_URI);
  }
}

function spotifySaveTokens(data) {
  if (data.access_token)  localStorage.setItem(SPOTIFY_KEYS.accessToken,  data.access_token);
  if (data.refresh_token) localStorage.setItem(SPOTIFY_KEYS.refreshToken, data.refresh_token);
  if (data.expires_in)    localStorage.setItem(SPOTIFY_KEYS.expiresAt,    String(Date.now() + data.expires_in * 1000));
}

async function spotifyRefresh() {
  const refresh = spotifyRefreshToken();
  const id = spotifyClientId();
  if (!refresh || !id) return false;
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refresh,
    client_id:     id
  });
  try {
    const res = await fetch(SPOTIFY.TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) return false;
    const data = await res.json();
    spotifySaveTokens(data);
    return true;
  } catch { return false; }
}

function spotifyLogout() {
  localStorage.removeItem(SPOTIFY_KEYS.accessToken);
  localStorage.removeItem(SPOTIFY_KEYS.refreshToken);
  localStorage.removeItem(SPOTIFY_KEYS.expiresAt);
  spotifyStopPoll();
  spotifyLastTrackId = null;
  spotifyTrackTempo  = null;
  spotifyClearTrack();
  spotifySetStatus('Signed out.', false);
  spotifyUpdateUI();
}

async function spotifyApi(endpoint, opts = {}) {
  if (!spotifyIsLoggedIn()) return null;
  if (spotifyTokenExpired()) {
    const ok = await spotifyRefresh();
    if (!ok) { spotifyLogout(); return null; }
  }
  const headers = { 'Authorization': 'Bearer ' + spotifyAccessToken(), ...(opts.headers || {}) };
  let res;
  try { res = await fetch(SPOTIFY.API_BASE + endpoint, { ...opts, headers }); }
  catch (e) { return null; }

  if (res.status === 401) {
    const ok = await spotifyRefresh();
    if (!ok) { spotifyLogout(); return null; }
    const retryHeaders = { 'Authorization': 'Bearer ' + spotifyAccessToken(), ...(opts.headers || {}) };
    try { return await fetch(SPOTIFY.API_BASE + endpoint, { ...opts, headers: retryHeaders }); }
    catch { return null; }
  }
  return res;
}

// ── Player controls ───────────────────────────────────────────────
async function spotifyPlay()     { await spotifyApi('/me/player/play',     { method: 'PUT'  }); setTimeout(spotifyPoll, 200); }
async function spotifyPause()    { await spotifyApi('/me/player/pause',    { method: 'PUT'  }); setTimeout(spotifyPoll, 200); }
async function spotifyNext()     { await spotifyApi('/me/player/next',     { method: 'POST' }); setTimeout(spotifyPoll, 400); }
async function spotifyPrevious() { await spotifyApi('/me/player/previous', { method: 'POST' }); setTimeout(spotifyPoll, 400); }

async function spotifySetVolume(v) {
  const pct = Math.max(0, Math.min(100, Math.round(v)));
  spotifyVolumeLocal = pct;
  document.getElementById('spotifyVolumeVal').textContent = pct + '%';
  await spotifyApi('/me/player/volume?volume_percent=' + pct, { method: 'PUT' });
}

async function spotifyToggleRepeat() {
  const next = { off: 'context', context: 'track', track: 'off' }[spotifyRepeatState] || 'context';
  spotifyRepeatState = next;
  spotifyUpdateRepeatBtn();
  await spotifyApi('/me/player/repeat?state=' + next, { method: 'PUT' });
}

async function spotifyTogglePlayPause() {
  const res = await spotifyApi('/me/player');
  if (!res) return;
  if (res.status === 204) { spotifyPlay(); return; }
  let data;
  try { data = await res.json(); }
  catch { spotifyPlay(); return; }
  if (data && data.is_playing) spotifyPause();
  else spotifyPlay();
}

// ── Polling ──────────────────────────────────────────────────────
async function spotifyPoll() {
  if (!spotifyIsLoggedIn()) return;
  try {
    const res = await spotifyApi('/me/player');
    if (!res) return;
    if (res.status === 204) { spotifyClearTrack(); spotifyUpdatePlayBtn(false); return; }
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    spotifyRepeatState = data.repeat_state || 'off';
    spotifyUpdateRepeatBtn();

    if (data.device && typeof data.device.volume_percent === 'number') {
      spotifyVolumeLocal = data.device.volume_percent;
      const vol = document.getElementById('spotifyVolume');
      const lbl = document.getElementById('spotifyVolumeVal');
      if (vol && document.activeElement !== vol) vol.value = spotifyVolumeLocal;
      if (lbl) lbl.textContent = spotifyVolumeLocal + '%';
    }

    spotifyUpdatePlayBtn(!!data.is_playing);

    if (data.item) {
      spotifyShowTrack(data.item);
      if (data.item.id !== spotifyLastTrackId) {
        spotifyLastTrackId = data.item.id;
        spotifyFetchTempo(data.item.id);
      }
    } else {
      spotifyClearTrack();
    }
  } catch (_) { /* swallow polling errors */ }
}

function spotifyStartPoll() {
  if (spotifyPollTimer) return;
  spotifyPoll();
  spotifyPollTimer = setInterval(spotifyPoll, 5000);
}

function spotifyStopPoll() {
  if (spotifyPollTimer) clearInterval(spotifyPollTimer);
  spotifyPollTimer = null;
}

async function spotifyFetchTempo(id) {
  const res = await spotifyApi('/audio-features/' + id);
  if (!res || !res.ok) {
    // 403 here typically means the app was registered after Spotify
    // deprecated audio-features for new clients. We just hide BPM.
    spotifyTrackTempo = null;
    spotifyUpdateBpm();
    return;
  }
  try {
    const data = await res.json();
    spotifyTrackTempo = (data && typeof data.tempo === 'number') ? data.tempo : null;
    spotifyUpdateBpm();
    if (spotifyTrackTempo) {
      const sync = document.getElementById('spotifySync');
      if (sync && sync.checked) setTarget(spotifyTrackTempo);
    }
  } catch {
    spotifyTrackTempo = null;
    spotifyUpdateBpm();
  }
}

// ── UI ────────────────────────────────────────────────────────────
function spotifyShowTrack(item) {
  document.getElementById('spotifyTrack').textContent  = item.name || '';
  document.getElementById('spotifyArtist').textContent = (item.artists || []).map(a => a.name).join(', ');
  const art = (item.album && item.album.images && item.album.images[0]) ? item.album.images[0].url : '';
  const img = document.getElementById('spotifyArt');
  if (art) { img.src = art; img.hidden = false; }
  else     { img.removeAttribute('src'); img.hidden = true; }
}

function spotifyClearTrack() {
  document.getElementById('spotifyTrack').textContent  = 'Nothing playing';
  document.getElementById('spotifyArtist').textContent = '';
  const img = document.getElementById('spotifyArt');
  img.removeAttribute('src');
  img.hidden = true;
  spotifyTrackTempo = null;
  spotifyUpdateBpm();
}

function spotifyUpdateBpm() {
  const el = document.getElementById('spotifyBpm');
  if (!el) return;
  el.textContent = spotifyTrackTempo ? spotifyTrackTempo.toFixed(1) : '—';
}

function spotifyUpdatePlayBtn(playing) {
  const btn = document.getElementById('spotifyPlay');
  if (btn) {
    btn.textContent = playing ? '⏸' : '▶';
    btn.classList.toggle('go', !playing);
  }
}

function spotifyUpdateRepeatBtn() {
  const btn = document.getElementById('spotifyRepeat');
  if (!btn) return;
  const map = { off: '⟳ OFF', context: '⟳ ALL', track: '⟳ ONE' };
  btn.textContent = map[spotifyRepeatState] || '⟳ OFF';
  btn.classList.toggle('on', spotifyRepeatState !== 'off');
}

function spotifySetStatus(msg, isError) {
  const el = document.getElementById('spotifyStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('error', !!isError);
}

function spotifyUpdateUI() {
  const loggedIn = spotifyIsLoggedIn();
  const id       = spotifyClientId();

  const cidInput = document.getElementById('spotifyClientIdInput');
  if (cidInput && document.activeElement !== cidInput) cidInput.value = id;

  document.getElementById('spotifyLoginBtn').disabled  = !id;
  document.getElementById('spotifyLoginBtn').classList.toggle('hidden',  loggedIn);
  document.getElementById('spotifyLogoutBtn').classList.toggle('hidden', !loggedIn);
  document.getElementById('spotifyControls').classList.toggle('hidden',  !loggedIn);
  document.getElementById('spotifyTrackInfo').classList.toggle('hidden', !loggedIn);

  const redirectEl = document.getElementById('spotifyRedirectUri');
  if (redirectEl) redirectEl.textContent = SPOTIFY.REDIRECT_URI;

  const sync = document.getElementById('spotifySync');
  if (sync) sync.checked = localStorage.getItem(SPOTIFY_KEYS.syncBpm) === '1';
}

function setupSpotify() {
  // Wire up controls
  document.getElementById('spotifyClientIdInput').addEventListener('change', (e) => spotifySetClientId(e.target.value));
  document.getElementById('spotifyLoginBtn').addEventListener('click', spotifyLogin);
  document.getElementById('spotifyLogoutBtn').addEventListener('click', spotifyLogout);
  document.getElementById('spotifyPlay').addEventListener('click',     spotifyTogglePlayPause);
  document.getElementById('spotifyNext').addEventListener('click',     spotifyNext);
  document.getElementById('spotifyPrev').addEventListener('click',     spotifyPrevious);
  document.getElementById('spotifyRepeat').addEventListener('click',   spotifyToggleRepeat);

  const vol = document.getElementById('spotifyVolume');
  vol.addEventListener('input',  (e) => {
    const v = parseInt(e.target.value, 10);
    spotifyVolumeLocal = v;
    document.getElementById('spotifyVolumeVal').textContent = v + '%';
  });
  vol.addEventListener('change', (e) => spotifySetVolume(parseInt(e.target.value, 10)));

  const sync = document.getElementById('spotifySync');
  sync.addEventListener('change', (e) => {
    localStorage.setItem(SPOTIFY_KEYS.syncBpm, e.target.checked ? '1' : '0');
    if (e.target.checked && spotifyTrackTempo) setTarget(spotifyTrackTempo);
  });

  spotifyUpdateUI();
  spotifyHandleCallback().then(() => {
    spotifyUpdateUI();
    if (spotifyIsLoggedIn()) spotifyStartPoll();
  });
}
