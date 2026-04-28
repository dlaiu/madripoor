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

## ✅ Milestone 4 — Multiplayer Foundation
**Goal:** Two players can play a full game in separate browsers.

- Supabase schema: `games`, `game_players`, `card_placements`, `round_groups`, `round_results` with RLS
- Anonymous Supabase Auth + display name; shareable room code; `/[room_code]` route
- Lobby: host creates game, guest joins via room code, host starts
- Realtime subscriptions: all clients stay in sync on phase transitions (games, game_players, round_groups, round_results channels)
- Hidden card placement: cards submitted face-down; RLS (`cp_select_opponent`) blocks reads until reveal
- Reveal phase: host browser runs `resolveRound`, writes results; both clients update via Realtime INSERT
- Gerrymandering: round winner regroups tiles; non-winner sees groups form live via Realtime
- Session persistence: `localStorage` restores player into the correct game on page refresh
- `REPLICA IDENTITY FULL` on `game_players` for reliable UPDATE Realtime delivery; guest updates own `round_wins` row via `handleResultsChange` (host RLS can't update opponent's row)
- Solo mode preserved at `/solo`; home hub at `/`

---

## ✅ Milestone 5 — Full 2–4 Player Support & Card Buying
**Goal:** Complete game playable with friends.

- DB schema extended: `max_players`, `draw_pile_json`, `card_store_json`, `buying_turn_player_id`, `hand_json`, `swaps_used`, `swap_request` columns
- Lobby generalised to 2–4 players; host selects player count at creation
- N-player state: replaced binary `human`/`cpu` with `players: PlayerState[]` throughout the store
- N-player resolver (`resolveRoundMP`): per-player scores, multi-way tie re-roll, group entrenchment; solo resolver untouched
- Shared draw pile (18 cards, seeded at game creation, shuffled): Party Leaders, Hometown CHA3, Independent, Mr. Popular, Disadvantage, Coalition, Underdog
- Card buying phase: sequential worst→best turn order; last-place gets 2 swaps, all others get 1; 4-card replenishing store; discarded cards recycled to bottom of draw pile
- Hand persistence: each player's `hand_json` written to DB; card bought in round N appears in round N+1
- Entrenchment: +2 per player for solo tiles (same card, same tile from prior round); +2 per player per group (capped at once regardless of how many cards entrenched in the group); applies in both solo and multiplayer resolvers
- Fixed solo gerrymandering: board now pre-populated with previous round's groups when human wins
- 66 unit tests passing

**Deferred to later milestones:**
- Solo card buying → M6 (will be designed alongside card abilities, which interact with the store)
- Entrenchment UI hints (showing previous-round placements during placement phase) → M7 polish

---

## Milestone 6 — Card Abilities & Solo Card Buying
**Goal:** All special cards work correctly; solo mode reaches feature parity with multiplayer.

- Party Leader, Hometown (CHA1/2/3), Pollster, Scout, Hard Worker (starting deck abilities)
- Mr. Popular, Independent, Coalition, Underdog, Disadvantage (draw pile abilities)
- Ability resolution order defined and enforced server-side
- Visual feedback when an ability triggers
- Solo card buying: draw pile + store UI for single-player mode; CPU buying logic

Deliberately deferred because abilities are the most bug-prone part and the core loop needs to be solid first.

---

## Milestone 7 — UX Polish for Playtesting
**Goal:** Hand this to someone who hasn't read the rules and have them figure it out.

- Phase indicator with clear player prompts ("Waiting for 2 players to place cards…")
- Animated reveal, dice roll animations
- Score breakdown visible after each tile resolves
- Entrenchment UI hints: show previous-round placements during placement so players can identify entrenched cards
- Mobile-friendly layout (people will want to play on phones)
- Basic error states (disconnected player, page refresh recovery)

---

## Suggested Order

Milestone 1 → 2 → 3.5 → 4 (basic) → 3, because getting multiplayer sync working early is lower-risk than building the full local game and then retrofitting it. A simplified Milestone 4 (just turn-based state sync, no hidden placement) can run in parallel with Milestone 2.
