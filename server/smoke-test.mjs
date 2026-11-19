// End-to-end check of the room server: two players, bets, roll, settlement, reconnect.
// Run with the server up:  npm run server   (in another terminal)  then  npm run test:server
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { settle, DEFAULT_RULES } from '../shared/game.js';

const URL = process.env.WS_URL ?? 'ws://localhost:3001/ws';

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, state: null, you: null, token: null, errors: [], waiters: [] };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'welcome') { c.you = m.you; c.token = m.token; c.code = m.code; }
    if (m.t === 'state') c.state = m.state;
    if (m.t === 'say') (c.said ??= []).push(m);
    if (m.t === 'rtc' || m.t === 'voicepeers') (c.rtc ??= []).push(m);
    if (m.t === 'error') c.errors.push(m.msg);
    c.waiters = c.waiters.filter((w) => !w(c));
  });
  c.open = new Promise((res) => ws.on('open', res));
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = (pred, ms = 6000) => new Promise((res, rej) => {
    if (pred(c)) return res();
    const t = setTimeout(() => rej(new Error(`timeout waiting (${name})`)), ms);
    c.waiters.push((cc) => { if (pred(cc)) { clearTimeout(t); res(); return true; } return false; });
  });
  return c;
}

const host = client('Asha');
await host.open;
host.send({ t: 'create', name: 'Asha' });
await host.until((c) => c.state && c.code);
assert.equal(host.code.length, 5);
console.log('✓ room created', host.code);

const friend = client('Bikash');
await friend.open;
friend.send({ t: 'join', code: host.code.toLowerCase(), name: 'Bikash' });
await friend.until((c) => c.state?.players.length === 2);
console.log('✓ friend joined with lower-case code');

// validation: bad chip / face, friend cannot roll
friend.send({ t: 'bet', face: 'burja', amount: 7 });
friend.send({ t: 'bet', face: 'nope', amount: 10 });
friend.send({ t: 'roll' });
await friend.until((c) => c.errors.length >= 3);
console.log('✓ invalid bets and non-host roll rejected');

host.send({ t: 'bet', face: 'burja', amount: 100 });
host.send({ t: 'bet', face: 'paan', amount: 50 });
friend.send({ t: 'bet', face: 'burja', amount: 500 });
await friend.until((c) => c.state.players.every((p) => Object.keys(p.bets).length > 0));
const me = (c) => c.state.players.find((p) => p.id === c.you);
assert.equal(me(host).balance, 5000 - 150);
assert.equal(me(friend).balance, 5000 - 500);

host.send({ t: 'undo' });
await host.until((c) => me(c).bets.paan === undefined);
assert.equal(me(host).balance, 5000 - 100);
console.log('✓ bets deducted, undo refunds');

host.send({ t: 'roll' });
await friend.until((c) => c.state.phase === 'rolling');
friend.send({ t: 'bet', face: 'surat', amount: 10 });          // locked while rolling
await friend.until((c) => c.errors.length >= 4);
await Promise.all([host, friend].map((c) => c.until((cc) => cc.state.phase === 'result', 8000)));

const { dice } = host.state;
assert.equal(dice.length, 6);
for (const [c, stakes] of [[host, { burja: 100 }], [friend, { burja: 500 }]]) {
  const expected = settle(stakes, dice);
  assert.equal(me(c).balance, 5000 - expected.staked + expected.payout, `${c.name} balance`);
}
console.log('✓ dice', dice.join(','), '→ balances match settle()');

// reconnect with token keeps the seat
const friendBalance = me(friend).balance;
friend.ws.close();
await host.until((c) => c.state.players.find((p) => p.name === 'Bikash')?.connected === false);
const back = client('Bikash-2');
await back.open;
back.send({ t: 'resume', code: host.code, token: friend.token });
await back.until((c) => c.you === friend.you && c.state?.players.length === 2);
assert.equal(me(back).balance, friendBalance, 'balance survives reconnect');
console.log('✓ resumed seat after disconnect');

host.send({ t: 'next' });
await host.until((c) => c.state.phase === 'betting' && c.state.round === 2);
back.send({ t: 'rebet' });
await back.until((c) => me(c).bets.burja === 500);
console.log('✓ next round + rebet');

// bad resume
const ghost = client('ghost');
await ghost.open;
ghost.send({ t: 'resume', code: host.code, token: 'nope' });
await ghost.until((c) => c.errors.length > 0);
console.log('✓ bad token rejected');

