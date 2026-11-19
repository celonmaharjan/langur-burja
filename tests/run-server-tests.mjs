// Starts a throwaway room server on a spare port (nothing saved to disk), runs the end-to-end server
// checks against it, then shuts it down. Exit code is the test result.
import { spawn } from 'node:child_process';

const PORT = 3079;
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE: 'off', ADMIN_KEY: 'test-key' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => { if (String(d).includes('listening')) res(); });
  server.on('exit', () => rej(new Error('server exited early')));
});

const test = spawn(process.execPath, ['server/smoke-test.mjs'], {
  env: { ...process.env, WS_URL: `ws://localhost:${PORT}/ws` },
  stdio: 'inherit',
});
let code = await new Promise((res) => test.on('exit', res));

// anonymous counters: hidden without the key, readable with it
if (code === 0) {
  const open = await fetch(`http://localhost:${PORT}/stats`);
  const bad = await fetch(`http://localhost:${PORT}/stats?key=wrong`);
  const good = await (await fetch(`http://localhost:${PORT}/stats?key=test-key`)).json();
  const ok = open.status === 404 && bad.status === 404 && good.totals.rooms >= 1 && good.totals.rounds >= 1 && good.totals.joins >= 1 && !JSON.stringify(good).match(/Asha|Bikash|127\.0\.0\.1/);
  console.log(ok ? '✓ analytics: /stats needs the key, counts rooms/rounds/joins, stores no names or addresses' : `✗ analytics check failed: ${JSON.stringify(good).slice(0, 200)}`);
  if (!ok) code = 1;
}
server.kill('SIGTERM');
process.exit(code ?? 1);
