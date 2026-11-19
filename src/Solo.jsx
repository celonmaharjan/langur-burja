import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Table from './Table.jsx';
import { RecentRolls, FaceFrequency } from './Panels.jsx';
import { CHIPS, FACE_KEYS, ROLL_MS, START_BANKROLL, sumBets } from './faces.js';
import { settle, DICE_COUNT } from '../shared/game.js';
import { useT } from './i18n.jsx';
import { sfx } from './sound.js';
import { recordRound } from './stats.js';

const STORAGE_KEY = 'langur-burja:solo:v2';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Number.isFinite(raw.balance) && Array.isArray(raw.history)) return raw;
  } catch { /* storage unavailable */ }
  return { balance: START_BANKROLL, history: [] };
}

/** Practice table against the house — everything runs in the browser. */
export default function Solo() {
  const { t, rs } = useT();
  const initial = useMemo(load, []);
  const [balance, setBalance] = useState(initial.balance);
  const [history, setHistory] = useState(initial.history);
  const [bets, setBets] = useState({});
  const [lastBets, setLastBets] = useState({});
  const [log, setLog] = useState([]);
  const [chip, setChip] = useState(50);
  const [dice, setDice] = useState(FACE_KEYS);
  const [rollId, setRollId] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(history.length + 1);
  const [noteCode, setNoteCode] = useState(null); // error code, translated at render time
  const timer = useRef(null);

  const totalBet = sumBets(bets);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance: balance + totalBet, history: history.slice(0, 30) })); } catch { /* ignore */ }
  }, [balance, totalBet, history]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const place = (key) => {
    if (rolling) return;
    if (balance < chip) { setNoteCode('no-funds'); return; }
    setNoteCode(null);
    setResult(null);
    setBalance((b) => b - chip);
    setBets((cur) => ({ ...cur, [key]: (cur[key] ?? 0) + chip }));
    setLog((l) => [...l, { key, amount: chip }]);
  };

  const undo = () => {
    if (rolling || log.length === 0) return;
    const { key, amount } = log[log.length - 1];
    setLog((l) => l.slice(0, -1));
    setBalance((b) => b + amount);
    setBets((cur) => {
      const next = { ...cur, [key]: cur[key] - amount };
      if (next[key] <= 0) delete next[key];
      return next;
    });
  };

  const clear = () => {
    if (rolling || totalBet === 0) return;
    setBalance((b) => b + totalBet);
    setBets({});
    setLog([]);
  };

  const lastTotal = sumBets(lastBets);
  const rebet = () => {
    if (rolling || totalBet > 0 || lastTotal === 0) return;
    if (lastTotal > balance) { setNoteCode('no-funds-rebet'); return; }
    setNoteCode(null);
    setResult(null);
    setBalance((b) => b - lastTotal);
    setBets({ ...lastBets });
    setLog(Object.entries(lastBets).map(([key, amount]) => ({ key, amount })));
  };

  const roll = () => {
    if (rolling || totalBet === 0) return;
    const final = Array.from({ length: DICE_COUNT }, () => FACE_KEYS[Math.floor(Math.random() * FACE_KEYS.length)]);
    const stakes = bets;
    setNoteCode(null);
    setResult(null);
    setDice(final);
    setRollId((r) => r + 1);
    setRolling(true);
    timer.current = setTimeout(() => {
      const s = settle(stakes, final);
      if (s.lines.length) recordRound(s.net);          // personal record + streaks (this device only)
      setBalance((b) => b + s.payout);
      setResult({ net: s.net, lines: s.lines, counts: s.counts });
      setLastBets(stakes);
      setBets({});
      setLog([]);
      setHistory((h) => [{ id: Date.now(), dice: final, net: s.net }, ...h].slice(0, 30));
      setRound((r) => r + 1);
      setRolling(false);
    }, ROLL_MS);
  };

  const broke = !rolling && totalBet === 0 && balance < CHIPS[0];
  const hint = noteCode
    ? t(`err.${noteCode}`)
    : totalBet > 0 ? t('solo.hintReady', { amt: rs(totalBet) }) : t('solo.hintIdle');

  return (
    <main className="wrap">
      <Table
        dice={dice} rollId={rollId} rolling={rolling} result={result} hint={hint}
        bets={bets} balance={balance} round={round} shareCtx={{}}
        chip={chip} setChip={setChip} locked={rolling}
        onPlace={place} onUndo={undo} onClear={clear} onRebet={rebet} onRoll={roll}
        rollLabel={rolling ? t('roll.rolling') : t('roll.go')}
        rollDisabled={rolling || totalBet === 0}
        canUndo={!rolling && log.length > 0} canClear={!rolling && totalBet > 0}
        canRebet={!rolling && totalBet === 0 && lastTotal > 0}
      >
        {broke && (
          <div className="broke">
            {t('solo.broke')}{' '}
            <button className="link" onClick={() => { setBalance(START_BANKROLL); setHistory([]); setResult(null); sfx.chip(); }}>
              <RotateCcw size={14} /> {t('solo.restart', { amt: rs(START_BANKROLL) })}
            </button>
          </div>
        )}
      </Table>
      <section className="side-grid">
        <RecentRolls items={history} />
        <FaceFrequency items={history} />
      </section>
    </main>
  );
}
