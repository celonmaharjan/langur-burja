import React, { useEffect, useRef } from 'react';
import { Check, Clock, Dices } from 'lucide-react';
import { useT } from './i18n.jsx';
import { sfx } from './sound.js';

/**
 * "Who is ready" strip plus the Ready button. Everyone except the roller taps Ready once their bets are in;
 * the roller sees who is still missing, and can roll anyway if somebody is slow.
 */
export default function ReadyBar({ state, you, rollerId, isRoller, anyStake, connected, send }) {
  const { t } = useT();
  const players = state.players;
  const me = players.find((p) => p.id === you);
  const others = players.filter((p) => p.connected);
  const waiting = others.filter((p) => p.id !== rollerId && !p.ready);
  const readyCount = others.filter((p) => p.id !== rollerId && p.ready).length;

  // soft sounds: a tick when someone gets ready, a chime when the table is complete
  const prev = useRef({ readyCount: 0, waiting: waiting.length });
  useEffect(() => {
    if (readyCount > prev.current.readyCount) sfx.ready();
    if (waiting.length === 0 && prev.current.waiting > 0 && anyStake) sfx.allReady();
    prev.current = { readyCount, waiting: waiting.length };
  }, [readyCount, waiting.length, anyStake]);

  if (players.length < 2) return null;
  const toggle = () => send({ t: 'ready', on: !me?.ready });
  const names = waiting.map((p) => p.name).join(', ');

  return (
    <div className="readybar">
      <ul className="ready-list" aria-label={t('ready.title')}>
        {others.map((p) => {
          const roller = p.id === rollerId;
          const st = roller ? 'roller' : p.ready ? 'ok' : 'wait';
          return (
            <li key={p.id} className={`ready-chip ${st}`}>
              <span className="av">{p.avatar}</span>
              <span className="rname">{p.name}</span>
              {roller ? <Dices size={14} aria-label={t('ready.rolls')} /> : p.ready ? <Check size={14} aria-label={t('ready.ready')} /> : <Clock size={14} aria-label={t('ready.waiting')} />}
            </li>
          );
        })}
      </ul>

      {!isRoller && me && (
        <button className={`ready-btn ${me.ready ? 'on' : ''}`} onClick={toggle} disabled={!connected} aria-pressed={!!me.ready}>
          {me.ready ? <><Check size={18} /> {t('ready.notReady')}</> : t('ready.imReady')}
        </button>
      )}

      {isRoller && (
        <div className="ready-roller" role="status">
          {waiting.length === 0
            ? <span className="all-ready"><Check size={16} /> {t('ready.all')}</span>
            : <span>{t('ready.waitingFor', { names })}</span>}
          {waiting.length > 0 && anyStake && (
            <button className="ghost-btn" onClick={() => send({ t: 'roll', force: true })} disabled={!connected}>{t('ready.rollAnyway')}</button>
          )}
        </div>
      )}
    </div>
  );
}
