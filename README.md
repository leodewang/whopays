# Who Pays?

Single-file dinner party game for 2–8 players sharing one phone. Open index.html, enter names, and pick Croc Roulette, Reaction Duel, Card Draw, Finger Pick, or PLO Showdown. Confirm the final bill-payer after a game, or play another game. New Round keeps the group.

## Rules

- Croc Roulette: one random tooth snaps; its picker loses. Teeth can be configured before a round.
- Reaction Duel: slowest valid time loses. A false start loses to any valid time. Tied worst players replay until one loser remains.
- Card Draw: lowest rank loses, aces high. Equal ranks use clubs < diamonds < hearts < spades.
- Finger Pick: everyone holds one finger in the pad. Once the configured group is present, hold for the countdown; one ring is selected at random. After lifting fingers, the selected person taps their name to confirm the bill-payer. Lifting or adding a finger restarts the countdown. Multi-touch hardware limits apply; use another game if the device cannot register the whole group.
- PLO Showdown: choose 2–8 seats, deal four face-down cards each, watch the flop/turn/river, then tap each hole card to reveal it. Only after every card is revealed does the app announce the winner(s). Standard Omaha high uses exactly two hole cards plus three board cards. Suits never break ties. There are no betting rounds and the poker winner is not automatically declared the bill-payer.
- Names and mute preferences stay in this browser when localStorage is available. There is no cross-device synchronization or payment processing.

## Hosting on GitHub Pages

Upload index.html to the root of leodewang/whopays. In repository Settings → Pages, select Deploy from a branch, main, / (root), and Save. Use the URL GitHub displays after deployment. No build command, framework, or server is required. The website is public.

## Tests

Run `node --test tests/logic.test.cjs` with Node.js. This harness exercises application JavaScript with controlled timers, randomness, and a simulated DOM. It is NOT a real-browser test and does not establish layout, audio, or touch correctness.

Before first dinner, open the hosted app on an actual phone and play each game. Check audio after the first tap, mute, back during reaction countdown, croc reset after snap, repeated rounds, long names, and 2/8 players. Reload and confirm remembered names. The previous live three-game version passed exercised desktop Chrome flows. Local previews remain blocked in this working environment. The new Finger Pick needs real-device multi-touch verification after deployment.

## Runtime

All application CSS and JS are inline in index.html. Only Google Fonts loads externally; sounds are synthesized via Web Audio. The tests and this README are development files, not app dependencies.

## Finger Pick design references

Chwazi interaction reference: https://play.google.com/store/apps/details?id=com.tendadigital.chwaziApp

Pointer interaction reference: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction

Finger Pick uses original inline code and the existing Who Pays visual theme. No Chwazi assets or code are bundled.

### Phone acceptance checks

1. With two configured players, hold two fingers until one ring is selected; lift fingers and confirm the selected person's name.
2. Repeat while moving a finger inside the pad. Lift a finger during countdown and verify it restarts when everyone returns.
3. Add an extra finger during countdown; verify no subset is selected.
4. Reset, navigate back, rotate, or background the app during collection. Verify no stale selection appears.
5. Try the largest group supported by your phone. If it cannot track your full group, use another mode.
6. Verify the chosen ring remains visible after all fingers lift and that no name is assigned until explicitly confirmed.

## PLO Showdown and animations

Finger Pick rings pulse during collection/countdown and emphasize the chosen ring. Reduced-motion settings disable animation.

PLO deals cards one at a time, runs the five-card board out in streets, and flips each selected hole card. Seats default to the existing roster count; choosing fewer uses the first listed names, choosing more adds generic Player names without modifying the main roster.

PLO rule reference: https://www.pokerstars.com/poker/games/omaha/

Poker Now visual reference: https://www.pokernow.com/
The publicly found https://github.com/Zehmosu/PokerNow is an API client, not a licensed copy of Poker Now's animation frontend. This app uses original inline CSS/JS animations; no Poker Now assets or implementation were copied.

PLO acceptance checks: with 2 and 8 players, confirm four concealed cards per person, automatic flop/turn/river, no hole reveals during dealing, one card per tap, and no result before all cards finish revealing. Try rapid repeat taps, New Hand, and Back during dealing and final reveal. Verify shared winners, readable board and all seats on a phone, and reduced-motion behavior.
