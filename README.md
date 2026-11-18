# Langur Burja (लंगुर बुर्जा)

The traditional Nepali dice game: six dice, six figures, play money only. Practice solo, or play with friends in
private rooms (up to 8 players, plus spectators). Nepali and English. Installable on a phone.

```bash
npm install
npm start            # game on http://localhost:5173 (room server on :3001)
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests, room-server tests (starts its own server) and the restart/persistence test |
| `npm run test:e2e` | Browser test: builds the app, starts a server and headless Chrome, plays solo, a 2-player room and a spectator |
| `npm run build && npm run serve` | Production mode: one process serves the game and the rooms |

* Rules and options: the **Rules** button in the app. House rules (payout, stake limit, roll order, betting timer) are set by the room host.
* Playing over the internet: see [DEPLOY.md](DEPLOY.md).
* Real sound recordings: see [public/sounds/README.md](public/sounds/README.md).
* Game logic shared by browser and server: `shared/game.js`. The server is authoritative: it rolls the dice and settles every bet.
