import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, ChevronLeft, Dices, Download, Languages, Share, Users, Volume2, VolumeX } from 'lucide-react';
import FaceIcon from './FaceIcon.jsx';
import Solo from './Solo.jsx';
import Room from './Room.jsx';
import RulesDialog from './RulesDialog.jsx';
import { FACES } from './faces.js';
import { LangProvider, useT } from './i18n.jsx';
import { setMuted } from './sound.js';
import { useInstall, useWakeLock } from './pwa.js';
import './styles.css';

/**
 * Langur Burja (लंगुर बुर्जा) — the traditional Nepali dice game played at Dashain and Tihar.
 * Practice play-money only. See shared/game.js for the rules implemented.
 * The interface is available in Nepali and English (src/i18n.jsx).
 */
const params = new URLSearchParams(location.search);
const inviteCode = (params.get('room') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const hasSession = (() => { try { return !!sessionStorage.getItem('langur-burja:session'); } catch { return false; } })();

function Home({ onPick }) {
  const { t } = useT();
  const { canInstall, install, ios } = useInstall();
  return (
    <main className="wrap narrow">
      <section className="hero">
        <div className="hero-faces" aria-hidden>
          {FACES.map((f) => <span key={f.key} style={{ color: f.tone }}><FaceIcon face={f} size={30} /></span>)}
        </div>
        <h1>{t('app.name')}</h1>
        <p>{t('home.blurb')}</p>
      </section>
      <div className="mode-grid">
        <button className="mode card" onClick={() => onPick('solo')}>
          <Dices size={26} />
          <h2>{t('home.solo.title')}</h2>
          <p>{t('home.solo.desc')}</p>
        </button>
        <button className="mode card" onClick={() => onPick('room')}>
          <Users size={26} />
          <h2>{t('home.room.title')}</h2>
          <p>{t('home.room.desc')}</p>
        </button>
      </div>
      {canInstall && (
        <button className="install" onClick={install}><Download size={16} /> {t('pwa.install')}</button>
      )}
      {!canInstall && ios && <p className="install-hint"><Share size={14} /> {t('pwa.ios')}</p>}
    </main>
  );
}

function App() {
  const { t, toggle } = useT();
  const [mode, setMode] = useState(inviteCode || hasSession ? 'room' : 'home');
  const [sound, setSound] = useState(true);
  const [rules, setRules] = useState(false);

  useEffect(() => { setMuted(!sound); }, [sound]);
  useWakeLock(mode !== 'home');

  const sub = mode === 'room' ? t('app.sub.room') : mode === 'solo' ? t('app.sub.solo') : t('app.tag');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {mode !== 'home' && (
            <button className="icon-btn" onClick={() => setMode('home')} aria-label={t('nav.back')}><ChevronLeft size={20} /></button>
          )}
          <span className="brand-mark" aria-hidden><FaceIcon face="burja" size={22} /></span>
          <div>
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-sub">{sub}</div>
          </div>
        </div>
        <div className="top-right">
          <button className="ghost-btn lang-btn" onClick={toggle} aria-label={t('nav.langLabel')} title={t('nav.langLabel')}>
            <Languages size={16} /> <span>{t('nav.lang')}</span>
          </button>
          <button className="icon-btn" onClick={() => setSound((s) => !s)} aria-label={sound ? t('nav.mute') : t('nav.unmute')}>
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="ghost-btn" onClick={() => setRules(true)}><BookOpen size={16} /> <span>{t('nav.rules')}</span></button>
        </div>
      </header>

      {mode === 'home' && <Home onPick={setMode} />}
      {mode === 'solo' && <Solo />}
      {mode === 'room' && <Room initialCode={inviteCode} />}

      <footer className="foot">{t('foot')}</footer>
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<LangProvider><App /></LangProvider>);
