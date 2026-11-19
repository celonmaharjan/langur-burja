import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { REACTIONS, PHRASES } from '../shared/game.js';
import { useT } from './i18n.jsx';
import { sfx } from './sound.js';

export const GLYPH = { clap: '👏', fire: '🔥', laugh: '😂', cry: '😭', wow: '😮', luck: '🍀' };
const MAX_LEN = 140;

/** Reactions, quick phrases and a text box. Sending is rate-limited by the server. */
export function ChatPanel({ send, said, you }) {
  const { t } = useT();
  const [cool, setCool] = useState(false);
  const [text, setText] = useState('');
  const feed = useRef(null);
  const say = (id) => {
    if (cool) return;
    send({ t: 'say', id });
    setCool(true);
    setTimeout(() => setCool(false), 900);
  };
  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || cool) return;
    send({ t: 'chat', text: v });
    setText('');
    setCool(true);
    setTimeout(() => setCool(false), 800);
  };
  const label = (m) => (m.text ?? (GLYPH[m.id] ? GLYPH[m.id] : t(`say.${m.id}`)));
  const recent = said.slice(-30);
  const lastN = recent.length ? recent[recent.length - 1].n : 0;
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [lastN]);
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
      <ul className="feed" ref={feed} aria-live="polite">
        {recent.length === 0 && <li className="empty">{t('chat.empty')}</li>}
        {recent.map((m) => (
          <li key={m.n} className={m.from === you ? 'me' : ''}>
            <b>{m.name}</b>{m.watcher && <i className="spec"> {t('chat.spectator')}</i>} <span className={m.text ? 'msg' : ''}>{label(m)}</span>
          </li>
        ))}
      </ul>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} maxLength={MAX_LEN} onChange={(e) => setText(e.target.value)} placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} enterKeyHint="send" autoComplete="off" />
        <button className="primary" type="submit" disabled={!text.trim() || cool} aria-label={t('chat.send')}><Send size={16} /></button>
      </form>
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
    sfx.say(m.text ? 'text' : m.id);                    // every reaction has its own sound
    setTimeout(() => setLive((l) => l.filter((x) => x.n !== m.n)), m.text ? 5000 : 3500);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastN]);
  return (
    <div className="bubbles" aria-hidden="true">
      {live.map((m) => (
        <div key={m.n} className={`bubble ${GLYPH[m.id] ? 'big' : ''}`}>
          <span className="bname">{m.name}</span>
          <span>{m.text ?? GLYPH[m.id] ?? t(`say.${m.id}`)}</span>
        </div>
      ))}
    </div>
  );
}
