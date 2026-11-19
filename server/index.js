// Private-room server for Langur Burja.
//
//   - WebSocket endpoint: /ws
//   - Serves the built client from ./dist when it exists (npm run build && npm run serve)
//   - The server is authoritative: dice are rolled here with crypto.randomInt and
//     every bet / payout is validated and settled here, never trusted from clients.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  CHIPS, DEFAULT_RULES, SAY_IDS, DICE_COUNT, cleanRules, FACE_KEYS, MAX_PLAYERS, RESULT_MS, ROLL_MS, START_BANKROLL, settle, sumBets,
} from '../shared/game.js';

const PORT = Number(process.env.PORT) || 3001;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 200;          // protects a small public host
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 30;
const GRACE_MS = 90_000; // how long a disconnected player keeps their seat
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L lookalikes
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../dist');
// Rooms are saved here so a restart or redeploy does not end a game. DATA_FILE=off disables saving.
const DATA_FILE = process.env.DATA_FILE ?? path.resolve(HERE, '../data/rooms.json');
const PERSIST = DATA_FILE !== 'off';

/** @type {Map<string, any>} */
const rooms = new Map();

// ───────────────────────────── helpers ─────────────────────────────
const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
// `code` lets the client show the message in the player's chosen language; `msg` is the English fallback.
const fail = (ws, code, msg, fatal = false) => send(ws, { t: 'error', code, msg, fatal });
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

function newCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
}

function lanAddresses() {
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    .sort((a, b) => rank(a) - rank(b));
}

// Who throws the dice this round: the rotating roller, or always the host when rotation is off.
function rollerOf(room) {
  if (room.rules.rotate && room.players.has(room.rollerId)) return room.rollerId;
  return room.hostId;
}

function canRoll(room, player) {
  if (player.id === rollerOf(room)) return true;
  // the host steps in if the current roller dropped off
  return player.id === room.hostId && !room.players.get(rollerOf(room))?.connected;
}

function advanceRoller(room) {
  const ids = [...room.players.keys()];
  if (ids.length === 0) return;
  const start = ids.indexOf(rollerOf(room));
  for (let i = 1; i <= ids.length; i += 1) {
    const cand = room.players.get(ids[(start + i) % ids.length]);
    if (cand.connected) { room.rollerId = cand.id; return; }
  }
}

const MAX_WATCHERS = 20;

function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,          // 'betting' | 'rolling' | 'result'
    round: room.round,
    hostId: room.hostId,
    rollerId: rollerOf(room),
    watchers: room.watchers.size,
    voice: [...room.voice].map((id) => {
      const p = room.players.get(id);
      const w = p ? null : room.watchers.get(id);
      return (p || w) ? { id, name: (p ?? w).name, watcher: !p } : null;
    }).filter(Boolean),
    rules: room.rules,
    closesIn: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,   // ms until betting auto-closes
    dice: room.dice,
    rollId: room.rollId,
    history: room.history.slice(0, 12),
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      balance: p.balance,
      bets: p.bets,
      connected: p.connected,
      result: p.result,
      hasLast: sumBets(p.lastBets) > 0,
      total: p.total,          // session profit / loss across all rounds
      wins: p.wins,
    })),
  };
}

function broadcast(room) {
  schedulePersist();
  const msg = { t: 'state', state: publicState(room) };
  for (const p of room.players.values()) send(p.ws, msg);
  for (const w of room.watchers.values()) send(w.ws, msg);
}

function addWatcher(room, ws, name) {
  const watcher = {
    id: randomBytes(4).toString('hex'),
    token: randomBytes(16).toString('hex'),
    name: name.slice(0, 16),
    ws,
    connected: true,
    removeTimer: null,
  };
  room.watchers.set(watcher.id, watcher);
  return watcher;
}

function addPlayer(room, ws, name) {
  let finalName = name;
  const taken = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
  for (let n = 2; taken.has(finalName.toLowerCase()); n += 1) finalName = `${name.slice(0, 13)} ${n}`;
  const player = {
    id: randomBytes(4).toString('hex'),
    token: randomBytes(16).toString('hex'),
    name: finalName,
    balance: START_BANKROLL,
    total: 0,
    wins: 0,
    bets: {},
    log: [],
    lastBets: {},
    result: null,
    ws,
    connected: true,
    removeTimer: null,
  };
  room.players.set(player.id, player);
  if (!room.hostId) room.hostId = player.id;
  if (!room.rollerId) room.rollerId = player.id;
  return player;
}

