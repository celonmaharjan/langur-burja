import { useCallback, useEffect, useRef, useState } from 'react';

// Free public STUN servers let two browsers find a direct route to each other. Strict networks that block
// direct calls would need a TURN relay (not included, it costs money).
const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const SPEAK_LEVEL = 0.035;   // RMS of the signal above which someone counts as speaking

export const voiceSupported = () => typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia;

/**
 * Voice chat for a room. Audio travels directly between browsers (WebRTC); the room server only keeps the roster
 * (`state.voice`) and relays call-setup messages. Everyone in the call is connected to everyone else (a mesh), which is
 * fine for the room limit of 8. Spectators only listen: they never ask for the microphone.
 */
export function useVoice({ you, state, send, subscribe, watcher, mode }) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState(null);       // 'denied' | 'missing' | 'insecure' | 'unsupported'
  const [speaking, setSpeaking] = useState({});   // person id -> true while talking
  const [muted, setMuted] = useState({});         // person id -> true when muted just for me

  const peers = useRef(new Map());                // id -> { pc, sender, audio, analyser, data, pending }
  const mic = useRef({ stream: null, track: null, analyser: null, data: null });
  const joinedRef = useRef(false);
  const inRoster = useRef(false);
  const mutedRef = useRef({});
  const audioCtx = useRef(null);
  const sendRef = useRef(send);
  sendRef.current = send;
  mutedRef.current = muted;

  const roster = state.voice ?? [];

  // diagnostic used by the browser test and for troubleshooting: window.__langurVoice()
  if (typeof window !== 'undefined') {
    window.__langurVoice = () => [...peers.current].map(([id, p]) => ({ id, conn: p.pc.connectionState, ice: p.pc.iceConnectionState, signalling: p.pc.signalingState, hasAudio: !!p.analyser, level: Number(level(p).toFixed(3)) }));
  }

  const analyserFor = (stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx.current ??= new Ctx();
      const a = audioCtx.current.createAnalyser();
      a.fftSize = 512;
      audioCtx.current.createMediaStreamSource(stream).connect(a);
      return { analyser: a, data: new Uint8Array(a.fftSize) };
    } catch { return null; }
  };

  const level = (x) => {
    if (!x?.analyser) return 0;       // no audio from this person yet
    x.analyser.getByteTimeDomainData(x.data);
    let sum = 0;
    for (const v of x.data) { const d = (v - 128) / 128; sum += d * d; }
    return Math.sqrt(sum / x.data.length);
  };

  // ── one connection to one other person ──
  const closePeer = useCallback((id) => {
    const p = peers.current.get(id);
    if (!p) return;
    peers.current.delete(id);
    try { p.audio.srcObject = null; p.pc.close(); } catch { /* already closed */ }
  }, []);

  // The caller creates the audio channel; the person being called adopts it once the offer arrives (a channel the
  // answerer creates on its own would not be matched to the offer, and one direction of audio would be silent).
  const useChannel = useCallback((p, transceiver) => {
    transceiver.direction = 'sendrecv';                 // lets the mic be attached later without renegotiating
    p.sender = transceiver.sender;
    if (mic.current.track && !watcher) p.sender.replaceTrack(mic.current.track).catch(() => {});
  }, [watcher]);

  const ensurePeer = useCallback((id, caller = false) => {
    let p = peers.current.get(id);
    if (p) return p;
    const pc = new RTCPeerConnection(ICE);
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = !!mutedRef.current[id];
    p = { pc, sender: null, audio, analyser: null, data: null, pending: [] };
    peers.current.set(id, p);
    if (caller) useChannel(p, pc.addTransceiver('audio', { direction: 'sendrecv' }));
    pc.onicecandidate = (e) => { if (e.candidate) sendRef.current({ t: 'rtc', to: id, data: { ice: e.candidate } }); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      audio.srcObject = stream;
      audio.play().catch(() => {});
      Object.assign(p, analyserFor(stream) ?? {});
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') closePeer(id); };
    return p;
  }, [closePeer, useChannel]);

  const call = useCallback(async (id) => {
    const p = ensurePeer(id, true);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    sendRef.current({ t: 'rtc', to: id, data: { sdp: p.pc.localDescription } });
  }, [ensurePeer]);

  // ── call-setup messages from the server ──
  useEffect(() => subscribe(async (msg) => {
    if (!joinedRef.current) return;
    try {
      if (msg.t === 'voicepeers') {
        for (const id of msg.peers) await call(id);        // the newcomer calls everyone already there
        return;
      }
      const { from, data } = msg;
      if (!data) return;
      if (data.sdp) {
        const p = ensurePeer(from, false);
        await p.pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') useChannel(p, p.pc.getTransceivers()[0]);
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        if (data.sdp.type === 'offer') {
          const answer = await p.pc.createAnswer();
          await p.pc.setLocalDescription(answer);
          sendRef.current({ t: 'rtc', to: from, data: { sdp: p.pc.localDescription } });
        }
      } else if (data.ice) {
        const p = ensurePeer(from);
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.ice).catch(() => {});
        else p.pending.push(data.ice);
      }
    } catch { /* a failed call attempt only affects that one person */ }
  }), [subscribe, call, ensurePeer, useChannel]);

  // ── leaving ──
  const teardown = useCallback(() => {
    for (const id of [...peers.current.keys()]) closePeer(id);
    mic.current.stream?.getTracks().forEach((t) => t.stop());
    mic.current = { stream: null, track: null, analyser: null, data: null };
    joinedRef.current = false;
    inRoster.current = false;
    setJoined(false);
    setMicOn(false);
    setSpeaking({});
  }, [closePeer]);

  const leave = useCallback(() => {
    sendRef.current({ t: 'voice', on: false });
    teardown();
  }, [teardown]);

  const join = useCallback(() => {
    if (!window.isSecureContext) { setError('insecure'); return; }
    if (!voiceSupported()) { setError('unsupported'); return; }
    setError(null);
    joinedRef.current = true;
    setJoined(true);
    // Safari only lets audio start inside a click, so the audio context is created and resumed here.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx.current ??= new Ctx();
      audioCtx.current.resume?.();
    } catch { /* speaking indicators just won't show */ }
    sendRef.current({ t: 'voice', on: true });
  }, []);

  // ── microphone ──
  const setMic = useCallback(async (on) => {
    if (watcher || !joinedRef.current) return;
    if (on && !mic.current.track) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        mic.current = { stream, track: stream.getAudioTracks()[0], ...(analyserFor(stream) ?? {}) };
        for (const p of peers.current.values()) p.sender?.replaceTrack(mic.current.track).catch(() => {});
      } catch (err) {
        setError(err?.name === 'NotFoundError' ? 'missing' : 'denied');
        return;
      }
    }
    if (mic.current.track) mic.current.track.enabled = on;
    setMicOn(on);
    if (on) setError(null);
  }, [watcher]);

  // Push-to-talk can also be held with the V key.
  useEffect(() => {
    if (!joined || watcher || mode !== 'ptt') return undefined;
    const typing = (e) => ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
    const down = (e) => { if (e.code === 'KeyV' && !e.repeat && !typing(e) && !e.ctrlKey && !e.metaKey) setMic(true); };
    const up = (e) => { if (e.code === 'KeyV') setMic(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [joined, watcher, mode, setMic]);

  // switching the room to push-to-talk closes an open mic
  useEffect(() => { if (mode === 'ptt' && mic.current.track) setMic(false); }, [mode, setMic]);

  // ── follow the roster the server keeps ──
  useEffect(() => {
    const ids = new Set(roster.map((r) => r.id));
    const present = ids.has(you);
    if (joinedRef.current) {
      if (present) inRoster.current = true;
      else if (inRoster.current) teardown();               // dropped by the server (voice switched off, reconnect…)
      for (const id of [...peers.current.keys()]) if (!ids.has(id)) closePeer(id);
    }
  }, [roster, you, teardown, closePeer]);

  // ── who is speaking ──
  useEffect(() => {
    if (!joined) return undefined;
    const timer = setInterval(() => {
      const next = {};
      for (const [id, p] of peers.current) if (!mutedRef.current[id] && level(p) > SPEAK_LEVEL) next[id] = true;
      if (micOn && level(mic.current) > SPEAK_LEVEL) next[you] = true;
      setSpeaking((prev) => {
        const a = Object.keys(prev).sort().join();
        const b = Object.keys(next).sort().join();
        return a === b ? prev : next;
      });
    }, 150);
    return () => clearInterval(timer);
  }, [joined, micOn, you]);

  const toggleMuted = useCallback((id) => {
    setMuted((m) => {
      const next = { ...m, [id]: !m[id] };
      const p = peers.current.get(id);
      if (p) p.audio.muted = !!next[id];
      return next;
    });
  }, []);

  // leaving the room (or closing the tab) ends the call
  useEffect(() => () => {
    if (joinedRef.current) sendRef.current({ t: 'voice', on: false });
    for (const id of [...peers.current.keys()]) closePeer(id);
    mic.current.stream?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close?.().catch(() => {});
  }, [closePeer]);

  return { joined, micOn, error, speaking, muted, roster, join, leave, setMic, toggleMuted };
}
