# Langur Burja (लंगुर बुर्जा)

Nepali six-dice game, play-money only, Nepali/English. Vite + React 19 frontend, one Node `ws` server. Owner: Celon (GitHub celonmaharjan/langur-burja). Hosted on Render (Docker, free plan); ngrok was used for temporary tunnels.

## Layout
- `shared/game.js`: rules and payout math, used by BOTH browser and server. Keep it free of browser/Node APIs.
- `server/index.js`: authoritative rooms, dice (`crypto.randomInt`), timers, tournaments, spectators, voice signalling, persistence (`data/rooms.json`), anonymous stats (`/stats?key=ADMIN_KEY`), serves `dist/`, `/ws`, `/healthz`.
- `src/`: `Room.jsx` (lobby, room, rules bar, tournament final), `Table.jsx`, `Solo.jsx` (practice, localStorage `langur-burja:solo:v2`), `i18n.jsx` (all text, ne + en), `voice.js` (WebRTC mesh), `share.js` (invite links, result picture on canvas), `stats.js` (daily bonus, personal record), `theme.js` (Classic/Dashain/Tihar), `HomeExtras.jsx`, `SupportDialog.jsx`, `sound.js`, `Die3D.jsx`, `pwa.js`.
- `public/`: PWA files, `support-qr.jpg` (owner's Laxmi Sunrise QR).

## Decisions and why
- Payout default `multi`: a figure wins only with 2+ dice, paying 1:1 per die; one die loses the bet. The old per-die rule gave players about +66% per bet. House edge is now about 14% (verified by an exhaustive 6^6 unit test). `perdie` and `once` remain as house-rule options.
- Ready button: every connected player except the roller taps Ready (bets lock while ready; "Not ready" unlocks). The roller's Roll is disabled until all are ready; "Roll anyway" sends `{t:'roll', force:true}`; the betting timer still auto-rolls. `ready` resets each round.
- Chat: quick reactions/phrases (`say`) plus free text (`chat`, plain text only, 140 chars, 700 ms rate limit, spectators allowed). Each reaction has its own synth sound in `src/sound.js`.
- Rules: payout, limit, timer, rotate roller, voice mode, tournament rounds (5/10/20, only before round 1, equal chips, no rebuy).
- Voice: free Google STUN only, no TURN, so some strict networks will not connect. Spectators listen only.
- No accounts and no personal data. Stats are anonymous daily counters.
- Money is play-money. Real-money gambling is out of scope. Support is via donation QR; paid themes are NOT built (idea: manual unlock codes after QR payment, only once there are regular players).
- Themes are CSS variables on `:root[data-theme]`; no lunar dates are hardcoded.
- Nepali text was written by the AI and has not had a native-speaker review.

## Commands
- `npm run start` runs server :3001 and vite :5173 together (killing the :3001 process also stops vite).
- `npm test` runs unit + server + persistence tests. `npm run test:e2e` runs the headless-Chrome browser test (builds first).
- Env vars: PORT, MAX_ROOMS, MAX_CONN_PER_IP, DATA_FILE (`off` disables persistence), ADMIN_KEY.
- Do not use `pkill -f` in the shell here (it kills the shell); find the pid with `ss -ltnp`.

## Open items
- Native Nepali review of all `ne` strings.
- Custom domain not set up; the ngrok copy (port 3090) serves an old build.
- Ideas not built: paid cosmetics, accounts/families, TURN server for voice.
