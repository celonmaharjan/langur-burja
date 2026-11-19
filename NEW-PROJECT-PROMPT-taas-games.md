I want to build "Taas" (तास), a web app for Nepali card games, play-money only, in Nepali and English. Work one step at a time and show me each step working before moving on. Ask me when a rule is unclear instead of guessing.

## Reference project
I already built a similar game: Langur Burja, a six-dice game at /home/celon/langur-burja (GitHub celonmaharjan/langur-burja). Read its CLAUDE.md first. Reuse its patterns by copying (not importing) the code you need:
- Stack: Vite + React 19 frontend, one Node `ws` server that also serves `dist/` and `/healthz`. Dockerfile and render.yaml for Render.
- Server-authoritative rooms: 5-character room codes, seat tokens, reconnect grace period, max 8 players, spectators, host controls, rate limiting.
- Shared rules logic in `shared/` used by both browser and server.
- i18n (Nepali/English), themes (Classic / Dashain / Tihar), PWA, quick chat, WebRTC voice chat, invite buttons (WhatsApp, Viber, Messenger), shareable result image, daily bonus, support/QR dialog, anonymous stats, room persistence, tests (unit, server, headless-browser e2e).

## Rules for the whole project
- Play money only, no real-money gambling, no payments inside the game. Show a clear play-money notice.
- The server is the only source of truth. Cards are shuffled on the server with `crypto.randomInt` (Fisher-Yates). A player's hidden cards must never be sent to other players' browsers, and that must be covered by a test.
- No accounts and no personal data. Names are chosen per room.
- Phone first: big touch targets, works at 390px width, no horizontal scroll.
- Write tests as you go: unit tests for hand ranking and scoring, a server test for each game flow, and a browser test for a full round.
- Keep a CLAUDE.md in the project and update it after each milestone (layout, decisions and why, commands, open items).

## Build order
1. Project skeleton and a shared card engine: 52-card deck (plus optional joker), secure shuffle, card drawing (SVG or CSS, no copyrighted art), hand-evaluation helpers, rooms and lobby copied from Langur Burja.
2. Game 1: Teen Patti ("flush 3 patti"), 2-8 players.
3. Game 2: Dhumbal.
4. Game 3 and 4: 9 Kitty and Juth Patti, only after I confirm their rules with you.
5. Then: themes, voice, invite and share buttons, daily bonus, support QR, tournament mode with equal chips, deployment guide.

## Teen Patti rules (confirm any detail you are unsure of)
- 3 cards each from a 52-card deck. Everyone puts in a boot (starting stake). Players are blind (cards unseen) or seen. A seen player bets double what a blind player bets.
- Turn actions: blind/chaal (call), raise, pack (fold), and show when two players remain.
- Hand order, high to low: Trail/Set (three of a kind), Pure sequence (straight flush), Sequence (straight), Colour (flush), Pair, High card. A-2-3 is the lowest sequence, A-K-Q the highest.
- Make the variations host options: joker variants, pot limit and max blind count.

## Dhumbal rules (please verify with me; versions differ)
- Each player is dealt 5 cards. Goal: have the lowest total. Ace = 1, number cards = face value, J/Q/K = 10 (confirm).
- On your turn you may drop a set of equal-rank cards (or a sequence, if I choose it), then draw one card from the deck or the last dropped card.
- A player may call "show" when their total is low enough (confirm the threshold). If someone else's total is equal or lower, the caller is penalised.
- Ask me the exact scoring and penalty rules before implementing.

## 9 Kitty and Juth Patti
I have not given the rules yet. Before building either game, ask me for the rules I play with and write them into CLAUDE.md first.

## First step now
Create the project skeleton, copy only what is needed from Langur Burja, build the shared deck and its unit tests, get a lobby and a room working, then deal Teen Patti hands. Show me the result before doing the full betting flow.
