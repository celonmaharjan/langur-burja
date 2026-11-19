import React, { useState } from 'react';
import { Flame, Gift, Globe2, Heart } from 'lucide-react';
import { useT } from './i18n.jsx';
import { claimDaily, dailyStatus, dismissNudge, getStats, shouldNudge } from './stats.js';

export function DailyBonus() {
  const { t, rs } = useT();
  const [status, setStatus] = useState(dailyStatus);
  const [got, setGot] = useState(null);
  const claim = () => { const r = claimDaily(); if (r) { setGot(r); setStatus(dailyStatus()); } };
  const streak = status.streak;
  return (
    <div className="card daily">
      <div className="daily-icon" aria-hidden><Gift size={26} /></div>
      <div className="daily-body">
        <h3>{t('daily.title')} {streak > 0 && <span className="streak"><Flame size={14} /> {t('daily.streak', { n: streak })}</span>}</h3>
        {got ? <p className="up">{t('daily.got', { amt: rs(got.amount).replace(/^(रु|Rs)\s?/, '') })}</p>
          : status.available ? <p>{t('daily.sub')}</p> : <p>{t('daily.done')}</p>}
      </div>
      {status.available && !got && (
        <button className="primary" onClick={claim}>{t('daily.claim', { amt: rs(status.amount).replace(/^(रु|Rs)\s?/, '') })}</button>
      )}
    </div>
  );
}

export function MyStats() {
  const { t, rs } = useT();
  const s = getStats();
  if (s.rounds === 0) return null;
  const items = [
    [t('mystats.rounds'), s.rounds],
    [t('mystats.wins'), s.wins],
    [t('mystats.best'), s.best],
    [t('mystats.biggest'), rs(s.biggest)],
  ];
  return (
    <div className="card mystats">
      <h3>{t('mystats.title')}</h3>
      <dl>
        {items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </div>
  );
}

export function AbroadCard({ onPick }) {
  const { t } = useT();
  return (
    <div className="card abroad">
      <Globe2 size={26} aria-hidden />
      <div>
        <h3>{t('home.abroad.title')}</h3>
        <p>{t('home.abroad.text')}</p>
      </div>
      <button className="primary" onClick={() => onPick('room')}>{t('home.room.title')}</button>
    </div>
  );
}

/** A quiet, dismissible hint shown after 10 rounds, then at most once a week. */
export function SupportNudge({ onSupport }) {
  const { t } = useT();
  const [show, setShow] = useState(shouldNudge);
  if (!show) return null;
  const hide = () => { dismissNudge(); setShow(false); };
  return (
    <div className="card nudge" role="note">
      <Heart size={18} aria-hidden />
      <span>{t('support.nudge')}</span>
      <button className="primary" onClick={() => { hide(); onSupport(); }}>{t('support.nudgeBtn')}</button>
      <button className="ghost-btn" onClick={hide}>{t('support.later')}</button>
    </div>
  );
}
