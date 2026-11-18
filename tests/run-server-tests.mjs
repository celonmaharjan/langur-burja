// Starts a throwaway room server on a spare port (nothing saved to disk), runs the end-to-end server
// checks against it, then shuts it down. Exit code is the test result.
import { spawn } from 'node:child_process';

const PORT = 3079;
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE: 'off' },
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
const code = await new Promise((res) => test.on('exit', res));
server.kill('SIGTERM');
process.exit(code ?? 1);
