import { FACE_KEYS } from '../shared/game.js';

export { CHIPS, DICE_COUNT, START_BANKROLL, ROLL_MS, FACE_KEYS, sumBets } from '../shared/game.js';

// Order must match FACE_KEYS. `tone` is used on the dark UI, `ink` is the print colour on the ivory dice.
// Display names are picked per language in i18n.jsx (faceName / faceAlt).
export const FACES = [
  { key: 'langur',  nepali: 'लंगुर',  english: 'Flag',    tone: '#4aa3ff', ink: '#1d5fb4' },
  { key: 'burja',   nepali: 'बुर्जा',  english: 'Crown',   tone: '#f2c14e', ink: '#a8730a' },
  { key: 'paan',    nepali: 'पान',    english: 'Heart',   tone: '#ff6b6b', ink: '#c4262e' },
  { key: 'surat',   nepali: 'सुरत',   english: 'Spade',   tone: '#e8ecf4', ink: '#1a1d21' },
  { key: 'eent',    nepali: 'ईंट',    english: 'Diamond', tone: '#ff9f5a', ink: '#d4561f' },
  { key: 'chidiya', nepali: 'चिडिया', english: 'Club',    tone: '#7ad9a0', ink: '#14663f' },
];
export const FACE_BY_KEY = Object.fromEntries(FACES.map((f) => [f.key, f]));

if (FACES.some((f, i) => f.key !== FACE_KEYS[i])) throw new Error('FACES out of sync with shared FACE_KEYS');
