# Playing with friends over the internet

The game is one Node process: it serves the web app **and** the room WebSocket on the same port.
Rooms are saved to `data/rooms.json` (atomically, a moment after every change) and restored on start, so a restart or redeploy does not end a game: players reconnect automatically to their old seat. Run a **single instance**.

## Option A — quick tunnel from your own computer (nothing to deploy)

```bash
npm run build
PORT=3001 npm run serve          # game + rooms on http://localhost:3001
ngrok http 3001                  # or: cloudflared tunnel --url http://localhost:3001
```

Open the https link the tunnel prints, create a room, and send the **invite link shown in the room**.
It uses whatever address you opened, so friends get a working link. Stop the tunnel to close the game.

## Option B — host it (always on)

* **Render:** push this folder to a Git repo, then *New → Blueprint* and pick it (uses `render.yaml` + `Dockerfile`).
  The free plan sleeps when idle; the first visit after a nap takes ~30 s.
* **Fly.io / Railway / any Docker host:** build the `Dockerfile` and expose port `8080`.
  Keep exactly one instance and make sure the platform allows WebSockets (all of the above do).

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Port to listen on (the Dockerfile sets `8080`) |
| `MAX_ROOMS` | `200` | New rooms are refused beyond this |
| `MAX_CONN_PER_IP` | `30` | Simultaneous connections allowed per client address |
| `DATA_FILE` | `data/rooms.json` | Where rooms are saved. `off` disables saving. Point it at a persistent disk/volume on a host, otherwise a redeploy wipes it |

Play money only. Only room state (names, play-money balances, bets) is saved; there are no accounts or passwords.
