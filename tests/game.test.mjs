// Unit tests for the rules shared by the browser and the server.  Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIPS, DEFAULT_RULES, FACE_KEYS, LIMITS, PAYOUTS, PHRASES, REACTIONS, SAY_IDS, TIMERS, cleanRules, settle, sumBets,
} from '../shared/game.js';

const dice = (...k) => k;
const six = (...head) => [...head, ...Array(6 - head.length).fill('chidiya')];

test('there are six figures and the five chip values', () => {
  assert.equal(FACE_KEYS.length, 6);
  assert.equal(new Set(FACE_KEYS).size, 6);
  assert.deepEqual(CHIPS, [10, 50, 100, 500, 1000]);
});

test('settle: a figure wins when 2+ dice show it and pays 1:1 per die (stake back + stake × matches)', () => {
  const r = settle({ burja: 100 }, six('burja', 'burja'));
  assert.equal(r.counts.burja, 2);
  assert.equal(r.payout, 300);         // 100 returned + 2 × 100 won
  assert.equal(r.net, 200);
});

test('settle: exactly one die is NOT a win by default (it would make the game pay the player ~66% per bet)', () => {
  const r = settle({ paan: 100 }, six('paan'));
  assert.equal(r.counts.paan, 1);
  assert.equal(r.payout, 0);
  assert.equal(r.net, -100);
  // the older family variant, where one die already wins, is still available
  assert.equal(settle({ paan: 100 }, six('paan'), { ...DEFAULT_RULES, payout: 'perdie' }).net, 100);
});

test('the default rule gives the house an edge (about 14% of each stake) instead of the player', () => {
  // exact expectation over every one of the 6^6 rolls
  let total = 0; let rolls = 0;
  const walk = (d) => {
    if (d.length === 6) { total += settle({ paan: 100 }, d).net; rolls += 1; return; }
    for (const k of FACE_KEYS) walk([...d, k]);
  };
  walk([]);
  const edge = -total / rolls / 100;
  assert.ok(edge > 0.12 && edge < 0.16, `house edge ${edge}`);
});

test('settle: a figure that does not appear loses its stake', () => {
  const r = settle({ paan: 50 }, six('burja'));
  assert.equal(r.counts.paan, 0);
  assert.equal(r.payout, 0);
  assert.equal(r.net, -50);
});

test('settle: the example from the rules dialog (Rs 100 Burja ×2, Rs 50 Paan ×0 = +150)', () => {
  const r = settle({ burja: 100, paan: 50 }, six('burja', 'burja'));
  assert.equal(r.net, 150);
  assert.deepEqual(r.lines.map((l) => [l.key, l.matches, l.back]), [['burja', 2, 300], ['paan', 0, 0]]);
});

test("settle: 'once' pays a figure a single time however many dice show it", () => {
  const rules = { ...DEFAULT_RULES, payout: 'once' };
  assert.equal(settle({ burja: 100 }, six('burja', 'burja', 'burja'), rules).net, 100);
  assert.equal(settle({ burja: 100 }, six('burja', 'burja', 'burja')).net, 300);
  assert.equal(settle({ burja: 100 }, six('burja'), rules).net, 100);       // once: a single die wins too
});

test('settle: ignores unknown figures and non-positive stakes', () => {
  const r = settle({ bogus: 100, burja: 0, paan: -5, surat: 10 }, six());
  assert.deepEqual(r.lines.map((l) => l.key), ['surat']);
  assert.equal(r.staked, 10);
});

test('settle: backing every figure when each shows once loses everything under the default rule', () => {
  const stakes = Object.fromEntries(FACE_KEYS.map((k) => [k, 10]));
  const r = settle(stakes, six('langur', 'burja', 'paan', 'surat', 'eent', 'chidiya'));
  assert.equal(r.staked, 60);
  assert.equal(r.payout, 0);
});

test('settle: money is conserved (net = payout − staked) over many random rolls', () => {
  for (let i = 0; i < 500; i += 1) {
    const d = Array.from({ length: 6 }, () => FACE_KEYS[Math.floor(Math.random() * 6)]);
    const stakes = Object.fromEntries(FACE_KEYS.filter(() => Math.random() < 0.5).map((k) => [k, CHIPS[Math.floor(Math.random() * 5)]]));
    for (const payout of PAYOUTS) {
      const r = settle(stakes, d, { ...DEFAULT_RULES, payout });
      assert.equal(r.net, r.payout - r.staked);
      assert.equal(Object.values(r.counts).reduce((a, b) => a + b, 0), 6);
    }
  }
});

test('cleanRules: keeps valid values and falls back to defaults for anything else', () => {
  assert.deepEqual(cleanRules(undefined), DEFAULT_RULES);
  assert.deepEqual(cleanRules({ payout: 'bogus', limit: 123, timer: 7, rotate: 'yes', voice: 'shout' }), DEFAULT_RULES);
  assert.deepEqual(cleanRules({ payout: 'once', limit: 500, timer: 30, rotate: false, voice: 'open', rounds: 10 }), { payout: 'once', limit: 500, timer: 30, rotate: false, voice: 'open', rounds: 10 });
  assert.equal(cleanRules({ rounds: 7 }).rounds, 0);
  for (const l of LIMITS) assert.equal(cleanRules({ limit: l }).limit, l);
  for (const t of TIMERS) assert.equal(cleanRules({ timer: t }).timer, t);
});

test('sumBets handles empty and missing input', () => {
  assert.equal(sumBets({ a: 10, b: 20 }), 30);
  assert.equal(sumBets({}), 0);
  assert.equal(sumBets(undefined), 0);
});

test('quick-chat ids are unique presets', () => {
  assert.equal(new Set(SAY_IDS).size, REACTIONS.length + PHRASES.length);
});
