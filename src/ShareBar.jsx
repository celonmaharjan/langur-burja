import React, { useState } from 'react';
import { Image, Send, Share2 } from 'lucide-react';
import { useT } from './i18n.jsx';
import { canNativeShare, isMobile, shareLinks, shareResultImage, inviteText } from './share.js';

/** Invite buttons for the room link: the phone's own share sheet, WhatsApp, Viber, Messenger, Telegram. */
export function InviteShare({ code, title, link }) {
  const { t, lang } = useT();
  const links = shareLinks({ lang, code, title, url: link });
  const native = () => navigator.share({ title: t('app.name'), text: inviteText({ lang, code, title }), url: link }).catch(() => {});
  return (
    <div className="sharebar" aria-label={t('share.title')}>
      {canNativeShare() && <button className="ghost-btn" onClick={native}><Share2 size={15} /> {t('share.native')}</button>}
      <a className="ghost-btn wa" href={links.whatsapp} target="_blank" rel="noopener noreferrer"><Send size={15} /> {t('share.whatsapp')}</a>
      <a className="ghost-btn vb" href={links.viber}><Send size={15} /> {t('share.viber')}</a>
      {isMobile() && <a className="ghost-btn ms" href={links.messenger}><Send size={15} /> {t('share.messenger')}</a>}
      <a className="ghost-btn tg" href={links.telegram} target="_blank" rel="noopener noreferrer"><Send size={15} /> {t('share.telegram')}</a>
    </div>
  );
}

/** "Share result" button: makes a picture of the round (or tournament) and shares or downloads it. */
export function ShareResultButton({ build }) {
  const { t, lang, rs } = useT();
  const [note, setNote] = useState('');
  const go = async () => {
    const r = await shareResultImage({ lang, rs, url: location.origin + '/', ...build() });
    setNote(r === 'downloaded' ? t('share.saved') : '');
    if (r === 'downloaded') setTimeout(() => setNote(''), 5000);
  };
  return (
    <>
      <button className="ghost-btn share-result" onClick={go}><Image size={15} /> {t('share.result')}</button>
      {note && <span className="fine" role="status">{note}</span>}
    </>
  );
}