function bind(ws, room, player, watcher = false) {
  if (player.ws && player.ws !== ws) { player.ws.ctx = null; player.ws.close(); }
  clearTimeout(player.removeTimer);
  player.ws = ws;
  player.connected = true;
  ws.ctx = { room, player, watcher };
  send(ws, { t: 'welcome', role: watcher ? 'watcher' : 'player', you: player.id, token: player.token, code: room.code, lan: lanAddresses() });
  broadcast(room);
}

function removePlayer(room, player) {
  clearTimeout(player.removeTimer);
  room.voice.delete(player.id);
  room.players.delete(player.id);
  if (room.players.size === 0) {
    clearTimeout(room.timer);
    stopBetTimer(room);
    for (const w of room.watchers.values()) {
      clearTimeout(w.removeTimer);
      w.ws?.send(JSON.stringify({ t: 'error', code: 'expired', msg: 'The room has closed.', fatal: true }));
      if (w.ws) w.ws.ctx = null;
    }
    rooms.delete(room.code);
    schedulePersist();
    return;
  }
  if (room.rollerId === player.id) room.rollerId = null;
  if (room.hostId === player.id) {
    const next = [...room.players.values()].find((p) => p.connected) ?? [...room.players.values()][0];
    room.hostId = next.id;
  }
  broadcast(room);
}

function stopBetTimer(room) {
  clearTimeout(room.betTimer);
  room.betTimer = null;
  room.deadline = null;
}

function startNextRound(room) {
  clearTimeout(room.timer);
  stopBetTimer(room);
  room.phase = 'betting';
  room.round += 1;
  if (room.rules.rotate) advanceRoller(room);
  for (const p of room.players.values()) {
    if (sumBets(p.bets) > 0) p.lastBets = p.bets;
    p.bets = {};
    p.log = [];
    p.result = null;
  }
  broadcast(room);
}

function settleRoom(room) {
  const results = [];
  for (const p of room.players.values()) {
    const s = settle(p.bets, room.dice, room.rules);
    p.balance += s.payout;
    p.result = s.lines.length ? { net: s.net, lines: s.lines } : null;
    if (s.lines.length) {
      p.total += s.net;
      if (s.net > 0) p.wins += 1;
      results.push({ name: p.name, net: s.net });
    }
  }
  results.sort((a, b) => b.net - a.net);
  room.history.unshift({ round: room.round, dice: room.dice, results });
  room.phase = 'result';
  broadcast(room);
  room.timer = setTimeout(() => startNextRound(room), RESULT_MS);
}

const hasStake = (room) => [...room.players.values()].some((p) => sumBets(p.bets) > 0);

function rollDice(room) {
  stopBetTimer(room);
  room.dice = Array.from({ length: DICE_COUNT }, () => FACE_KEYS[randomInt(FACE_KEYS.length)]);
  room.rollId += 1;
  room.phase = 'rolling';
  broadcast(room);
  room.timer = setTimeout(() => settleRoom(room), ROLL_MS);
}

// With a timer rule, betting closes N seconds after the round's first bet and the server rolls by itself.
function armBetTimer(room, ms = room.rules.timer * 1000) {
  if (!room.rules.timer || room.betTimer || room.phase !== 'betting') return;
  room.deadline = Date.now() + ms;
  room.betTimer = setTimeout(() => {
    stopBetTimer(room);
    if (room.phase !== 'betting') return;
    if (hasStake(room)) rollDice(room); else broadcast(room);
  }, ms);
}

// ───────────────────────────── saving & restoring rooms ─────────────────────────────
let saveTimer = null;

