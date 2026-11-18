// Rooms must survive a server restart: a player can resume the same seat with the same balance and bets.
// Spawns its own server on a spare port with a throwaway data file.  Run: node server/persist-test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 3078;
const dir = mkdtempSync(path.join(tmpdir(), 'langur-'));
const DATA_FILE = path.join(dir, 'rooms.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_FILE }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res) => proc.stdout.on('data', (d) => { if (String(d).includes('listening')) res(proc); }));
}
const stop = (proc) => new Promise((res) => { proc.once('exit', res); proc.kill('SIGTERM'); });

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { ws, state: null, welcome: null };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'welcome') c.welcome = m;
    if (m.t === 'state') c.state = m.state;
    if (m.t === 'error') c.error = m;
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = async (pred, ms = 5000) => { const end = Date.now() + ms; while (!pred(c)) { if (Date.now() > end) throw new Error('timeout'); await sleep(25); } };
  return c;
}

try {
  let proc = await startServer();
  const a = client(); await a.open;
  a.send({ t: 'create', name: 'Asha' });
  await a.until((c) => c.welcome && c.state);
  const { code, token } = a.welcome;
  a.send({ t: 'rules', rules: { limit: 1000, payout: 'once' } });
  a.send({ t: 'bet', face: 'paan', amount: 100 });
  a.send({ t: 'bet', face: 'burja', amount: 50 });
  await a.until((c) => c.state.players[0].balance === 4850 && c.state.rules.payout === 'once');
  await sleep(700);                                  // the save is debounced
  a.ws.close();
  await stop(proc);
  console.log('✓ server stopped with a room in progress');

  proc = await startServer();
  const b = client(); await b.open;
  b.send({ t: 'resume', code, token });
  await b.until((c) => c.welcome && c.state);
  const me = b.state.players[0];
  assert.equal(me.name, 'Asha');
  assert.equal(me.balance, 4850, 'balance restored');
  assert.deepEqual(me.bets, { paan: 100, burja: 50 }, 'bets restored');
  assert.equal(b.state.rules.payout, 'once');
  assert.equal(b.state.rules.limit, 1000);
  assert.equal(b.state.phase, 'betting');
  console.log('✓ after restart: same seat, balance, bets and house rules');

  // the restored room is fully playable
  b.send({ t: 'roll' });
  await b.until((c) => c.state.phase === 'result', 8000);
  assert.equal(b.state.history.length, 1);
  console.log('✓ restored room can roll and settle');

  // a bad token cannot take the seat
  const ghost = client(); await ghost.open;
  ghost.send({ t: 'resume', code, token: 'nope' });
  await ghost.until((c) => c.error);
  console.log('✓ wrong token still rejected');

  b.ws.close(); ghost.ws.close();
  await stop(proc);
  console.log('\nPersistence checks passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
