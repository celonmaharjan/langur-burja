import React, { useMemo } from 'react';
import { FACES, FACE_BY_KEY } from './faces.js';
import FaceIcon from './FaceIcon.jsx';
import { useT } from './i18n.jsx';

/** items: [{ id, dice: string[], net?: number, label?: string }] newest first */
export function RecentRolls({ items }) {
  const { t, alt, rs, lang } = useT();
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('panel.recent')}</h2>
        <span className="muted" lang={lang === 'ne' ? 'en' : 'ne'}>{alt('panel.recent')}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty">{t('panel.empty')}</p>
      ) : (
        <ul className="history">
          {items.slice(0, 6).map((h) => (
            <li key={h.id}>
              <span className="mini-dice">
                {h.dice.map((d, i) => (
                  <span key={i} className="mini" style={{ color: FACE_BY_KEY[d].tone }}>
                    <FaceIcon face={d} size={16} />
                  </span>
                ))}
              </span>
              {h.net !== undefined && (
                <span className={`net ${h.net > 0 ? 'up' : h.net < 0 ? 'down' : ''}`}>
                  {h.net > 0 ? '+' : h.net < 0 ? '−' : ''}{rs(Math.abs(h.net))}
                </span>
              )}
              {h.net === undefined && h.round !== undefined && (
                <span className="net round-note">
                  <span>{t('panel.round', { n: h.round })}</span>
                  {h.top && <em className={h.top.net > 0 ? 'up' : ''}>{h.top.name} {h.top.net > 0 ? '+' : h.top.net < 0 ? '−' : ''}{rs(Math.abs(h.top.net))}</em>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FaceFrequency({ items }) {
  const { t, alt, lang, faceName } = useT();
  const { tally, total } = useMemo(() => {
    const counts = Object.fromEntries(FACES.map((f) => [f.key, 0]));
    items.forEach((h) => h.dice.forEach((d) => { counts[d] += 1; }));
    return { tally: counts, total: items.length * 6 };
  }, [items]);
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('panel.freq')}</h2>
        <span className="muted" lang={lang === 'ne' ? 'en' : 'ne'}>{alt('panel.freq')}</span>
      </div>
      <ul className="freq">
        {FACES.map((f) => {
          const pct = total ? (tally[f.key] / total) * 100 : 0;
          return (
            <li key={f.key}>
              <span className="freq-name" style={{ color: f.tone }}>{faceName(f.key)}</span>
              <span className="bar"><span style={{ width: `${pct}%`, background: f.tone }} /></span>
              <span className="pct">{total ? `${pct.toFixed(0)}%` : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="fine">{t('panel.fair')}</p>
    </div>
  );
}

/** players: [{ id, name, total, wins }] — ranked by session profit. */
export function Standings({ players, you }) {
  const { t, rs } = useT();
  const ranked = [...players].sort((a, b) => b.total - a.total || b.wins - a.wins);
  const played = ranked.some((p) => p.total !== 0 || p.wins > 0);
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('stand.title')}</h2>
        <span className="muted">{t('stand.sub')}</span>
      </div>
      <ol className="standings">
        {ranked.map((p, i) => (
          <li key={p.id} className={p.id === you ? 'me' : ''}>
            <span className={`rank r${played ? i + 1 : 0}`}>{i + 1}</span>
            <span className="sname">{p.avatar && <span className="av">{p.avatar}</span>} {p.name}{p.id === you && <em className="tag">{t('room.you')}</em>}</span>
            <span className="swins">{t('stand.wins', { n: p.wins })}</span>
            <span className={`net ${p.total > 0 ? 'up' : p.total < 0 ? 'down' : ''}`}>
              {p.total > 0 ? '+' : p.total < 0 ? '−' : ''}{rs(Math.abs(p.total))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