function snapshot() {
  return {
    version: 1,
    savedAt: Date.now(),
    rooms: [...rooms.values()].map((r) => ({
      code: r.code, phase: r.phase, round: r.round, hostId: r.hostId, rollerId: r.rollerId, rules: r.rules,
      dice: r.dice, rollId: r.rollId, history: r.history.slice(0, 12), sayN: r.sayN ?? 0,
      closesIn: r.deadline ? Math.max(0, r.deadline - Date.now()) : null,
      players: [...r.players.values()].map((p) => ({
        id: p.id, token: p.token, name: p.name, balance: p.balance, total: p.total, wins: p.wins,
        bets: p.bets, log: p.log, lastBets: p.lastBets, result: p.result,
      })),
    })),
  };
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!PERSIST) return;
  try {
    mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot()));
    renameSync(tmp, DATA_FILE);                 // atomic: a crash never leaves a half-written file
  } catch (err) {
    console.error('Could not save rooms:', err.message);
  }
}

function schedulePersist() {
  if (!PERSIST || saveTimer) return;
  saveTimer = setTimeout(saveNow, 400);
  saveTimer.unref?.();
}

function restoreRooms() {
  if (!PERSIST) return;
  let data;
  try { data = JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return; }
  if (data?.version !== 1 || !Array.isArray(data.rooms)) return;
  let restored = 0;
  for (const r of data.rooms) {
    if (!r?.code || !Array.isArray(r.players) || r.players.length === 0 || rooms.has(r.code)) continue;
    const room = {
      code: r.code, phase: r.phase, round: r.round, hostId: r.hostId, rollerId: r.rollerId ?? null,
      rules: cleanRules(r.rules), dice: r.dice, rollId: r.rollId, history: r.history ?? [], sayN: r.sayN ?? 0,
      players: new Map(), watchers: new Map(), voice: new Set(), timer: null, betTimer: null, deadline: null,
    };
    for (const p of r.players) {
      const player = { ...p, ws: null, connected: false, removeTimer: null };
      player.removeTimer = setTimeout(() => removePlayer(room, player), GRACE_MS);
      room.players.set(player.id, player);
    }
    if (!room.players.has(room.hostId)) room.hostId = room.players.keys().next().value;
    rooms.set(room.code, room);
    // pick the round up where it stopped
    if (room.phase === 'rolling') settleRoom(room);
    else if (room.phase === 'result') room.timer = setTimeout(() => startNextRound(room), RESULT_MS);
    else if (r.closesIn != null) armBetTimer(room, r.closesIn);
    restored += 1;
  }
  if (restored) console.log(`Restored ${restored} room${restored === 1 ? '' : 's'} from ${DATA_FILE}`);
}