// ── house rules ──
{
  back.send({ t: 'clear' });
  await back.until((c) => !me(c).bets.burja);
  assert.deepEqual(host.state.rules, DEFAULT_RULES);
  // pure settle(): 'once' pays a figure a single time
  const dice = ['burja', 'burja', 'paan', 'surat', 'eent', 'chidiya'];
  assert.equal(settle({ burja: 100 }, dice).net, 200);
  assert.equal(settle({ burja: 100 }, dice, { payout: 'once', limit: 0 }).net, 100);
  // only the host may change rules; invalid values are ignored
  globalThis.guest = client('Guest');
  await guest.open;
  guest.send({ t: 'join', code: host.code, name: 'Guest' });
  await guest.until((c) => c.state && c.you);
  guest.send({ t: 'rules', rules: { limit: 500 } });
  await guest.until((c) => c.errors.length > 0);
  assert.equal(host.state.rules.limit, 0);
  host.send({ t: 'rules', rules: { limit: 500, payout: 'bogus' } });
  await host.until((c) => c.state.rules.limit === 500);
  assert.equal(host.state.rules.payout, 'perdie');
  // the limit is enforced per figure
  host.send({ t: 'bet', face: 'paan', amount: 500 });
  await host.until((c) => c.state.players.find((p) => p.id === c.you).bets.paan === 500);
  const e = host.errors.length;
  host.send({ t: 'bet', face: 'paan', amount: 10 });
  await host.until((c) => c.errors.length > e);
  // rules lock once bets exist
  host.send({ t: 'rules', rules: { payout: 'once' } });
  await host.until((c) => c.errors.length > e + 1);
  assert.equal(host.state.rules.payout, 'perdie');
  host.send({ t: 'clear' });
  host.send({ t: 'rules', rules: { limit: 0, payout: 'once' } });
  await host.until((c) => c.state.rules.payout === 'once');
  host.send({ t: 'rules', rules: { payout: 'perdie' } });
  await host.until((c) => c.state.rules.payout === 'perdie');
  console.log('✓ house rules: host-only, validated, per-figure limit, locked after bets');
}

// ── betting timer ──
{
  host.send({ t: 'rules', rules: { timer: 20, rotate: false } });
  await host.until((c) => c.state.rules.timer === 20 && c.state.rules.rotate === false);
  assert.equal(host.state.closesIn, null, 'timer does not run before the first bet');
  const rid = host.state.rollId;
  host.send({ t: 'bet', face: 'burja', amount: 10 });
  await host.until((c) => c.state.closesIn > 0 && c.state.closesIn <= 20000);
  console.log('✓ timer starts at first bet (' + Math.round(host.state.closesIn / 1000) + 's left)');
  // rules lock while it runs; then an early manual roll stops the timer
  host.send({ t: 'roll' });
  await host.until((c) => c.state.phase === 'rolling');
  assert.equal(host.state.closesIn, null);
  await host.until((c) => c.state.phase === 'result', 8000);
  assert.equal(host.state.rollId, rid + 1);
  console.log('✓ manual roll cancels the timer');
  host.send({ t: 'next' });
  await host.until((c) => c.state.phase === 'betting');
  host.send({ t: 'rules', rules: { timer: 0, rotate: true } });
  await host.until((c) => c.state.rules.timer === 0 && c.state.rules.rotate === true);
}

// ── rotating roller ──
{
  const all = [host, back];
  const rollerClient = () => all.find((c) => c.you === host.state.rollerId);
  const r1 = rollerClient();
  const other = all.find((c) => c !== r1);
  const n = other.errors.length;
  other.send({ t: 'roll' });
  await other.until((c) => c.errors.length > n);
  r1.send({ t: 'bet', face: 'burja', amount: 10 });
  await r1.until((c) => c.state.players.find((p) => p.id === c.you).bets.burja === 10);
  r1.send({ t: 'roll' });
  await host.until((c) => c.state.phase === 'result', 8000);
  const before = host.state.rollerId;
  r1.send({ t: 'next' });
  await host.until((c) => c.state.phase === 'betting');
  assert.notEqual(host.state.rollerId, before, 'roller rotates each round');
  console.log('✓ roller rotates; non-roller cannot roll');
  // with rotation off the host always rolls
  host.send({ t: 'rules', rules: { rotate: false } });
  await host.until((c) => c.state.rules.rotate === false);
  assert.equal(host.state.rollerId, host.state.hostId);
  console.log('✓ rotation off → host rolls');
}

// ── standings ──
{
  const sum = host.state.players.reduce((a, p) => a + p.total, 0);
  for (const p of host.state.players) assert.equal(p.total, p.balance - 5000 + (p.bets ? Object.values(p.bets).reduce((a, b) => a + b, 0) : 0), `${p.name} total matches balance`);
  assert.ok(Number.isInteger(sum));
  const last = host.state.history[0];
  assert.ok(Array.isArray(last.results) && last.results.length >= 1, 'history records who played');
  assert.ok(last.results.every((r, i, a) => i === 0 || a[i - 1].net >= r.net), 'results sorted best first');
  console.log('✓ standings: totals match balances, history lists round results');
}

// ── quick chat ──
{
  host.send({ t: 'say', id: '<script>' });                 // not a preset → ignored
  host.send({ t: 'say', id: 'clap' });
  host.send({ t: 'say', id: 'fire' });                     // inside the cooldown → dropped
  await back.until((c) => c.said?.length >= 1);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(back.said.length, 1);
  assert.equal(back.said[0].id, 'clap');
  assert.equal(back.said[0].name, 'Asha');
  assert.equal(host.said.length, 1, 'sender gets it too');
  console.log('✓ quick chat: presets only, broadcast to all, rate-limited');
}

