import React, { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { THEMES } from './theme.js';
import { useT } from './i18n.jsx';

export default function ThemeMenu({ theme, setTheme }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="theme-wrap" ref={box}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={t('theme.title')} aria-expanded={open} title={t('theme.title')}>
        <Palette size={18} />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((th) => (
            <button key={th.id} role="menuitemradio" aria-checked={theme === th.id} className={theme === th.id ? 'on' : ''}
              onClick={() => { setTheme(th.id); setOpen(false); }}>
              <span className="swatch" style={{ background: `linear-gradient(135deg, ${th.swatch[0]} 55%, ${th.swatch[1]} 55%)` }} />
              {lang === 'ne' ? th.ne : th.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
