// End-to-end browser test. Builds the app, starts its own server (nothing saved to disk) and a headless Chrome,
// then drives the real UI: language switch, solo round, a two-player private room and a spectator.
//   npm run test:e2e            (set CHROME=/path/to/chrome if it can't be found automatically)
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 3080;
const CDP_PORT = 9360;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(homedir(), '.cache/puppeteer');
  for (const kind of ['chrome-headless-shell', 'chrome']) {
    const root = path.join(cache, kind);
    if (!existsSync(root)) continue;
    for (const ver of readdirSync(root).sort().reverse()) {
      for (const bin of [`chrome-headless-shell-linux64/chrome-headless-shell`, `chrome-linux64/chrome`]) {
        const p = path.join(root, ver, bin);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { /* try next */ }
  }
  throw new Error('No Chrome found. Set CHROME=/path/to/chrome');
}

console.log('building…');
execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { stdio: 'inherit' });

const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: 'off' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('listening')) res(); }));

const profile = mkdtempSync(path.join(tmpdir(), 'langur-e2e-'));
const chrome = spawn(findChrome(), [`--remote-debugging-port=${CDP_PORT}`, '--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { chrome.kill(); server.kill('SIGTERM'); rmSync(profile, { recursive: true, force: true }); };
process.on('exit', cleanup);

await sleep(1500);
const problems = [];

async function openTab(name, first) {
  const target = first
    ? (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === 'page')
    : await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') problems.push(`${name}: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  });
  const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1400, deviceScaleFactor: 1, mobile: false });
  const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const tab = {
    js,
    goto: async (url) => { await cdp('Page.navigate', { url }); await sleep(1400); },
    reload: async () => { await cdp('Page.reload'); await sleep(1400); },
    click: (sel, i = 0) => js(`document.querySelectorAll(${JSON.stringify(sel)})[${i}].click()`),
    text: (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`),
    type: (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`),
    dice: () => js(`[...document.querySelectorAll('.die3d')].map((d) => d.getAttribute('aria-label'))`),
    waitFor: async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await js(expr)) return true; await sleep(100); } throw new Error(`${name}: timed out waiting for ${expr}`); },
  };
  return tab;
}

let passed = 0;
const step = async (label, fn) => { await fn(); passed += 1; console.log(`✓ ${label}`); };