// ───────────────────────────── message handlers ─────────────────────────────
const handlers = {
  create(ws, msg) {
    const name = cleanName(msg.name);
    if (!name) return fail(ws, 'need-name', 'Please enter your name.');
    if (rooms.size >= MAX_ROOMS) return fail(ws, 'server-busy', 'The server is busy right now. Please try again in a few minutes.');
    leave(ws);
    const room = {
      code: newCode(),
      phase: 'betting',
      round: 1,
      hostId: null,
      rollerId: null,
      rules: { ...DEFAULT_RULES },
      dice: [...FACE_KEYS],
      rollId: 0,
      history: [],
      players: new Map(),
      watchers: new Map(),
      voice: new Set(),            // ids (players and spectators) currently in the voice chat
      timer: null,
      betTimer: null,
      deadline: null,
    };
    rooms.set(room.code, room);
    bind(ws, room, addPlayer(room, ws, name));
  },

  join(ws, msg) {
    const name = cleanName(msg.name);
    const room = rooms.get(cleanCode(msg.code));
    if (!name) return fail(ws, 'need-name', 'Please enter your name.');
    if (!room) return fail(ws, 'no-room', 'No room with that code. Check it and try again.');
    if (msg.watch === true) {
      if (room.watchers.size >= MAX_WATCHERS) return fail(ws, 'watchers-full', 'This room has too many spectators.');
      leave(ws);
      bind(ws, room, addWatcher(room, ws, name), true);
      return;
    }
    if (room.players.size >= MAX_PLAYERS) return fail(ws, 'room-full', `This room is full (${MAX_PLAYERS} players).`);
    leave(ws);
    bind(ws, room, addPlayer(room, ws, name));
  },

  resume(ws, msg) {
    const room = rooms.get(cleanCode(msg.code));
    const player = room && [...room.players.values()].find((p) => p.token === msg.token);
    const watcher = room && !player && [...room.watchers.values()].find((w) => w.token === msg.token);
    if (!player && !watcher) return fail(ws, 'expired', 'Your previous seat has expired.', true);
    bind(ws, room, player ?? watcher, !player);
  },

  leave(ws) { leave(ws); },

  bet(ws, msg, { room, player }) {
    if (room.phase !== 'betting') return fail(ws, 'betting-closed', 'Betting is closed for this round.');
    const amount = Number(msg.amount);
    if (!FACE_KEYS.includes(msg.face) || !CHIPS.includes(amount)) return fail(ws, 'invalid-bet', 'Invalid bet.');
    if (room.rules.limit && (player.bets[msg.face] ?? 0) + amount > room.rules.limit) return fail(ws, 'over-limit', `Limit is ${room.rules.limit} per figure.`);
    if (player.balance < amount) return fail(ws, 'no-funds', 'Not enough balance for that chip.');
    player.balance -= amount;
    player.bets[msg.face] = (player.bets[msg.face] ?? 0) + amount;
    player.log.push({ face: msg.face, amount });
    armBetTimer(room);
    broadcast(room);
  },

  undo(ws, msg, { room, player }) {
    if (room.phase !== 'betting' || player.log.length === 0) return;
    const { face, amount } = player.log.pop();
    player.balance += amount;
    player.bets[face] -= amount;
    if (player.bets[face] <= 0) delete player.bets[face];
    broadcast(room);
  },

  clear(ws, msg, { room, player }) {
    if (room.phase !== 'betting') return;
    player.balance += sumBets(player.bets);
    player.bets = {};
    player.log = [];
    broadcast(room);
  },

  rebet(ws, msg, { room, player }) {
    if (room.phase !== 'betting' || sumBets(player.bets) > 0) return;
    const total = sumBets(player.lastBets);
    if (total === 0) return;
    if (total > player.balance) return fail(ws, 'no-funds-rebet', 'Not enough balance to repeat the last bets.');
    if (room.rules.limit && Object.values(player.lastBets).some((v) => v > room.rules.limit)) return fail(ws, 'over-limit', `Limit is ${room.rules.limit} per figure.`);
    player.balance -= total;
    player.bets = { ...player.lastBets };
    armBetTimer(room);
    player.log = Object.entries(player.bets).map(([face, amount]) => ({ face, amount }));
    broadcast(room);
  },

  rebuy(ws, msg, { room, player }) {
    if (room.phase !== 'betting' || sumBets(player.bets) > 0 || player.balance >= CHIPS[0]) return;
    player.balance = START_BANKROLL;
    broadcast(room);
  },

  say(ws, msg, { room, player }) {
    if (!SAY_IDS.includes(msg.id)) return;
    const now = Date.now();
    if (now - (player.lastSay ?? 0) < 900) return;      // quiet rate limit, not worth an error
    player.lastSay = now;
    room.sayN = (room.sayN ?? 0) + 1;
    const out = { t: 'say', n: room.sayN, from: player.id, name: player.name, id: msg.id };
    for (const p of room.players.values()) send(p.ws, out);
    for (const w of room.watchers.values()) send(w.ws, out);
  },

  rules(ws, msg, { room, player }) {
    if (room.hostId !== player.id) return fail(ws, 'host-only', 'Only the host can change the rules.');
    const patch = msg.rules && typeof msg.rules === 'object' ? msg.rules : {};
    const voiceOnly = Object.keys(patch).every((k) => k === 'voice');      // the voice mode may change at any time
    if (!voiceOnly) {
      if (room.phase !== 'betting') return fail(ws, 'betting-closed', 'Rules can only change while betting is open.');
      if ([...room.players.values()].some((p) => sumBets(p.bets) > 0)) return fail(ws, 'bets-placed', 'Rules cannot change once bets are placed.');
    }
    room.rules = cleanRules({ ...room.rules, ...patch });
    if (room.rules.voice === 'off') room.voice.clear();
    broadcast(room);
  },

  // ── voice chat ──
  // Audio flows directly between browsers (WebRTC). The server only keeps the roster and relays the setup messages.
  voice(ws, msg, { room, player }) {
    if (room.rules.voice === 'off') return fail(ws, 'voice-off', 'Voice chat is turned off in this room.');
    if (msg.on === true) {
      room.voice.add(player.id);
      const peers = [...room.voice].filter((id) => id !== player.id);
      send(ws, { t: 'voicepeers', peers });             // the newcomer calls everyone already there
    } else {
      room.voice.delete(player.id);
    }
    broadcast(room);
  },

  rtc(ws, msg, { room, player }) {
    if (!room.voice.has(player.id) || !room.voice.has(msg.to)) return;
    const target = room.players.get(msg.to) ?? room.watchers.get(msg.to);
    if (!target?.ws || JSON.stringify(msg.data ?? null).length > 12_000) return;
    send(target.ws, { t: 'rtc', from: player.id, data: msg.data });
  },

  roll(ws, msg, { room, player }) {
    if (!canRoll(room, player)) return fail(ws, 'not-roller', 'It is not your turn to roll the dice.');
    if (room.phase !== 'betting') return;
    if (!hasStake(room)) return fail(ws, 'need-bet', 'Someone needs to place a bet before rolling.');
    rollDice(room);
  },

  next(ws, msg, { room, player }) {
    if (!canRoll(room, player) || room.phase !== 'result') return;
    startNextRound(room);
  },
};

