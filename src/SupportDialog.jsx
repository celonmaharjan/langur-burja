import React, { useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import { useT } from './i18n.jsx';

/** "Support the developer": optional, never blocks play. The QR image lives in public/support-qr.jpg. */
export default function SupportDialog({ onClose }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog support" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id="support-title"><Heart size={18} className="inline" /> {t('support.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="support-text">{t('support.text')}</p>
        <img className="support-qr" src="/support-qr.jpg" alt={t('support.qrAlt')} width="300" />
        <p className="fine">{t('support.how')}</p>
        <p className="fine">{t('support.free')}</p>
      </div>
    </div>
  );
}
