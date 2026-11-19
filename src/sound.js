// Sound kit. By default every sound is synthesised with WebAudio, so the game needs no audio files.
// Real recordings can replace any of them: put chip / dice / win / lose (.mp3, .ogg or .wav) in public/sounds/.
// See public/sounds/README.md.
let ctx = null;
let muted = false;
const samples = {};          // name -> decoded AudioBuffer (only for files that exist)
let loading = false;

export const setMuted = (m) => { muted = m; };

function audio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      loadSamples();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

async function loadSamples() {
  if (loading) return;
  loading = true;
  for (const name of ['chip', 'dice', 'win', 'lose']) {
    for (const ext of ['mp3', 'ogg', 'wav']) {
      try {
        const res = await fetch(`/sounds/${name}.${ext}`);
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || type.includes('text/html')) continue;        // missing file (SPA fallback) — keep the synth
        samples[name] = await ctx.decodeAudioData(await res.arrayBuffer());
        break;
      } catch { /* not a valid audio file — keep the synth */ }
    }
  }
}

function play(name, { vol = 1, delay = 0, rate = 1 } = {}) {
  const c = audio();
  const buf = samples[name];
  if (!c || muted || !buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(c.destination);
  src.start(c.currentTime + delay / 1000);
  return true;
}

function tone(freq, ms, { type = 'sine', vol = 0.05, delay = 0, to = 0 } = {}) {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime + delay / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

// One die hitting a hard surface: a sharp click (noise through a band-pass) plus a short low "thock"
// from the body of the die. Each call is slightly different so six dice never sound identical.
function knock(delay, vol = 0.12) {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime + delay / 1000;
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400 + Math.random() * 2600;
  filter.Q.value = 1.4;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  const f = 150 + Math.random() * 70;
  tone(f, 70, { vol: vol * 0.9, delay, to: f * 0.6 });
}

// A short "whoosh" as the dice leave the hand.
function whoosh(vol = 0.05) {
  const c = audio();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * 0.35);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len) * 0.5;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(500, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(2200, c.currentTime + 0.3);
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

// One short sound per reaction, so a 👏 or a 😂 can be heard as well as seen.
const LOUD = 2.6;                                  // reactions are meant to be noticed over the voice chat
const REACT_SOUNDS = {
  clap() { [0, 95, 190, 270].forEach((d) => knock(d, 0.13 * LOUD)); },
  fire() { whoosh(0.05 * LOUD); tone(280, 380, { type: 'sawtooth', vol: 0.025 * LOUD, to: 900 }); },
  laugh() { [0, 120, 240, 360].forEach((d, i) => tone(i % 2 ? 560 : 700, 90, { type: 'square', vol: 0.025 * LOUD, delay: d })); },
  cry() { tone(520, 420, { type: 'triangle', vol: 0.05 * LOUD, to: 260 }); tone(440, 520, { type: 'triangle', vol: 0.04 * LOUD, delay: 260, to: 200 }); },
  wow() { tone(260, 380, { vol: 0.05 * LOUD, to: 980 }); },
  luck() { [1046, 1318, 1568].forEach((f, i) => tone(f, 420, { vol: 0.04 * LOUD, delay: i * 110 })); },
  text() { tone(760, 70, { type: 'triangle', vol: 0.035 * LOUD, to: 1100 }); },
};

export const sfx = {
  say(id) { (REACT_SOUNDS[id] ?? REACT_SOUNDS.text)(); },
  ready() { tone(640, 70, { type: 'triangle', vol: 0.08 }); },
  allReady() { [660, 880].forEach((f, i) => tone(f, 160, { vol: 0.12, delay: i * 110 })); },
  chip() {
    if (play('chip')) return;
    tone(660, 45, { type: 'triangle', vol: 0.04 });
    knock(0, 0.06);
  },
  /**
   * The throw. `hits` is [{ at: ms, vol: 0..1 }] — the moments dice land on the felt, taken from the animation
   * so every bounce you see has a sound. Without it, a generic rattle is played.
   */
  rattle(hits) {
    if (play('dice')) return;
    whoosh();
    if (Array.isArray(hits) && hits.length) {
      hits.forEach((h) => knock(h.at + Math.random() * 15, 0.03 + 0.16 * h.vol));
      return;
    }
    for (let i = 0; i < 16; i += 1) knock(i * 70 + Math.random() * 40, 0.05 + Math.random() * 0.1);
    [1250, 1380, 1480, 1560, 1640, 1720].forEach((t) => knock(t + Math.random() * 90, 0.16));
  },
  win() {
    if (play('win')) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 180, { vol: 0.05, delay: i * 90 }));
  },
  lose() {
    if (play('lose')) return;
    [330, 262].forEach((f, i) => tone(f, 240, { type: 'triangle', vol: 0.05, delay: i * 140 }));
  },
};
