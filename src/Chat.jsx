import React, { useEffect, useState } from 'react';
import { REACTIONS, PHRASES } from '../shared/game.js';
import { useT } from './i18n.jsx';
import { sfx } from './sound.js';

export const GLYPH = { clap: '👏', fire: '🔥', laugh: '😂', cry: '😭', wow: '😮', luck: '🍀' };

/** Reaction + phrase buttons. Sending is rate-limited by the server. */
export function ChatPanel({ send, said, you }) {
  const { t } = useT();
  const [cool, setCool] = useState(false);
  const say = (id) => {
    if (cool) return;
    send({ t: 'say', id });
    setCool(true);
    setTimeout(() => setCool(false), 900);
  };
  const label = (id) => (GLYPH[id] ? GLYPH[id] : t(`say.${id}`));
  const recent = said.slice(-5).reverse();
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('chat.title')}</h2>
        <span className="muted">{t('chat.sub')}</span>
      </div>
      <div className="reactions">
        {REACTIONS.map((id) => (
          <button key={id} className="react" onClick={() => say(id)} disabled={cool} aria-label={id}>{GLYPH[id]}</button>
        ))}
      </div>
      <div className="phrases">
        {PHRASES.map((id) => (
          <button key={id} className="phrase" onClick={() => say(id)} disabled={cool}>{t(`say.${id}`)}</button>
        ))}
      </div>
      <ul className="feed" aria-live="polite">
        {recent.length === 0 && <li className="empty">{t('chat.empty')}</li>}
        {recent.map((m) => (
          <li key={m.n} className={m.from === you ? 'me' : ''}><b>{m.name}</b> {label(m.id)}</li>
        ))}
      </ul>
    </div>
  );
}

/** Floating bubbles over the screen for each new message; they disappear after a few seconds. */
export function SayBubbles({ said, you }) {
  const { t } = useT();
  const [live, setLive] = useState([]);
  const lastN = said.length ? said[said.length - 1].n : 0;
  useEffect(() => {
    if (!said.length) return undefined;
    const m = said[said.length - 1];
    setLive((l) => [...l.slice(-3), m]);
    if (m.from !== you) sfx.chip();
    setTimeout(() => setLive((l) => l.filter((x) => x.n !== m.n)), 3500);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastN]);
  return (
    <div className="bubbles" aria-hidden="true">
      {live.map((m) => (
        <div key={m.n} className={`bubble ${GLYPH[m.id] ? 'big' : ''}`}>
          <span className="bname">{m.name}</span>
          <span>{GLYPH[m.id] ?? t(`say.${m.id}`)}</span>
        </div>
      ))}
    </div>
  );
}
