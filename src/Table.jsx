import React, { useEffect, useRef } from 'react';
import { Undo2, Trash2, Repeat } from 'lucide-react';
import { FACES, CHIPS, sumBets } from './faces.js';
import FaceIcon from './FaceIcon.jsx';
import Die3D, { impacts } from './Die3D.jsx';
import { useT } from './i18n.jsx';
import { sfx } from './sound.js';
import { ShareResultButton } from './ShareBar.jsx';

/**
 * The visual table, shared by solo practice and private rooms. It owns no game state:
 * the parent supplies the dice, bets and callbacks, so both modes look and feel identical.
 */
export default function Table(props) {
  const {
    dice, rollId, rolling, result, hint, bets, others = {}, balance, round,
    chip, setChip, locked, countdown, watching, roundLabel, shareCtx, actionSlot, onPlace, onUndo, onClear, onRebet, onRoll,
    rollLabel, rollDisabled, canUndo, canClear, canRebet,
  } = props;
  const { t, rs, lang, faceName, faceAlt } = useT();

  const totalBet = sumBets(bets);
  const hitKeys = result ? result.lines.filter((l) => l.won).map((l) => l.key) : [];

  // How many times each figure came up on the dice currently on the table.
  const landed = rollId > 0 && !rolling;
  const counts = Object.fromEntries(FACES.map((f) => [f.key, 0]));
  if (landed) dice.forEach((d) => { counts[d] += 1; });
  const came = FACES.filter((f) => counts[f.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]);

  // sounds: dice rattle when a new roll starts, a jingle when the result lands
  const seenRoll = useRef(rollId);
  const seenResult = useRef(null);
  useEffect(() => {
    if (rollId !== seenRoll.current) {
      seenRoll.current = rollId;
      sfx.rattle(dice.flatMap((_, i) => impacts(i)));   // one knock per bounce of every die
    }
  }, [rollId]);
  useEffect(() => {
    if (!result || seenResult.current === rollId) return;
    seenResult.current = rollId;
    if (result.lines.length === 0) return;
    if (result.net > 0) sfx.win(); else if (result.net < 0) sfx.lose();
  }, [result, rollId]);

  const place = (key) => { if (locked) return; sfx.chip(); onPlace(key); };

  // keyboard: 1–6 place a chip, Space rolls
  const latest = useRef({});
  latest.current = { place, onRoll, rollDisabled };
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || watching) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!latest.current.rollDisabled) latest.current.onRoll();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 6) latest.current.place(FACES[n - 1].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [watching]);

  let banner = { kind: 'idle', text: hint };
  if (rolling) banner = { kind: 'idle', text: t('banner.rolling') };
  else if (result?.lines.length) {
    banner = result.net > 0
      ? { kind: 'win', text: t('banner.win', { amt: rs(result.net) }) }
      : result.net < 0
        ? { kind: 'loss', text: t('banner.loss', { amt: rs(-result.net) }) }
        : { kind: 'even', text: t('banner.even') };
  } else if (result) banner = { kind: 'idle', text: t('banner.result') };

  return (
    <>
      <section className="stage" aria-label="Dice">
        <div className="statbar">
          {!watching && <div><span>{t('stat.balance')}</span><b>{rs(balance)}</b></div>}
          {!watching && <div><span>{t('stat.bet')}</span><b>{rs(totalBet)}</b></div>}
          <div><span>{t('stat.round')}</span><b>{roundLabel ?? `#${round}`}</b></div>
          {countdown != null && (
            <div className={`timer ${countdown <= 5 ? 'urgent' : ''}`} role="timer" aria-label={t('timer.label')}>
              <span>{t('timer.label')}</span><b>{countdown}s</b>
            </div>
          )}
        </div>

        <div className="dice-row">
          {dice.map((d, i) => (
            <Die3D key={i} index={i} face={d} rollId={rollId} tossing={rolling} hit={!rolling && hitKeys.includes(d)} />
          ))}
        </div>

        {/* What the dice show, grouped by figure. Always rendered so the layout never jumps. */}
        <div className="came" aria-live="polite">
          {landed && (
            <>
              <span className="came-label">{t('result.label')}</span>
              {came.map((f) => (
                <span key={f.key} className={`came-chip ${hitKeys.includes(f.key) ? 'won' : ''}`} style={{ '--tone': f.tone }}>
                  <FaceIcon face={f} size={18} />
                  {faceName(f.key)}
                  <b>×{counts[f.key]}</b>
                </span>
              ))}
            </>
          )}
        </div>

        <div className={`banner ${banner.kind}`} role="status">{banner.text}</div>
        {landed && shareCtx && (
          <div className="share-row">
            <ShareResultButton build={() => ({ dice, net: watching ? undefined : result?.net, round, title: shareCtx.title, code: shareCtx.code })} />
          </div>
        )}

        {!watching && actionSlot}

        {!watching && (
          <button className="roll" onClick={onRoll} disabled={rollDisabled}>
            {rollLabel}
            <kbd>Space</kbd>
          </button>
        )}
      </section>

      <section className="board-card" aria-label={t('board.title')}>
        <div className="card-head">
          <h2>{t('board.title')}</h2>
          <span className="muted">{t('board.hint')}</span>
        </div>
        <div className="board">
          {FACES.map((f, i) => {
            const stake = bets[f.key] ?? 0;
            const line = result?.lines.find((l) => l.key === f.key);
            const friends = others[f.key] ?? 0;
            return (
              <button
                key={f.key}
                className={`cell ${stake ? 'staked' : ''} ${hitKeys.includes(f.key) && !rolling ? 'hit' : ''}`}
                style={{ '--tone': f.tone }}
                onClick={() => place(f.key)}
                disabled={locked}
                aria-label={`${faceName(f.key)} ${faceAlt(f.key)}: ${rs(stake)}`}
              >
                <kbd className="key">{i + 1}</kbd>
                {landed && (
                  <span className={`count-badge ${counts[f.key] ? 'on' : ''}`} title={t('result.came', { n: counts[f.key] })}>
                    ×{counts[f.key]}
                  </span>
                )}
                <FaceIcon face={f} size={44} />
                <span className="cell-name">{faceName(f.key)}</span>
                <span className="cell-en" lang={lang === 'ne' ? 'en' : 'ne'}>{faceAlt(f.key)}</span>
                <span className={`stake ${stake ? 'on' : ''}`}>{stake ? rs(stake) : '—'}</span>
                {friends > 0 && <span className="friends">{t(watching ? 'board.players' : 'board.friends', { amt: rs(friends) })}</span>}
                {line && !rolling && (
                  <span className={`cell-result ${line.won ? 'up' : 'down'}`}>
                    {line.won ? `×${line.matches} · +${rs(line.back - line.stake)}` : `−${rs(line.stake)}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!watching && <div className="chips" role="radiogroup" aria-label="Chip">
          {CHIPS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={chip === c}
              aria-label={t('chip.label', { n: c })}
              className={`chip chip-${c} ${chip === c ? 'active' : ''}`}
              onClick={() => setChip(c)}
            >
              {c >= 1000 ? `${c / 1000}K` : c}
            </button>
          ))}
          <div className="spacer" />
          <button className="ghost-btn" onClick={onUndo} disabled={!canUndo}><Undo2 size={15} /> {t('btn.undo')}</button>
          <button className="ghost-btn" onClick={onClear} disabled={!canClear}><Trash2 size={15} /> {t('btn.clear')}</button>
          <button className="ghost-btn" onClick={onRebet} disabled={!canRebet}><Repeat size={15} /> {t('btn.rebet')}</button>
        </div>}
        {props.children}
      </section>
    </>
  );
}
