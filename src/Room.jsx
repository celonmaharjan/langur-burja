import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, LogOut, Users, Wifi, WifiOff, Eye, ChevronDown } from 'lucide-react';
import Table from './Table.jsx';
import { ChatPanel, SayBubbles } from './Chat.jsx';
import VoicePanel from './VoicePanel.jsx';
import { InviteShare, ShareResultButton } from './ShareBar.jsx';
import { useVoice } from './voice.js';
import { RecentRolls, FaceFrequency, Standings } from './Panels.jsx';
import { CHIPS, START_BANKROLL, sumBets } from './faces.js';
import { settle, AVATARS, PAYOUTS, LIMITS, TIMERS, ROUNDS, VOICES, DEFAULT_RULES } from '../shared/game.js';
import { useRoom } from './useRoom.js';
import { useT } from './i18n.jsx';

const NAME_KEY = 'langur-burja:name';
const AVATAR_KEY = 'langur-burja:avatar';
const readAvatar = () => { try { const a = localStorage.getItem(AVATAR_KEY); return AVATARS.includes(a) ? a : AVATARS[0]; } catch { return AVATARS[0]; } };
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };

function Lobby({ room, initialCode }) {
  const { t, te } = useT();
  const [name, setName] = useState(readName);
  const [code, setCode] = useState(initialCode ?? '');
  const [avatar, setAvatar] = useState(readAvatar);
  const [title, setTitle] = useState('');
  const busy = room.status === 'connecting';
  const nameOk = name.trim().length > 0;

  const remember = () => { try { localStorage.setItem(NAME_KEY, name.trim()); localStorage.setItem(AVATAR_KEY, avatar); } catch { /* ignore */ } };
  const create = (e) => { e.preventDefault(); if (!nameOk) return; remember(); room.create(name.trim(), title.trim(), avatar); };
  const watch = () => { if (!nameOk || code.length < 5) return; remember(); room.watch(code, name.trim()); };
  const join = (e) => { e.preventDefault(); if (!nameOk || code.length < 5) return; remember(); room.join(code, name.trim(), avatar); };

  return (
    <main className="wrap narrow">
      <div className="card lobby">
        <div className="card-head"><h2>{t('lobby.title')}</h2><span className="muted">{t('lobby.sub')}</span></div>

        <label className="field">
          <span>{t('lobby.name')}</span>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder={t('lobby.namePh')} autoFocus />
        </label>

        <div className="field">
          <span>{t('lobby.avatar')}</span>
          <div className="avatars" role="radiogroup" aria-label={t('lobby.avatar')}>
            {AVATARS.map((a) => (
              <button type="button" key={a} role="radio" aria-checked={avatar === a} className={`av-pick ${avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)}>{a}</button>
            ))}
          </div>
        </div>

        {room.error && <div className="alert" role="alert">{te(room.error)}</div>}

        <div className="lobby-grid">
          <form className="lobby-box" onSubmit={create}>
            <h3>{t('lobby.createTitle')}</h3>
            <p>{t('lobby.createDesc')}</p>
            <label className="field">
              <span>{t('lobby.roomTitle')}</span>
              <input value={title} maxLength={24} onChange={(e) => setTitle(e.target.value)} placeholder={t('lobby.roomTitlePh')} />
            </label>
            <button className="primary" disabled={!nameOk || busy}>{busy ? t('lobby.connecting') : t('lobby.createBtn')}</button>
          </form>
          <form className="lobby-box" onSubmit={join}>
            <h3>{t('lobby.joinTitle')}</h3>
            <p>{t('lobby.joinDesc')}</p>
            <input
              className="code-input" value={code} maxLength={5} placeholder="ABCDE" aria-label={t('lobby.codeLabel')}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button className="primary" disabled={!nameOk || code.length < 5 || busy}>{t('lobby.joinBtn')}</button>
            <button type="button" className="ghost-btn" onClick={watch} disabled={!nameOk || code.length < 5 || busy}><Eye size={15} /> {t('lobby.watchBtn')}</button>
          </form>
        </div>
      </div>
    </main>
  );
}

function InvitePanel({ code, lan, title }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const host = local && lan[0] ? `${lan[0]}${location.port ? `:${location.port}` : ''}` : location.host;
  const link = `${location.protocol}//${host}/?room=${code}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt(t('invite.copyPrompt'), link); }
  };

  return (
    <div className="invite card">
      <div>
        {title && <div className="room-title">{title}</div>}
        <span className="muted">{t('invite.code')}</span>
        <div className="room-code" aria-label={`${t('invite.code')} ${code.split('').join(' ')}`}>{code}</div>
      </div>
      <div className="invite-link">
        <span className="muted">{t('invite.link')}</span>
        <div className="link-row">
          <code>{link}</code>
          <button className="ghost-btn" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('invite.copied') : t('invite.copy')}</button>
        </div>
        {local && !lan[0] && <span className="fine">{t('invite.noLan')}</span>}
        <InviteShare code={code} title={title} link={link} />
      </div>
    </div>
  );
}

function RulesBar({ rules, isHost, editable, fresh, send }) {
  const { t, rs } = useT();
  const limitLabel = (l) => (l ? rs(l) : t('hr.nolimit'));
  const set = (patch) => send({ t: 'rules', rules: patch });
  // Closed by default on phones so the table stays near the top.
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 700));
  const summary = [
    t(`hr.payout.${rules.payout}`),
    limitLabel(rules.limit),
    rules.rotate ? t('hr.rotate.on') : t('hr.rotate.off'),
    `${t('hr.timer')}: ${rules.timer ? t('hr.seconds', { n: rules.timer }) : t('hr.off')}`,
    `${t('hr.voice')}: ${t(`hr.voice.${rules.voice}`)}`,
    ...(rules.rounds ? [t('hr.rounds.n', { n: rules.rounds })] : []),
  ].join(' · ');
  return (
    <div className={`card houserules ${open ? 'open' : ''}`}>
      <button className="hr-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="hr-title"><b>{t('hr.title')}</b><span className="hr-summary">{summary}</span></span>
        <ChevronDown size={18} className="hr-chev" />
      </button>
      {open && <div className="muted hr-sub">{isHost ? (editable ? t('hr.hostHint') : t('hr.locked')) : t('hr.guestHint')}</div>}
      {open && <div className="hr-row">
        <div className="hr-group">
          <span className="hr-label">{t('hr.payout')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.payout')}>
            {PAYOUTS.map((p) => (
              <button key={p} role="radio" aria-checked={rules.payout === p} className={rules.payout === p ? 'on' : ''}
                disabled={!isHost || !editable} onClick={() => set({ payout: p })}>{t(`hr.payout.${p}`)}</button>
            ))}
          </div>
          <span className="hr-note">{t(`hr.payout.${rules.payout}.note`)}</span>
        </div>
        <div className="hr-group">
          <span className="hr-label">{t('hr.limit')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.limit')}>
            {LIMITS.map((l) => (
              <button key={l} role="radio" aria-checked={rules.limit === l} className={rules.limit === l ? 'on' : ''}
                disabled={!isHost || !editable} onClick={() => set({ limit: l })}>{limitLabel(l)}</button>
            ))}
          </div>
        </div>
        <div className="hr-group">
          <span className="hr-label">{t('hr.rotate')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.rotate')}>
            {[true, false].map((v) => (
              <button key={String(v)} role="radio" aria-checked={rules.rotate === v} className={rules.rotate === v ? 'on' : ''}
                disabled={!isHost || !editable} onClick={() => set({ rotate: v })}>{v ? t('hr.rotate.on') : t('hr.rotate.off')}</button>
            ))}
          </div>
          <span className="hr-note">{t('hr.rotate.note')}</span>
        </div>
        <div className="hr-group">
          <span className="hr-label">{t('hr.rounds')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.rounds')}>
            {ROUNDS.map((n) => (
              <button key={n} role="radio" aria-checked={rules.rounds === n} className={rules.rounds === n ? 'on' : ''}
                disabled={!isHost || !editable || !fresh} onClick={() => set({ rounds: n })}>{n ? t('hr.rounds.n', { n }) : t('hr.rounds.0')}</button>
            ))}
          </div>
          <span className="hr-note">{t('hr.rounds.note')}</span>
        </div>
        <div className="hr-group">
          <span className="hr-label">{t('hr.voice')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.voice')}>
            {VOICES.map((v) => (
              <button key={v} role="radio" aria-checked={rules.voice === v} className={rules.voice === v ? 'on' : ''}
                disabled={!isHost} onClick={() => set({ voice: v })}>{t(`hr.voice.${v}`)}</button>
            ))}
          </div>
          <span className="hr-note">{t('hr.voice.note')}</span>
        </div>
        <div className="hr-group">
          <span className="hr-label">{t('hr.timer')}</span>
          <div className="seg" role="radiogroup" aria-label={t('hr.timer')}>
            {TIMERS.map((n) => (
              <button key={n} role="radio" aria-checked={rules.timer === n} className={rules.timer === n ? 'on' : ''}
                disabled={!isHost || !editable} onClick={() => set({ timer: n })}>{n ? t('hr.seconds', { n }) : t('hr.off')}</button>
            ))}
          </div>
          <span className="hr-note">{t('hr.timer.note')}</span>
        </div>
      </div>}
    </div>
  );
}

/** Shown when a tournament has run its rounds: ranking by chips, share and play again. */
function TournamentFinal({ state, you, isHost, send }) {
  const { t, rs } = useT();
  const ranking = [...state.players].sort((a, b) => b.balance - a.balance).map((p) => ({ name: p.name, avatar: p.avatar, value: p.balance, id: p.id }));
  const winner = ranking[0];
  return (
    <div className="card tour-final" role="status">
      <h2>{t('tour.title')} <span className="muted">· {t('hr.rounds.n', { n: state.rules.rounds })}</span></h2>
      <p className="winner">{t('tour.winner', { name: `${winner.avatar ?? ''} ${winner.name}` })}</p>
      <ol className="standings">
        {ranking.map((r, i) => (
          <li key={r.id} className={r.id === you ? 'me' : ''}>
            <span className={`rank r${i + 1}`}>{i + 1}</span>
            <span className="sname"><span className="av">{r.avatar}</span> {r.name}</span>
            <span />
            <span className="net">{rs(r.value)}</span>
          </li>
        ))}
      </ol>
      <div className="tour-actions">
        <ShareResultButton build={() => ({ title: state.title, code: state.code, ranking, dice: [] })} />
        {isHost
          ? <button className="primary" onClick={() => send({ t: 'again' })}>{t('tour.again')}</button>
          : <span className="muted">{t('tour.waitHost')}</span>}
      </div>
    </div>
  );
}

function RoomView({ room }) {
  const { t, te, rs } = useT();
  const { state, you, send } = room;
  const [chip, setChip] = useState(50);
  const me = state.players.find((p) => p.id === you);
  const isHost = state.hostId === you;
  const rollerId = state.rollerId ?? state.hostId;
  const roller = state.players.find((p) => p.id === rollerId);
  const isRoller = rollerId === you || (isHost && roller && !roller.connected);
  const phase = state.phase;
  const rolling = phase === 'rolling';
  const totalBet = sumBets(me?.bets);
  const anyStake = state.players.some((p) => sumBets(p.bets) > 0);
  const connected = room.status === 'open';
  const voice = useVoice({ you, state, send, subscribe: room.subscribe, watcher: false, mode: state.rules?.voice ?? 'ptt' });

  // Countdown to automatic roll. The server sends "ms left" with each state; we count down locally from there.
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (state.phase !== 'betting' || state.closesIn == null) { setLeft(null); return undefined; }
    const end = performance.now() + state.closesIn;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - performance.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state]);

  const others = useMemo(() => {
    const o = {};
    state.players.forEach((p) => {
      if (p.id === you) return;
      Object.entries(p.bets).forEach(([k, v]) => { o[k] = (o[k] ?? 0) + v; });
    });
    return o;
  }, [state.players, you]);

  const result = useMemo(() => {
    if (phase !== 'result') return null;
    const counts = settle({}, state.dice, state.rules).counts;
    return me?.result ? { ...me.result, counts } : { net: 0, lines: [], counts };
  }, [phase, state.dice, me]);

  // surface server errors briefly (kept as { code, msg } so they re-translate if the language changes)
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!room.error) return undefined;
    setToast(room.error);
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [room.error]);

  const tour = state.rules?.rounds ?? 0;
  const roundLabel = tour ? t('tour.round', { n: state.round, total: tour }) : undefined;
  let rollLabel; let rollDisabled; let onRoll;
  if (phase === 'final') { rollLabel = t('tour.title'); rollDisabled = true; onRoll = () => {}; }
  else if (phase === 'rolling') { rollLabel = t('roll.rolling'); rollDisabled = true; onRoll = () => {}; }
  else if (phase === 'result') {
    rollLabel = isRoller ? t('roll.next') : t('roll.wait', { name: roller?.name ?? '' });
    rollDisabled = !isRoller || !connected;
    onRoll = () => send({ t: 'next' });
  } else {
    rollLabel = isRoller ? t('roll.go') : t('roll.theyRoll', { name: roller?.name ?? '' });
    rollDisabled = !isRoller || !anyStake || !connected;
    onRoll = () => send({ t: 'roll' });
  }

  const hint = toast
    ? te(toast)
    : !connected ? t('lobby.reconnecting')
      : phase !== 'betting' ? ''
        : isRoller
          ? (anyStake ? t('room.hintHostReady') : t('room.hintHostWait'))
          : (totalBet > 0 ? t('room.hintReady') : t('solo.hintIdle'));

  const history = state.history.map((h) => ({ id: `${h.round}`, dice: h.dice, round: h.round, top: h.results?.[0] }));
  const broke = connected && phase === 'betting' && totalBet === 0 && me.balance < CHIPS[0] && !tour;

  return (
    <main className="wrap">
      <SayBubbles said={room.said} you={you} />
      <InvitePanel code={state.code} lan={room.lan} title={state.title} />
      <RulesBar rules={state.rules ?? DEFAULT_RULES} isHost={isHost} editable={connected && phase === 'betting' && !anyStake} fresh={state.history.length === 0} send={send} />

      {phase === 'final' && <TournamentFinal state={state} you={you} isHost={isHost} send={send} />}

      <Table
        dice={state.dice} rollId={state.rollId} rolling={rolling} result={result} hint={hint}
        bets={me.bets} others={others} balance={me.balance} round={state.round} countdown={left} roundLabel={roundLabel} shareCtx={{ title: state.title, code: state.code }}
        chip={chip} setChip={setChip} locked={phase !== 'betting' || !connected}
        onPlace={(face) => send({ t: 'bet', face, amount: chip })}
        onUndo={() => send({ t: 'undo' })} onClear={() => send({ t: 'clear' })} onRebet={() => send({ t: 'rebet' })}
        onRoll={onRoll} rollLabel={rollLabel} rollDisabled={rollDisabled}
        canUndo={connected && phase === 'betting' && totalBet > 0}
        canClear={connected && phase === 'betting' && totalBet > 0}
        canRebet={connected && phase === 'betting' && totalBet === 0 && me.hasLast}
      >
        {broke && (
          <div className="broke">
            {t('solo.broke')}{' '}
            <button className="link" onClick={() => send({ t: 'rebuy' })}>{t('solo.restart', { amt: rs(START_BANKROLL) })}</button>
          </div>
        )}
      </Table>

      <section className="side-grid">
        <div className="card">
          <div className="card-head">
            <h2><Users size={16} className="inline" /> {t('room.players')}</h2>
            <span className="muted">
              {state.players.length}/8{state.watchers > 0 && <> · <Eye size={12} className="inline" /> {t('watch.count', { n: state.watchers })}</>} · {connected
                ? <><Wifi size={12} className="inline" /> {t('room.live')}</>
                : <><WifiOff size={12} className="inline" /> {t('room.reconnecting')}</>}
            </span>
          </div>
          <ul className="players">
            {state.players.map((p) => {
              const staked = sumBets(p.bets);
              return (
                <li key={p.id} className={p.id === you ? 'me' : ''}>
                  <span className={`dot ${p.connected ? 'on' : ''}`} />
                  <span className="pname">
                    <span className="av">{p.avatar}</span> {p.name}
                    {p.id === state.hostId && <em className="tag host">{t('room.host')}</em>}
                    {p.id === rollerId && <em className="tag roller">{t('room.roller')}</em>}
                    {p.id === you && <em className="tag">{t('room.you')}</em>}
                  </span>
                  <span className="pnum">
                    <b>{rs(p.balance)}</b>
                    <small>
                      {phase === 'result' && p.result
                        ? <span className={p.result.net >= 0 ? 'up' : 'down'}>{p.result.net >= 0 ? '+' : '−'}{rs(Math.abs(p.result.net))}</span>
                        : staked > 0 ? t('room.bet', { amt: rs(staked) }) : '—'}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="room-actions">
            <button className="ghost-btn" onClick={room.leave}><LogOut size={15} /> {t('room.leave')}</button>
          </div>
        </div>
        <div className="stack">
          <Standings players={state.players} you={you} />
          <VoicePanel voice={voice} mode={state.rules?.voice ?? 'ptt'} you={you} watcher={false} />
          <ChatPanel send={send} said={room.said} you={you} />
          <RecentRolls items={history} />
          <FaceFrequency items={history} />
        </div>
      </section>
    </main>
  );
}

function WatchView({ room }) {
  const { t, rs } = useT();
  const { state, you, send } = room;
  const phase = state.phase;
  const rolling = phase === 'rolling';
  const connected = room.status === 'open';
  const voice = useVoice({ you, state, send, subscribe: room.subscribe, watcher: true, mode: state.rules?.voice ?? 'ptt' });
  const roller = state.players.find((p) => p.id === (state.rollerId ?? state.hostId));

  const totals = useMemo(() => {
    const o = {};
    state.players.forEach((p) => Object.entries(p.bets).forEach(([k, v]) => { o[k] = (o[k] ?? 0) + v; }));
    return o;
  }, [state.players]);

  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (phase !== 'betting' || state.closesIn == null) { setLeft(null); return undefined; }
    const end = performance.now() + state.closesIn;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - performance.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state]);

  const hint = !connected ? t('lobby.reconnecting')
    : phase === 'betting' ? t('watch.betting', { name: roller?.name ?? '' }) : '';
  const history = state.history.map((h) => ({ id: `${h.round}`, dice: h.dice, round: h.round, top: h.results?.[0] }));

  return (
    <main className="wrap">
      <SayBubbles said={room.said} you={you} />
      <div className="card watch-banner" role="status">
        <Eye size={18} />
        <div>
          <b>{t('watch.title', { code: state.code })}</b>
          <span className="muted">{t('watch.sub')}</span>
        </div>
        <button className="ghost-btn" onClick={room.leave}><LogOut size={15} /> {t('room.leave')}</button>
      </div>

      {state.phase === 'final' && <TournamentFinal state={state} you={you} isHost={false} send={send} />}

      <Table
        watching dice={state.dice} rollId={state.rollId} rolling={rolling} result={null} hint={hint}
        bets={{}} others={totals} balance={0} round={state.round} countdown={left}
        roundLabel={state.rules?.rounds ? t('tour.round', { n: state.round, total: state.rules.rounds }) : undefined} shareCtx={{ title: state.title, code: state.code }}
        chip={0} setChip={() => {}} locked
        onPlace={() => {}} onUndo={() => {}} onClear={() => {}} onRebet={() => {}} onRoll={() => {}}
        rollLabel="" rollDisabled canUndo={false} canClear={false} canRebet={false}
      />

      <section className="side-grid">
        <div className="card">
          <div className="card-head">
            <h2><Users size={16} className="inline" /> {t('room.players')}</h2>
            <span className="muted">{state.players.length}/8 · {t('watch.count', { n: state.watchers })}</span>
          </div>
          <ul className="players">
            {state.players.map((p) => (
              <li key={p.id}>
                <span className={`dot ${p.connected ? 'on' : ''}`} />
                <span className="pname">
                  <span className="av">{p.avatar}</span> {p.name}
                  {p.id === state.hostId && <em className="tag host">{t('room.host')}</em>}
                  {p.id === (state.rollerId ?? state.hostId) && <em className="tag roller">{t('room.roller')}</em>}
                </span>
                <span className="pbal">{t('watch.bet', { amt: rs(sumBets(p.bets)) })}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="stack">
          <Standings players={state.players} you={null} />
          <VoicePanel voice={voice} mode={state.rules?.voice ?? 'ptt'} you={you} watcher />
          <ChatPanel send={send} said={room.said} you={you} />
          <RecentRolls items={history} />
          <FaceFrequency items={history} />
        </div>
      </section>
    </main>
  );
}

export default function Room({ initialCode }) {
  const { t } = useT();
  const room = useRoom();
  if (room.state && room.you) return room.role === 'watcher' ? <WatchView room={room} /> : <RoomView room={room} />;
  if (room.status === 'reconnecting' || (room.status === 'connecting' && !room.state && !room.error)) {
    return (
      <main className="wrap narrow">
        <div className="card lobby">
          <p className="empty">{room.status === 'reconnecting' ? t('lobby.reconnecting') : t('lobby.connecting')}</p>
        </div>
      </main>
    );
  }
  return <Lobby room={room} initialCode={initialCode} />;
}
