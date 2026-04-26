# Development Roadmap

## ✅ Milestone 1 — Project Scaffold & Board Rendering
**Goal:** See the hex board in a browser.

- SvelteKit + TypeScript project, `@sveltejs/adapter-vercel` configured
- Static hex board rendered in SVG (15 tiles, 2·3·4·3·3 flat-top layout)
- Axial coordinate system with `getNeighbors()` helper (used in M3)
- 6 colored tiles (2× red, blue, green) as visual placeholders
- Deployed to Vercel via GitHub

---

## ✅ Milestone 2 — Local Single-Player Core Loop (No Multiplayer)
**Goal:** One player can play through a round against a CPU opponent, end-to-end.

- 15-card hand with color/charisma values; deck factory enforces correct distribution (5×CHA1, 7×CHA2, 3×CHA3, 1 Party Leader per color group)
- Click-to-select + click-to-place card placement; placed tiles show card shape, CHA value, and ★Leader badge
- Swap/undo: clicking a placed tile with a card selected swaps the cards; clicking with no card selected returns it to hand
- Confirm button (enabled only when all 15 cards placed) triggers reveal phase
- CPU places cards randomly; all 15 tiles resolved simultaneously with `charisma × 1d6` scoring
- Side panel shows per-tile vote breakdown (CHA × roll = votes) for both players, persists through round end
- Round win counter and 3-win game-over condition
- 28 unit tests covering resolver, deck factory, and game state actions
- Note: `humanPlacements` uses `Record<number, Card>` (not Map) — Svelte 5 reactive proxy doesn't propagate Map mutations across component prop boundaries

This milestone proves the core game loop works before touching multiplayer.

---

## ✅ Milestone 3 — Grouped Tiles & Gerrymandering
**Goal:** Groups work correctly and the round winner can regroup tiles.

- Group rendering: tiles in a group visually connected, share a single score
- Group scoring logic: sum of (charisma × d6) per tile, entrenchment bonus
- Gerrymandering UI: round winner can drag/merge tiles into groups, with adjacency and size constraints enforced (max 4, ≥3 solo)
- Adjacency validation logic (this is the hardest part of this milestone)
- Groups persist/reset correctly across rounds

---

## ✅ Milestone 3.5 — Supabase Client Setup
**Goal:** Wire up Supabase before multiplayer work begins.

- Create Supabase project, add `@supabase/supabase-js`
- Configure env vars locally (`.env.local`) and on Vercel
- Create `src/lib/supabase.ts` client — no tables yet, just confirms connection

---

## Milestone 4 — Multiplayer Foundation
**Goal:** Two players can play a full game in separate browsers.

- Supabase schema: games, players, tiles, groups, card_placements, rounds
- Supabase Auth: magic-link or display-name join via shareable room link
- Lobby: host creates game, share link, players join, host starts
- Realtime subscriptions: all clients stay in sync on phase transitions and game state
- Hidden card placement: cards submitted face-down, RLS prevents opponents from reading them
- Reveal phase: server flips all cards simultaneously, Realtime pushes to all clients
- Test with 2 players; confirm hidden state, sync, and resolution all work

---

## Milestone 5 — Full 2–4 Player Support & Card Buying
**Goal:** Complete game playable with friends.

- Scale to 3–4 players (deck scaling, turn order logic)
- Card buying phase: replenishing store UI, worst-to-best turn order, swap mechanic
- Hand management: discard selected card, receive store card, hand stays at 15
- Entrenchment: player can mark a card as entrenched during placement, +2 bonus resolved server-side
- End-to-end playtest with real people

---

## Milestone 6 — Card Abilities
**Goal:** All special cards work correctly.

- Party Leader, Hometown (CHA1/2/3), Pollster, Scout, Hard Worker (starting deck abilities)
- Mr. Popular, Independent, Coalition, Underdog, Disadvantage (draw pile abilities)
- Ability resolution order defined and enforced server-side
- Visual feedback when an ability triggers

Deliberately deferred because abilities are the most bug-prone part and the core loop needs to be solid first.

---

## Milestone 7 — UX Polish for Playtesting
**Goal:** Hand this to someone who hasn't read the rules and have them figure it out.

- Phase indicator with clear player prompts ("Waiting for 2 players to place cards…")
- Animated reveal, dice roll animations
- Score breakdown visible after each tile resolves
- Mobile-friendly layout (people will want to play on phones)
- Basic error states (disconnected player, page refresh recovery)

---

## Suggested Order

Milestone 1 → 2 → 3.5 → 4 (basic) → 3, because getting multiplayer sync working early is lower-risk than building the full local game and then retrofitting it. A simplified Milestone 4 (just turn-based state sync, no hidden placement) can run in parallel with Milestone 2.
