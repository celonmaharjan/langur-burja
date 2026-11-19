import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'langur-burja:session';
const readSession = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } };
const writeSession = (s) => {
  try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};

/**
 * Connection to the room server. Keeps a seat token in sessionStorage so a refresh or a
 * dropped Wi‑Fi connection resumes the same seat instead of leaving the room.
 */
export function useRoom() {
  const [status, setStatus] = useState('idle'); // idle | connecting | open | reconnecting
  const [state, setState] = useState(null);
  const [you, setYou] = useState(null);
  const [role, setRole] = useState('player');   // 'player' | 'watcher'
  const [lan, setLan] = useState([]);
  const [said, setSaid] = useState([]);   // recent quick-chat messages, newest last
  const [error, setError] = useState(null); // { code, msg } — translated by the UI

  const wsRef = useRef(null);
  const firstMsg = useRef(null);
  const want = useRef(false);
  const retry = useRef(0);
  const timer = useRef(null);
  const joined = useRef(false); // true once the server has seated us
  const listeners = useRef(new Set()); // raw-message subscribers (voice call setup)

  const reset = useCallback(() => {
    want.current = false;
    joined.current = false;
    writeSession(null);
    setState(null);
    setSaid([]);
    setYou(null);
    setStatus('idle');
  }, []);

  const connect = useCallback(() => {
    clearTimeout(timer.current);
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      retry.current = 0;
      const first = firstMsg.current;
      firstMsg.current = null;
      const session = readSession();
      if (first) ws.send(JSON.stringify(first));
      else if (session) ws.send(JSON.stringify({ t: 'resume', ...session }));
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') {
        joined.current = true;
        writeSession({ code: msg.code, token: msg.token });
        setYou(msg.you);
        setRole(msg.role === 'watcher' ? 'watcher' : 'player');
        setLan(msg.lan ?? []);
        setStatus('open');
        setError(null);
      } else if (msg.t === 'rtc' || msg.t === 'voicepeers') {
        listeners.current.forEach((fn) => fn(msg));
      } else if (msg.t === 'say') {
        setSaid((list) => [...list.slice(-19), { n: msg.n, from: msg.from, name: msg.name, id: msg.id, at: Date.now() }]);
      } else if (msg.t === 'state') {
        setState(msg.state);
      } else if (msg.t === 'error') {
        const err = { code: msg.code, msg: msg.msg };
        setError(err);
        if (msg.fatal) { reset(); setError(err); ws.close(); }
        else if (!joined.current) {           // e.g. wrong room code: back to the lobby
          want.current = false;
          setStatus('idle');
          ws.close();
        }
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;               // superseded by a newer socket
      if (!want.current) { setStatus('idle'); return; }
      if (retry.current >= 4 && !readSession()) {      // never got in — server is probably down
        reset();
        setError({ code: 'unreachable', msg: 'Cannot reach the game server. Make sure it is running (npm start).' });
        return;
      }
      setStatus('reconnecting');
      timer.current = setTimeout(connect, Math.min(1000 * 2 ** retry.current, 8000));
      retry.current += 1;
    };
  }, [reset]);

  const start = useCallback((msg) => {
    want.current = true;
    firstMsg.current = msg;
    retry.current = 0;
    setError(null);
    setStatus('connecting');
    const old = wsRef.current;
    wsRef.current = null;
    old?.close();
    connect();
  }, [connect]);

  // resume a previous seat after a page refresh
  useEffect(() => {
    if (readSession()) { want.current = true; setStatus('connecting'); connect(); }
    return () => {
      want.current = false;
      clearTimeout(timer.current);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }, []);

  const leave = useCallback(() => {
    send({ t: 'leave' });
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
    reset();
  }, [send, reset]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  return {
    subscribe,
    status, state, you, role, lan, error, said, send, leave,
    create: (name, title, avatar) => start({ t: 'create', name, title, avatar }),
    join: (code, name, avatar) => start({ t: 'join', code, name, avatar }),
    watch: (code, name) => start({ t: 'join', code, name, watch: true }),
  };
}
