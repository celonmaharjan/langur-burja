import { defineConfig } from 'vite';

// In development the room server (server/index.js) runs on :3001; the Vite dev
// server forwards /ws to it so friends only ever need to open the Vite URL.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true, // fail loudly instead of silently moving to another port
    proxy: {
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