// ── spectators ──
{
  const seated = host.state.players.length;
  const w = client('Watcher');
  await w.open;
  w.send({ t: 'join', code: host.code, name: 'Watcher', watch: true });
  await w.until((c) => c.you && c.state);
  assert.equal(w.state.players.length, seated, 'spectator is not a seated player');
  await host.until((c) => c.state.watchers === 1);
  const n = w.errors.length;
  w.send({ t: 'bet', face: 'burja', amount: 10 });
  w.send({ t: 'roll' });
  w.send({ t: 'rules', rules: { limit: 500 } });
  await w.until((c) => c.errors.length >= n + 3);
  assert.equal(host.state.rules.limit, 0);
  await new Promise((r) => setTimeout(r, 1000));              // let the chat cooldown pass
  w.send({ t: 'say', id: 'wow' });
  await host.until((c) => c.said?.some((m) => m.id === 'wow' && m.name === 'Watcher'));
  // a spectator can resume after a dropped connection
  const token = w.token;
  w.ws.close();
  const w2 = client('Watcher-2');
  await w2.open;
  w2.send({ t: 'resume', code: host.code, token });
  await w2.until((c) => c.you === w.you && c.state);
  // watchers never count as players, and leaving frees the slot
  w2.send({ t: 'leave' });
  await host.until((c) => c.state.watchers === 0);
  assert.equal(host.state.players.length, seated);
  w2.ws.close();
  console.log('✓ spectators: read-only, can react, resume, leave');
}

// ── voice chat (roster + call-setup relay; the audio itself is peer-to-peer) ──
{
  assert.equal(host.state.rules.voice, 'ptt');
  assert.deepEqual(host.state.voice, []);
  host.send({ t: 'voice', on: true });
  await host.until((c) => c.state.voice.length === 1);
  assert.deepEqual(host.rtc?.filter((m) => m.t === 'voicepeers').at(-1)?.peers, [], 'first person has nobody to call');

  back.send({ t: 'voice', on: true });
  await back.until((c) => c.state.voice.length === 2);
  assert.deepEqual(back.rtc.filter((m) => m.t === 'voicepeers').at(-1).peers, [host.you], 'newcomer is told who to call');

  // call-setup messages are relayed only between people who are in the call
  back.send({ t: 'rtc', to: host.you, data: { sdp: { type: 'offer', sdp: 'v=0' } } });
  await host.until((c) => c.rtc?.some((m) => m.t === 'rtc' && m.from === back.you && m.data.sdp.type === 'offer'));
  const outsider = client('Outsider');
  await outsider.open;
  outsider.send({ t: 'join', code: host.code, name: 'Outsider', watch: true });
  await outsider.until((c) => c.you && c.state);
  const before = host.rtc.length;
  outsider.send({ t: 'rtc', to: host.you, data: { ice: { candidate: 'x' } } });   // spectator not in the call yet
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(host.rtc.length, before, 'not-in-call senders are ignored');

  // a spectator can join the call as a listener
  outsider.send({ t: 'voice', on: true });
  await host.until((c) => c.state.voice.some((v) => v.watcher && v.name === 'Outsider'));
  outsider.send({ t: 'rtc', to: host.you, data: { ice: { candidate: 'y' } } });
  await host.until((c) => c.rtc.some((m) => m.from === outsider.you));

  // an oversized message is not relayed
  const sizeBefore = host.rtc.length;
  back.send({ t: 'rtc', to: host.you, data: { sdp: 'x'.repeat(13000) } });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(host.rtc.length, sizeBefore);

  // dropping the connection removes someone from the call
  outsider.ws.close();
  await host.until((c) => !c.state.voice.some((v) => v.name === 'Outsider'));

  // only the host changes the mode; switching voice off empties the call; joining while off is refused
  const n = back.errors.length;
  back.send({ t: 'rules', rules: { voice: 'off' } });
  await back.until((c) => c.errors.length > n);
  host.send({ t: 'rules', rules: { voice: 'open' } });
  await host.until((c) => c.state.rules.voice === 'open');
  host.send({ t: 'rules', rules: { voice: 'off' } });
  await host.until((c) => c.state.rules.voice === 'off' && c.state.voice.length === 0);
  const m = host.errors.length;
  host.send({ t: 'voice', on: true });
  await host.until((c) => c.errors.length > m);
  host.send({ t: 'rules', rules: { voice: 'ptt' } });
  await host.until((c) => c.state.rules.voice === 'ptt');
  console.log('✓ voice chat: roster, newcomer calls existing, relay limited to the call, spectators listen, host rule');
}

for (const c of [host, back, ghost, globalThis.guest]) c.ws.close();
console.log('\nAll room-server checks passed.');

process.exit(0);
