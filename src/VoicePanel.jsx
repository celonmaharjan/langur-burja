import React from 'react';
import { Headphones, LogOut, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useT } from './i18n.jsx';

/** Voice chat card. `voice` is the object returned by useVoice(); `mode` is the room rule: 'off' | 'ptt' | 'open'. */
export default function VoicePanel({ voice, mode, you, watcher }) {
  const { t } = useT();
  if (mode === 'off') return null;
  const { joined, micOn, error, speaking, muted, roster } = voice;

  const hold = {
    onPointerDown: (e) => { e.preventDefault(); voice.setMic(true); },
    onPointerUp: () => voice.setMic(false),
    onPointerLeave: () => { if (micOn) voice.setMic(false); },
    onPointerCancel: () => voice.setMic(false),
    onContextMenu: (e) => e.preventDefault(),
  };

  return (
    <div className="card voice">
      <div className="card-head">
        <h2><Headphones size={16} className="inline" /> {t('voice.title')}</h2>
        <span className="muted">{t('voice.count', { n: roster.length })}</span>
      </div>

      {!joined ? (
        <>
          <p className="fine">{watcher ? t('voice.listenOnly') : t('voice.sub')} {t('voice.tip')}</p>
          <button className="primary voice-join" onClick={voice.join}><Headphones size={16} /> {t('voice.join')}</button>
        </>
      ) : (
        <div className="voice-controls">
          {watcher ? (
            <span className="tag">{t('voice.listenOnly')}</span>
          ) : mode === 'ptt' ? (
            <button className={`mic-btn ${micOn ? 'live' : ''}`} {...hold} aria-pressed={micOn}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />} {t('voice.hold')} <kbd>V</kbd>
            </button>
          ) : (
            <button className={`mic-btn ${micOn ? 'live' : ''}`} onClick={() => voice.setMic(!micOn)} aria-pressed={micOn}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />} {micOn ? t('voice.micOn') : t('voice.micOff')}
            </button>
          )}
          <button className="ghost-btn" onClick={voice.leave}><LogOut size={15} /> {t('voice.leave')}</button>
        </div>
      )}

      {error && <div className="alert" role="alert">{t(`voice.err.${error}`)}</div>}

      <ul className="voice-list">
        {roster.length === 0 && <li className="empty">{t('voice.nobody')}</li>}
        {roster.map((r) => (
          <li key={r.id} className={speaking[r.id] ? 'speaking' : ''}>
            <span className="vdot" aria-hidden />
            <span className="vname">{r.name}{r.id === you && <em className="tag">{t('room.you')}</em>}{r.watcher && <em className="tag">{t('voice.listener')}</em>}</span>
            {r.id !== you && joined && (
              <button className="icon-btn" onClick={() => voice.toggleMuted(r.id)} aria-label={muted[r.id] ? t('voice.unmuteThem') : t('voice.muteThem')} title={muted[r.id] ? t('voice.unmuteThem') : t('voice.muteThem')}>
                {muted[r.id] ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
