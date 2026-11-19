// Personal progress kept on this device only (nothing is sent anywhere): rounds played, streaks, the daily bonus.
import { START_BANKROLL } from '../shared/game.js';

const KEY = 'langur-burja:stats:v1';
const SOLO_KEY = 'langur-burja:solo:v2';
const BLANK = { rounds: 0, wins: 0, biggest: 0, streak: 0, best: 0, daily: { last: '', streak: 0 }, nudgedAt: 0 };

export function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { ...BLANK, ...raw, daily: { ...BLANK.daily, ...raw.daily } };
  } catch { /* storage unavailable */ }
  return { ...BLANK, daily: { ...BLANK.daily } };
}

function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** Record a finished round (net = profit or loss, 0 for an even round). */
export function recordRound(net) {
  const s = getStats();
  s.rounds += 1;
  if (net > 0) { s.wins += 1; s.streak += 1; s.best = Math.max(s.best, s.streak); s.biggest = Math.max(s.biggest, net); }
  else if (net < 0) s.streak = 0;
  save(s);
  return s;
}

const dayKey = (d) => d.toLocaleDateString('en-CA');           // local date as YYYY-MM-DD
export const bonusFor = (streak) => 500 + 100 * Math.min(Math.max(streak, 1) - 1, 6);   // Rs 500 … 1,100

/** { available, streak, amount } — what claiming today would give. */
export function dailyStatus() {
  const { daily } = getStats();
  const today = dayKey(new Date());
  if (daily.last === today) return { available: false, streak: daily.streak, amount: 0 };
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const streak = daily.last === dayKey(y) ? daily.streak + 1 : 1;
  return { available: true, streak, amount: bonusFor(streak) };
}

/** Claim today's bonus into the practice-table balance. Returns the status claimed, or null if already claimed. */
export function claimDaily() {
  const st = dailyStatus();
  if (!st.available) return null;
  const s = getStats();
  s.daily = { last: dayKey(new Date()), streak: st.streak };
  save(s);
  try {
    const solo = JSON.parse(localStorage.getItem(SOLO_KEY)) ?? { balance: START_BANKROLL, history: [] };
    solo.balance = (Number.isFinite(solo.balance) ? solo.balance : START_BANKROLL) + st.amount;
    solo.history = Array.isArray(solo.history) ? solo.history : [];
    localStorage.setItem(SOLO_KEY, JSON.stringify(solo));
  } catch { /* ignore */ }
  return st;
}

/** The soft "support me" nudge: after 10 rounds, then at most once a week. */
export function shouldNudge() {
  const s = getStats();
  return s.rounds >= 10 && Date.now() - s.nudgedAt > 7 * 24 * 3600 * 1000;
}
export function dismissNudge() { const s = getStats(); s.nudgedAt = Date.now(); save(s); }
