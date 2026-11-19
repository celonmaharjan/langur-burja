// Game logic shared by the browser (solo practice) and the room server (multiplayer).
// Keep this file free of browser / Node specific APIs.

export const FACE_KEYS = ['langur', 'burja', 'paan', 'surat', 'eent', 'chidiya'];
export const CHIPS = [10, 50, 100, 500, 1000];
export const DICE_COUNT = 6;
export const START_BANKROLL = 5000;
export const MAX_PLAYERS = 8;
export const ROLL_MS = 1900;     // how long the dice tumble before the result is shown
export const RESULT_MS = 9000;   // how long a room shows the result before the next betting round

/**
 * Settle one player's stakes against a roll.
 * 'multi' (default): a figure wins only when 2 or more dice show it, and then pays 1:1 per die (stake returned + stake × matches).
 *   Exactly one die, or none, loses the stake. (With one die winning, the player would profit ~66% of every bet on average.)
 * 'perdie': every die showing a backed face pays 1:1, so even a single die wins.
 * 'once': a backed face that appears at all pays 1:1 a single time, however many dice show it.
 * A backed face that does not appear loses its stake.
 * Stakes are deducted when placed, so `payout` is what is credited back and `net` the profit/loss.
 */
export const PAYOUTS = ['multi', 'perdie', 'once'];
export const LIMITS = [0, 500, 1000, 5000];   // max total stake per figure; 0 = no limit
export const TIMERS = [0, 20, 30, 60];         // seconds betting stays open after the first bet; 0 = no timer
export const ROUNDS = [0, 5, 10, 20];           // tournament length in rounds; 0 = a normal open-ended room
export const AVATARS = ['🦁', '🐯', '🐘', '🦚', '🐒', '🦌', '🐼', '🦅', '🐍', '🪔', '🌼', '🎲', '👑', '🏔', '🛕', '🥁'];
export const VOICES = ['off', 'ptt', 'open'];   // voice chat: off, push-to-talk, or open mic (players choose when to unmute)
export const DEFAULT_RULES = { payout: 'multi', limit: 0, timer: 0, rotate: true, voice: 'ptt', rounds: 0 };   // rotate: a different player rolls each round

export function cleanRules(r) {
  return {
    payout: PAYOUTS.includes(r?.payout) ? r.payout : DEFAULT_RULES.payout,
    limit: LIMITS.includes(Number(r?.limit)) ? Number(r.limit) : DEFAULT_RULES.limit,
    timer: TIMERS.includes(Number(r?.timer)) ? Number(r.timer) : DEFAULT_RULES.timer,
    rotate: typeof r?.rotate === 'boolean' ? r.rotate : DEFAULT_RULES.rotate,
    voice: VOICES.includes(r?.voice) ? r.voice : DEFAULT_RULES.voice,
    rounds: ROUNDS.includes(Number(r?.rounds)) ? Number(r.rounds) : DEFAULT_RULES.rounds,
  };
}

export function settle(stakes, dice, rules = DEFAULT_RULES) {
  const counts = Object.fromEntries(FACE_KEYS.map((k) => [k, 0]));
  for (const d of dice) if (d in counts) counts[d] += 1;

  let staked = 0;
  let payout = 0;
  const lines = [];
  for (const [key, stake] of Object.entries(stakes)) {
    if (!(key in counts) || !(stake > 0)) continue;
    const matches = counts[key];
    const wins = rules.payout === 'once' ? Math.min(matches, 1) : rules.payout === 'multi' ? (matches >= 2 ? matches : 0) : matches;
    const back = wins > 0 ? stake * (1 + wins) : 0;
    staked += stake;
    payout += back;
    lines.push({ key, stake, matches, back, won: back > 0 });
  }
  return { counts, lines, staked, payout, net: payout - staked };
}

export const sumBets = (bets) => Object.values(bets ?? {}).reduce((a, b) => a + b, 0);

// Quick chat: preset reactions and phrases only (no free text), identified by id. The UI supplies glyphs / wording.
export const REACTIONS = ['clap', 'fire', 'laugh', 'cry', 'wow', 'luck'];
export const PHRASES = ['well', 'lucky', 'hurry', 'again', 'big', 'oops'];
export const SAY_IDS = [...REACTIONS, ...PHRASES];
