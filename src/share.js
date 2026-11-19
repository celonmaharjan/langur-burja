import { FACE_BY_KEY } from './faces.js';

// ───────── invite messages and links ─────────
export function inviteText({ lang, code, title }) {
  const room = title ? `${title} (${code})` : code;
  return lang === 'ne'
    ? `🎲 लंगुर बुर्जा खेल्न आउनुहोस्! कोठा: ${room}`
    : `🎲 Come play Langur Burja with me! Room: ${room}`;
}

export function shareLinks({ lang, code, title, url }) {
  const text = inviteText({ lang, code, title });
  const both = encodeURIComponent(`${text}\n${url}`);
  return {
    whatsapp: `https://wa.me/?text=${both}`,
    viber: `viber://forward?text=${both}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    messenger: `fb-messenger://share/?link=${encodeURIComponent(url)}`,
  };
}

export const isMobile = () => typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// ───────── the shareable result picture ─────────
const W = 1080;
const H = 1350;

function css(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Each figure is drawn with simple shapes, so the picture needs no icon fonts.
function drawFigure(ctx, key, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.translate(cx, cy);
  const u = size / 100;
  ctx.scale(u, u);
  if (key === 'langur') {                       // flag
    ctx.fillRect(-26, -40, 8, 80);
    ctx.beginPath(); ctx.moveTo(-18, -40); ctx.lineTo(34, -26); ctx.lineTo(-18, -4); ctx.closePath(); ctx.fill();
  } else if (key === 'burja') {                 // crown
    ctx.beginPath();
    ctx.moveTo(-40, 24); ctx.lineTo(-46, -22); ctx.lineTo(-22, -2); ctx.lineTo(0, -34); ctx.lineTo(22, -2); ctx.lineTo(46, -22); ctx.lineTo(40, 24);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-40, 32, 80, 10);
  } else if (key === 'paan') {                  // heart
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.bezierCurveTo(-60, -4, -40, -44, -12, -30);
    ctx.bezierCurveTo(-4, -26, 0, -20, 0, -14);
    ctx.bezierCurveTo(0, -20, 4, -26, 12, -30);
    ctx.bezierCurveTo(40, -44, 60, -4, 0, 36);
    ctx.fill();
  } else if (key === 'surat') {                 // spade
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.bezierCurveTo(-60, 4, -44, 38, -14, 22);
    ctx.lineTo(-8, 22); ctx.lineTo(-16, 44); ctx.lineTo(16, 44); ctx.lineTo(8, 22); ctx.lineTo(14, 22);
    ctx.bezierCurveTo(44, 38, 60, 4, 0, -42);
    ctx.fill();
  } else if (key === 'eent') {                  // diamond
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(34, 0); ctx.lineTo(0, 44); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill();
  } else {                                      // club
    for (const [x, y] of [[0, -22], [-22, 10], [22, 10]]) { ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-14, 44); ctx.lineTo(14, 44); ctx.lineTo(5, 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws the picture. Either a round result (dice + net) or a tournament result (ranking).
 *   opts: { lang, rs, title, code, dice?, net?, round?, ranking?: [{ name, avatar, value }], url }
 */
export function drawResult(canvas, opts) {
  const { lang, rs, title, code, dice, net, round, ranking, url } = opts;
  const ne = lang === 'ne';
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const gold = css('--gold', '#e3b95a');
  const gold2 = css('--gold-2', '#f6d98a');
  const felt = css('--felt', '#0f3d30');
  const feltHi = css('--felt-hi', '#17614c');
  const bg = css('--bg', '#0b1512');

  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 520, 80, W / 2, 620, 900);
  g.addColorStop(0, feltHi); g.addColorStop(1, felt);
  ctx.fillStyle = g; roundRect(ctx, 40, 40, W - 80, H - 80, 48); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = gold; ctx.globalAlpha = 0.55; roundRect(ctx, 40, 40, W - 80, H - 80, 48); ctx.stroke(); ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = gold2;
  ctx.font = '700 84px "Noto Sans Devanagari", "Mukta", system-ui, sans-serif';
  ctx.fillText('लंगुर बुर्जा', W / 2, 190);
  ctx.fillStyle = '#ffffffcc';
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.fillText('LANGUR BURJA', W / 2, 250);
  if (title) {
    ctx.fillStyle = gold;
    ctx.font = '600 42px "Noto Sans Devanagari", system-ui, sans-serif';
    ctx.fillText(title, W / 2, 322);
  }

  if (ranking) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 60px "Noto Sans Devanagari", system-ui, sans-serif';
    ctx.fillText(ne ? '🏆 टुर्नामेन्ट सकियो' : '🏆 Tournament finished', W / 2, 430);
    const rows = ranking.slice(0, 5);
    rows.forEach((r, i) => {
      const y = 500 + i * 128;
      ctx.fillStyle = i === 0 ? gold : 'rgba(0,0,0,.32)';
      roundRect(ctx, 120, y, W - 240, 108, 26); ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? '#1b1305' : '#fff';
      ctx.font = '700 48px system-ui, sans-serif';
      ctx.fillText(`${i + 1}`, 156, y + 70);
      ctx.font = '600 46px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(`${r.avatar ?? ''} ${r.name}`, 230, y + 70);
      ctx.textAlign = 'right';
      ctx.font = '700 46px system-ui, sans-serif';
      ctx.fillText(rs(r.value), W - 156, y + 70);
      ctx.textAlign = 'center';
    });
  } else {
    // dice row
    const size = 124; const gap = 30;
    const total = 6 * size + 5 * gap;
    dice.slice(0, 6).forEach((d, i) => {
      const x = (W - total) / 2 + i * (size + gap);
      const y = title ? 400 : 360;
      ctx.fillStyle = '#f7f0df'; roundRect(ctx, x, y, size, size, 24); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#00000022'; ctx.stroke();
      drawFigure(ctx, d, x + size / 2, y + size / 2, size * 0.62, FACE_BY_KEY[d].ink);
    });
    const counts = {};
    dice.forEach((d) => { counts[d] = (counts[d] ?? 0) + 1; });
    const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '600 40px "Noto Sans Devanagari", system-ui, sans-serif';
    ctx.fillText(parts.map(([k, n]) => `${ne ? FACE_BY_KEY[k].nepali : FACE_BY_KEY[k].english} ×${n}`).join('   '), W / 2, (title ? 400 : 360) + size + 90);

    if (net !== undefined) {
      const win = net > 0;
      ctx.fillStyle = win ? '#4cc38a' : net < 0 ? '#ff6b6b' : '#ffffffcc';
      ctx.font = '800 150px system-ui, sans-serif';
      ctx.fillText(`${win ? '+' : net < 0 ? '−' : ''}${rs(Math.abs(net))}`, W / 2, 900);
      ctx.fillStyle = '#fff';
      ctx.font = '700 64px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(win ? (ne ? '🎉 जित!' : '🎉 I won!') : net < 0 ? (ne ? 'यो पटक हारियो' : 'Lost this one') : (ne ? 'बराबर' : 'Even'), W / 2, 1000);
      if (round) {
        ctx.fillStyle = '#ffffff99';
        ctx.font = '500 38px system-ui, sans-serif';
        ctx.fillText(ne ? `राउन्ड ${round}` : `Round ${round}`, W / 2, 1066);
      }
    }
  }

  ctx.fillStyle = gold2;
  ctx.font = '600 44px "Noto Sans Devanagari", system-ui, sans-serif';
  ctx.fillText(ne ? 'परिवारसँग जहाँबाट पनि खेल्नुहोस्' : 'Play with your family from anywhere', W / 2, 1180);
  ctx.fillStyle = '#ffffffdd';
  ctx.font = '600 40px system-ui, sans-serif';
  ctx.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1240);
  if (code) { ctx.fillStyle = '#ffffff99'; ctx.font = '500 34px system-ui, sans-serif'; ctx.fillText(`${ne ? 'कोठा' : 'Room'} ${code}`, W / 2, 1290); }
}

/** Shares the picture (Web Share with a file where supported), or downloads it. Returns 'shared' | 'downloaded' | 'cancelled'. */
export async function shareResultImage(opts) {
  const canvas = document.createElement('canvas');
  drawResult(canvas, opts);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return 'cancelled';
  const file = new File([blob], 'langur-burja.png', { type: 'image/png' });
  const text = `${opts.title ? `${opts.title} · ` : ''}${opts.url}`;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'langur-burja.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