try {
  const a = await openTab('A', true);

  await step('home renders in Nepali, switches to English and remembers it', async () => {
    await a.goto(BASE);
    await a.js(`localStorage.clear(); sessionStorage.clear()`);
    await a.reload();
    assert.equal(await a.js(`document.documentElement.lang`), 'ne');
    assert.match(await a.text('.hero h1'), /लंगुर बुर्जा/);
    await a.click('.lang-btn');
    assert.equal(await a.js(`document.documentElement.lang`), 'en');
    await a.reload();
    assert.equal(await a.js(`document.documentElement.lang`), 'en', 'language survives a reload');
    assert.equal(await a.text('.hero h1'), 'Langur Burja');
  });

  await step('support dialog shows the QR; daily bonus adds chips once; theme switches', async () => {
    await a.click('.support-link');
    await a.waitFor(`!!document.querySelector('.support-qr')`);
    await a.waitFor(`document.querySelector('.support-qr').complete && document.querySelector('.support-qr').naturalWidth > 100`);
    await a.click('.dialog .icon-btn');
    const before = await a.js(`JSON.parse(localStorage.getItem('langur-burja:solo:v2') ?? '{"balance":5000}').balance`);
    await a.click('.daily .primary');
    await a.waitFor(`!document.querySelector('.daily .primary')`);
    const after = await a.js(`JSON.parse(localStorage.getItem('langur-burja:solo:v2')).balance`);
    assert.equal(after - before, 500, 'first daily bonus is Rs 500');
    await a.click('.theme-wrap .icon-btn');
    await a.click('.theme-menu button', 1);
    assert.equal(await a.js(`document.documentElement.dataset.theme`), 'dashain');
    await a.click('.theme-wrap .icon-btn');
    await a.click('.theme-menu button', 0);
    assert.equal(await a.js(`document.documentElement.dataset.theme`), 'classic');
  });

  await step('solo: bet, roll, six dice land and the counts add up to 6', async () => {
    await a.click('button.mode', 0);
    await a.click('.chip-100');
    await a.click('.cell', 1);
    assert.match(await a.text('.cell:nth-child(2) .stake'), /100/);
    await a.click('.roll');
    await a.waitFor(`document.querySelectorAll('.count-badge').length === 6`);
    const counts = await a.js(`[...document.querySelectorAll('.count-badge')].map((b) => Number(b.textContent.replace('×', '')))`);
    assert.equal(counts.reduce((x, y) => x + y, 0), 6);
    assert.equal((await a.dice()).length, 6);
    assert.ok(await a.text('.banner'), 'a result banner is shown');
  });

  // ─── private room with a friend and a spectator ───
  await a.goto(BASE);
  await a.click('button.mode', 1);
  await a.type('.field input', 'Asha');
  await a.click('.lobby-box button', 0);
  await a.waitFor(`!!document.querySelector('.room-code')`);
  const code = await a.text('.room-code');
  assert.match(code, /^[A-Z0-9]{5}$/);

  const b = await openTab('B', false);
  await b.goto(`${BASE}/?room=${code}`);
  await step('a friend opens the invite link: the room code is prefilled and they join', async () => {
    assert.equal(await b.js(`document.querySelector('.code-input').value`), code);
    await b.type('.field input', 'Bikash');
    await b.js(`document.querySelectorAll('.lobby-box')[1].querySelector('button').click()`);
    await b.waitFor(`document.querySelectorAll('.players li').length === 2`);
    await a.waitFor(`document.querySelectorAll('.players li').length === 2`);
  });

  const c = await openTab('C', false);
  await c.goto(`${BASE}/?room=${code}`);
  await step('a spectator can watch but not bet or roll', async () => {
    await c.type('.field input', 'Chhori');
    await c.js(`[...document.querySelectorAll('.lobby-box')[1].querySelectorAll('button')].find((x) => x.type === 'button').click()`);
    await c.waitFor(`!!document.querySelector('.watch-banner')`);
    assert.equal(await c.js(`!document.querySelector('.roll') && !document.querySelector('.chips')`), true);
  });

  await step('both players bet; only the roller can roll; everyone sees the same dice', async () => {
    await a.click('.chip-100'); await a.click('.cell', 1);
    await b.click('.chip-500'); await b.click('.cell', 1); await b.click('.cell', 3);
    await a.waitFor(`!!document.querySelectorAll('.cell')[1].querySelector('.friends')`);
    assert.equal(await b.js(`document.querySelector('.roll').disabled`), true, 'the friend cannot roll in round 1');
    await a.click('.roll');
    await Promise.all([a, b, c].map((t) => t.waitFor(`document.querySelectorAll('.count-badge').length === 6`, 10000)));
    const [da, db, dc] = await Promise.all([a.dice(), b.dice(), c.dice()]);
    assert.deepEqual(db, da);
    assert.deepEqual(dc, da);
  });

  await step('invite buttons carry the room code; share-result makes a picture; avatars show', async () => {
    const wa = await a.js(`document.querySelector('.sharebar a.wa').href`);
    assert.ok(decodeURIComponent(wa).includes(code), 'WhatsApp link contains the room code');
    assert.ok(await a.js(`document.querySelector('.sharebar a.vb').href`).then((h) => h.startsWith('viber://')));
    assert.ok(await a.js(`document.querySelectorAll('.players .av').length`) >= 2, 'players have avatars');
    await a.click('.share-result');
    await a.waitFor(`!!document.querySelector('.share-row .fine')`);       // headless has no share sheet, so it downloads
  });

  await step('standings, history and the spectator count update', async () => {
    assert.equal(await a.js(`document.querySelectorAll('.standings li').length`), 2);
    assert.match(await a.text('.history li'), /Round 1/);
    assert.match(await a.text('.side-grid .card-head .muted'), /1 watching/);
  });

  await step('next round: the roller rotates to the friend', async () => {
    await a.click('.roll');                                           // "Next round" (host rolled round 1)
    await b.waitFor(`!!document.querySelector('.cell') && !document.querySelector('.cell').disabled`);
    await b.click('.chip-50'); await b.click('.cell', 0);
    await b.waitFor(`!document.querySelector('.roll').disabled`);
    assert.equal(await a.js(`document.querySelector('.roll').disabled`), true, 'the host cannot roll in round 2');
    await b.click('.roll');
    await a.waitFor(`document.querySelectorAll('.count-badge').length === 6`, 10000);
  });

  await step('quick chat reaches the other players and the spectator', async () => {
    await b.click('.react', 1);
    await a.waitFor(`document.querySelector('.feed li')?.innerText.includes('Bikash')`);
    await c.waitFor(`document.querySelector('.feed li')?.innerText.includes('Bikash')`);
  });

  await step('tournament: 5 rounds with equal chips, final standings, play again', async () => {
    const d = await openTab('D', false);            // its own tabs, so the voice step below still has its room
    await d.goto(BASE);
    await d.click('button.mode', 1);
    await d.type('.field input', 'Asha');
    await d.type('.lobby-box .field input', 'Test Family');
    await d.click('.lobby-box button', 0);
    await d.waitFor(`!!document.querySelector('.room-code')`);
    assert.equal(await d.text('.room-title'), 'Test Family');
    const tcode = await d.text('.room-code');
    await d.js(`[...document.querySelectorAll('.houserules .seg button')].find((x) => x.textContent === '5 rounds').click()`);
    await d.waitFor(`document.querySelector('.statbar').innerText.includes('1/5')`);
    const f = await openTab('F', false);
    await f.goto(`${BASE}/?room=${tcode}`);
    await f.type('.field input', 'Bikash');
    await f.js(`document.querySelectorAll('.lobby-box')[1].querySelector('button').click()`);
    await f.waitFor(`document.querySelectorAll('.players li').length === 2`);
    for (let i = 1; i <= 5; i += 1) {
      const isRoller = (t) => t.js(`document.querySelector('.roll').innerText.startsWith('Roll dice')`);
      const who = (await isRoller(d)) ? d : f;
      await who.click('.chip-100'); await who.click('.cell', 2);
      await who.waitFor(`!document.querySelector('.roll').disabled`);
      await who.click('.roll');
      await who.waitFor(`document.querySelectorAll('.count-badge').length === 6`, 10000);
      await who.waitFor(`document.querySelector('.roll').innerText.startsWith('Next round')`, 10000);
      await who.click('.roll');                     // "Next round"; after round 5 this opens the final standings
      if (i < 5) await d.waitFor(`document.querySelector('.statbar').innerText.includes('${i + 1}/5')`, 10000);
    }
    await d.waitFor(`!!document.querySelector('.tour-final')`, 10000);
    await f.waitFor(`!!document.querySelector('.tour-final')`, 10000);
    assert.match(await d.text('.tour-final .winner'), /wins!/);
    assert.equal(await d.js(`document.querySelectorAll('.tour-final .standings li').length`), 2);
    assert.equal(await f.js(`!document.querySelector('.tour-final .primary')`), true, 'only the host can restart');
    await d.click('.tour-final .share-result');
    await d.waitFor(`!!document.querySelector('.tour-final .fine')`);                 // picture downloaded (no share sheet in headless)
    await d.click('.tour-final .primary');
    await d.waitFor(`document.querySelector('.statbar').innerText.includes('1/5')`);
    assert.equal(await d.js(`!document.querySelector('.tour-final')`), true);
    assert.match(await d.text('.statbar'), /5,000/);
  });

  await step('voice chat: a player talks and the other player and the spectator hear and see it', async () => {
    for (const t of [a, b, c]) await t.click('.voice-join');
    await a.waitFor(`document.querySelectorAll('.voice-list li').length === 3`);
    assert.equal(await c.js(`!document.querySelector('.mic-btn')`), true, 'spectators get no microphone button');
    // hold push-to-talk on A (the browser supplies a fake microphone that beeps)
    await a.js(`document.querySelector('.mic-btn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await a.waitFor(`!!document.querySelector('.mic-btn.live')`);
    const heard = `[...document.querySelectorAll('.voice-list li.speaking')].some((li) => li.innerText.includes('Asha'))`;
    try { await b.waitFor(heard, 20000); } catch (e) {            // audio crossed the peer-to-peer connection
      console.log('A peers:', JSON.stringify(await a.js(`window.__langurVoice()`)), '\\nB peers:', JSON.stringify(await b.js(`window.__langurVoice()`)));
      throw e;
    }
    await c.waitFor(heard, 20000);
    await a.js(`document.querySelector('.mic-btn').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))`);
    await a.waitFor(`!document.querySelector('.mic-btn.live')`);
    await b.click('.voice-list li:not(.speaking) .icon-btn');          // local mute button exists for others
    await b.click('.voice-controls .ghost-btn');                        // leave voice
    await a.waitFor(`document.querySelectorAll('.voice-list li').length === 2`);
  });

  await step('no JavaScript errors in any tab', async () => { assert.deepEqual(problems, []); });
  console.log(`\nAll ${passed} browser checks passed.`);
} catch (err) {
  console.error('\n✗ FAILED:', err.message);
  if (problems.length) console.error('page errors:', problems);
  cleanup();
  process.exit(1);
}
cleanup();
process.exit(0);