function removeWatcher(room, watcher) {
  clearTimeout(watcher.removeTimer);
  room.voice.delete(watcher.id);
  room.watchers.delete(watcher.id);
  broadcast(room);
}

function leave(ws) {
  const ctx = ws.ctx;
  if (!ctx) return;
  ws.ctx = null;
  ctx.player.ws = null;
  if (ctx.watcher) removeWatcher(ctx.room, ctx.player);
  else removePlayer(ctx.room, ctx.player);
}

// ───────────────────────────── http + websocket ─────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') { res.writeHead(200).end('ok'); return; }
  try {
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST)) throw new Error('outside dist');
    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) {
      if (path.extname(file)) throw new Error('missing');
      file = path.join(DIST, 'index.html'); // single-page app fallback
    }
    const body = await readFile(file);
    const immutable = file.startsWith(path.join(DIST, 'assets'));
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Room server is running. Open the game through the Vite dev server (npm start), or run `npm run build` first to serve it from here.');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16_384 });

const perIp = new Map();
const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  if ((perIp.get(ip) ?? 0) >= MAX_CONN_PER_IP) { ws.close(1013, 'too many connections'); return; }
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  ws.on('close', () => { const n = (perIp.get(ip) ?? 1) - 1; if (n <= 0) perIp.delete(ip); else perIp.set(ip, n); });
  ws.isAlive = true;
  ws.ctx = null;
  let windowStart = Date.now();
  let count = 0;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; count = 0; }
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    // call-setup messages arrive in bursts (one set per peer), so they weigh much less than game messages
    if ((count += msg?.t === 'rtc' ? 0.15 : 1) > 30) { ws.close(1008, 'rate limit'); return; }
    if (!msg || typeof msg.t !== 'string' || !Object.hasOwn(handlers, msg.t)) return;

    const needsRoom = !['create', 'join', 'resume', 'leave'].includes(msg.t);
    if (needsRoom && !ws.ctx) return fail(ws, 'not-in-room', 'You are not in a room.');
    if (ws.ctx?.watcher && !['say', 'leave', 'voice', 'rtc'].includes(msg.t)) return fail(ws, 'watch-only', 'Spectators can only watch and send reactions.');
    handlers[msg.t](ws, msg, ws.ctx);
  });

  ws.on('close', () => {
    const ctx = ws.ctx;
    if (!ctx || ctx.player.ws !== ws) return;
    const { room, player } = ctx;
    player.connected = false;
    player.ws = null;
    if (room.voice.delete(player.id)) broadcast(room);     // a dropped connection also drops the voice call
    if (ctx.watcher) {
      player.removeTimer = setTimeout(() => removeWatcher(room, player), GRACE_MS);
      return;
    }
    broadcast(room);
    player.removeTimer = setTimeout(() => removePlayer(room, player), GRACE_MS);
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000).unref();

restoreRooms();
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { saveNow(); process.exit(0); });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Langur Burja room server listening on :${PORT}`);
  for (const ip of lanAddresses()) console.log(`  LAN: http://${ip}:${PORT}`);
});
