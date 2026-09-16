# Who Pays?

Single-file dinner party game for 2–8 players sharing one phone. Open index.html, enter names, and pick Croc Roulette, Reaction Duel, Card Draw, Finger Pick, or PLO Showdown. Confirm the final bill-payer after a game, or play another game. New Round keeps the group.

## Rules

- Croc Roulette: one random tooth snaps; its picker loses. Teeth can be configured before a round.
- Reaction Duel: slowest valid time loses. A false start loses to any valid time. Tied worst players replay until one loser remains.
- Card Draw: lowest rank loses, aces high. Equal ranks use clubs < diamonds < hearts < spades.
- Finger Pick: everyone holds one finger in the pad. Once the configured group is present, hold for the countdown; one ring is selected at random. After lifting fingers, the selected person taps their name to confirm the bill-payer. Lifting or adding a finger restarts the countdown. Multi-touch hardware limits apply; use another game if the device cannot register the whole group.
- PLO Showdown: choose 2–8 seats, deal four face-down cards each, watch the flop/turn/river, then tap each hole card to reveal it. Only after every card is revealed does the app announce the winner(s). Standard Omaha high uses exactly two hole cards plus three board cards. Suits never break ties. There are no betting rounds and the poker winner is not automatically declared the bill-payer.
- Names and mute preferences stay in this browser when localStorage is available. Saved leaderboard results sync across phones through Supabase. No payment processing.

## Hosting on GitHub Pages

Upload index.html to the root of leodewang/whopays. In repository Settings → Pages, select Deploy from a branch, main, / (root), and Save. Use the URL GitHub displays after deployment. No frontend build command or framework is required. The website is public; the leaderboard requires a private group code and its deployed Supabase backend.

## Tests

Run `node --test tests/logic.test.cjs` with Node.js. This harness exercises application JavaScript with controlled timers, randomness, and a simulated DOM. It is NOT a real-browser test and does not establish layout, audio, or touch correctness.

Before first dinner, open the hosted app on an actual phone and play each game. Check audio after the first tap, mute, back during reaction countdown, croc reset after snap, repeated rounds, long names, and 2/8 players. Reload and confirm remembered names. The previous live three-game version passed exercised desktop Chrome flows. Local previews remain blocked in this working environment. The new Finger Pick needs real-device multi-touch verification after deployment.

## Runtime

All application CSS and JS are inline in index.html. Google Fonts supplies typography; the shared leaderboard calls the Supabase Edge Function using native fetch. No external JavaScript libraries. Sounds are synthesized via Web Audio. The tests and this README are development files, not app dependencies.

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


## Shared leaderboard

Open **Shared leaderboard**, enter the host's group code, then play. At a result, tap **Save score & amount**, confirm distinct player names and amounts in USD, and save. Use 0 for score-only rounds. Saving is explicit: playing a game does not silently add to the shared totals. Unsaved results remain on the originating phone when localStorage is available. Games continue to work without a connection.

- All-time rankings combine all phones with the group code. Refresh fetches current totals.
- “This dinner” filters by a persistent dinner ID on this phone (the shared table phone). **New dinner** changes that ID without deleting history. It is not a global session shared automatically with other phones.
- Names match after Unicode NFC normalization, whitespace normalization, and case folding. Distinct people need distinct names/initials. You can correct a display name before saving.
- Dinner games give the selected billpayer one loss and every other player one win. PLO is a separate ranking; split winners share wins, or everyone receives a tie if the entire table ties.
- Amounts are stored as integer cents, with USD fixed for this group. No mixed-currency totals.
- Retries reuse a frozen UUID/payload. An uncertain timeout never creates a fresh round. Duplicate requests cannot increase totals.
- Owner access provides **Correct result** (atomic replacement) and **Void incorrect round**. Original records remain in history. Corrections preserve the original dinner ID; the replacement is timestamped when saved.
- Group access lives in sessionStorage, not permanent browser storage. Closing the browser session may require rejoining. Local drafts/names are separate; Disconnect removes the group key but does not erase local drafts.

## Backend and security model

The project is hosted in Supabase US East. The frontend remains one HTML file. `backend/index.ts` is the separately deployed server endpoint; `backend/schema.sql` describes the final schema. This file is a fresh-install schema, not a script to rerun against an existing database. Hosted migration history records the actual changes.

The group uses a 256-bit random bearer capability. Anyone who has the member code may read the group's scores and submit results; this is a trusted-friends scoreboard, not verified player identity or cheat-proof gaming. The owner has a different capability for corrections and member-key rotation. No group creation endpoint is exposed. Group provisioning and owner recovery require the trusted Supabase administration connection.

Keys are SHA-256 hashed in the database. Raw keys are not in the repository. Optional private setup links carry keys in a URL fragment, consumed into sessionStorage and removed from the address bar. `no-referrer` prevents outbound referrer disclosure. Keep owner setup links private; share only member access. Rotating the member code revokes the previous member code. Keys do not have automatic expiry; recover/rotate owner access through Supabase administration if necessary.

All tables are in `whopays_private`, with RLS enabled and no browser grants/policies. This is intentionally default-deny. The sole public-schema RPC is SECURITY INVOKER, executable only by service_role. The Edge Function obtains that credential from its server environment, never HTML. It hashes and validates the group capability via the RPC for each action; owner checks occur in SQL as well. JWT verification is disabled only because this endpoint implements custom capability authentication, not Supabase Auth sessions.

The API limits body size to 8 KiB, accepts POST only, restricts browser origins to this GitHub Pages origin, validates outcomes/names/integer amounts on the server, and uses transactions plus unique round/replacement keys. CORS is defense in depth, not authentication. Successful authorized requests are limited to 120/group/minute; rejected transactions roll back their counters. This is not a global edge/WAF rate limit and does not prevent volumetric requests to the public endpoint. Monitor function usage and add platform/WAF controls if distribution grows beyond the friend group.

The security advisor reports only the expected INFO notices for RLS enabled without policies, reflecting the deliberate deny-all browser posture: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Leaderboard verification

`node --test tests/logic.test.cjs` includes result capture, exact-cent parsing, duplicate normalized names, identity by seat, draft persistence, frozen retries, double taps, and split poker results. These are simulated DOM/logic tests, not real browser tests.

`python tests/api.test.py /path/to/disposable-group-keys.json` exercises the actual deployed API. The JSON must contain `group`, `owner`, `member` for a separately provisioned disposable test group. Never use the real dinner group. Checks include unauthorized/cross-group requests, concurrent duplicates, conflicting retries, invalid amounts, owner-only corrections/void/rotation, cross-game and dinner filtering, and revocation. Remove the disposable records afterwards through the administrator connection.

Before use, merge the PR and test on a phone: open the private setup link, play/save a result, open the member link on a second phone and refresh, correct the amount as owner, and verify the changed total on both devices. Browser layout and real phone touch/audio still require that check.
