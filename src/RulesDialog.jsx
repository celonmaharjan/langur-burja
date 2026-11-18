import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useT } from './i18n.jsx';

const NE = {
  title: 'खेलका नियम',
  items: [
    <><b>छवटा चिन्ह।</b> हरेक पासामा परम्परागत छवटा चिन्ह हुन्छन्: लंगुर (झण्डा), बुर्जा (मुकुट), पान (हर्ट), सुरत (हुकुम), ईंट (डायमण्ड) र चिडिया (चिडी)।</>,
    <><b>दाउ राख्नुहोस्।</b> चिप रोज्नुहोस् र पाटीमा कुनै पनि चिन्ह थिच्नुहोस्। जतिवटा चिन्हमा पनि दाउ राख्न सकिन्छ, र एउटैमा धेरै चिप थप्न पनि मिल्छ।</>,
    <><b>छवटा पासा फ्याँक्नुहोस्।</b> सबै छवटा पासा एकैपटक फ्याँकिन्छन्। निजी कोठामा हरेक राउन्डमा पालैपालो अर्को खेलाडीले सबैका लागि फ्याँक्छ (होस्टले चाहे यसलाई “सधैं होस्ट” मा बदल्न सक्छ)।</>,
    <><b>हिसाब।</b> तपाईंले दाउ राखेको चिन्ह देखाउने हरेक पासाले त्यो दाउमा १:१ तिर्छ — दाउ फिर्ता पाउनुहुन्छ र मिलेको पासाको संख्या बराबर दाउ जित्नुहुन्छ। नआएको चिन्हको दाउ हार्नुहुन्छ।</>,
  ],
  example: <><b>उदाहरण।</b> बुर्जामा रु 100 र पानमा रु 50। पासामा बुर्जा २ पटक आयो, पान आएन। तपाईंले रु 100 + 2 × रु 100 = रु 300 पाउनुहुन्छ र रु 50 हार्नुहुन्छ, यसरी खुद <b>+रु 150</b>।</>,
  rooms: <><b>निजी कोठा।</b> कोठा बनाउनुहोस्, ५ अक्षरको कोड वा लिङ्क साथीहरूलाई दिनुहोस् — ८ जनासम्म सामेल हुन सक्छन्, र अरूले दर्शक बनेर हेर्न पनि सक्छन्। सबैले एउटै फ्याँकाइमा दाउ राख्छन्; सर्भरले पासा फ्याँकेर हरेकको दाउ मिलाउँछ, त्यसैले नतिजामा कसैले छेडछाड गर्न सक्दैन। दाउ राख्नुअघि होस्टले कोठाका नियम तय गर्न सक्छ: भुक्तानी (हरेक पासामा वा एकपटक मात्र), प्रति चिन्ह अधिकतम दाउ, पासा फ्याँक्ने क्रम र दाउको समय (समय सकिएपछि पासा आफैं फ्याँकिन्छ)।</>,
  fine: 'यो खेलको रकम (नक्कली) मात्र हो। भुक्तानीको तरिका परिवार अनुसार फरक हुन्छ, साँचो पैसाका लागि खेल्ने भए अघि आफ्नो तरिकामा सहमत हुनुहोस्।',
};

const EN = {
  title: 'Rules',
  items: [
    <><b>Six figures.</b> Every die carries the traditional faces: Langur (flag), Burja (crown), Paan (heart), Surat (spade), Eent (diamond) and Chidiya (club).</>,
    <><b>Place bets.</b> Pick a chip and tap any figure on the board. Back as many figures as you like, and stack several chips on one.</>,
    <><b>Roll six dice.</b> All six dice are thrown together. In a private room a different player throws them for everyone each round (the host can switch this to always the host).</>,
    <><b>Settlement.</b> Each die showing a figure you backed pays 1:1 on that bet — you keep your stake and win it once per matching die. A figure that does not appear loses its stake.</>,
  ],
  example: <><b>Example.</b> Rs 100 on Burja and Rs 50 on Paan. The dice show Burja ×2 and no Paan. You collect Rs 100 + 2 × Rs 100 = Rs 300 and lose the Rs 50, so the net is <b>+Rs 150</b>.</>,
  rooms: <><b>Private rooms.</b> Create a room, share the 5-letter code or link, and up to 8 friends can join. Everyone bets on the same roll; the server throws the dice and settles each player's bets, so nobody can tamper with the result. Before bets are placed, the host can set house rules: payout (per die or once) a max stake per figure, and a betting timer that rolls the dice automatically.</>,
  fine: 'Practice play-money only. Payout scales differ between families, so agree on yours before playing for anything real.',
};

export default function RulesDialog({ onClose }) {
  const { lang } = useT();
  const c = lang === 'ne' ? NE : EN;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id="rules-title">{c.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <ol className="rules">
          {c.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
        <div className="example">{c.example}</div>
        <p className="fine">{c.rooms}</p>
        <p className="fine">{c.fine}</p>
      </div>
    </div>
  );
}
