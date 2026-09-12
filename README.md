# Who Pays?

Single-file dinner party game for 2–8 players sharing one phone. Open index.html, enter names, and pick Croc Roulette, Reaction Duel, or Card Draw. Confirm the final bill-payer after a game, or play another game. New Round keeps the group.

## Rules

- Croc Roulette: one random tooth snaps; its picker loses. Teeth can be configured before a round.
- Reaction Duel: slowest valid time loses. A false start loses to any valid time. Tied worst players replay until one loser remains.
- Card Draw: lowest rank loses, aces high. Equal ranks use clubs < diamonds < hearts < spades.
- Names and mute preferences stay in this browser when localStorage is available. There is no cross-device synchronization or payment processing.

## Hosting on GitHub Pages

Upload index.html to the root of leodewang/whopays. In repository Settings → Pages, select Deploy from a branch, main, / (root), and Save. Use the URL GitHub displays after deployment. No build command, framework, or server is required. The website is public.

## Tests

Run `node tests/logic.test.cjs` with Node.js. This harness exercises application JavaScript with controlled timers, randomness, and a simulated DOM. It is NOT a real-browser test and does not establish layout, audio, or touch correctness.

Before first dinner, open the hosted app on an actual phone and play each game. Check audio after the first tap, mute, back during reaction countdown, croc reset after snap, repeated rounds, long names, and 2/8 players. Reload and confirm remembered names. Real-browser testing was blocked by this working environment's browser URL security policy.

## Runtime

All application CSS and JS are inline in index.html. Only Google Fonts loads externally; sounds are synthesized via Web Audio. The tests and this README are development files, not app dependencies.
