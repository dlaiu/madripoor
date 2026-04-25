# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Setup

- **Language:** TypeScript, Node 22 (use `nvm use 22`)
- **Package manager:** npm
- **Dev:** `npm run dev` — `npm run build` to verify Vercel adapter output

## Project Status

This is a **board game design project** being built with SvelteKit. The planned implementation uses **SvelteKit + Vercel + Supabase**.

## Planned Tech Stack

- **Frontend:** SvelteKit
- **Hosting:** Vercel (deploy pipeline from day 1)
- **Backend/DB:** Supabase (auth, realtime subscriptions, RLS for hidden card state)
- **Board rendering:** SVG hex tiles

## Development Milestones (see roadmap.md)

1. **Scaffold & Board Rendering** — SvelteKit init, static SVG hex board (15 tiles, 2·3·4·3·3 layout)
2. **Local Single-Player Core Loop** — card placement, dice resolution, round win tracking, no multiplayer
3. **Groups & Gerrymandering** — adjacency validation (hardest part), group scoring, gerrymander UI
4. **Multiplayer Foundation** — Supabase schema, auth, realtime sync, hidden card placement via RLS
5. **Full 2–4 Player + Card Buying** — deck scaling, card store UI, entrenchment
6. **Card Abilities** — all special cards (deliberately deferred until core loop is solid)
7. **UX Polish** — phase indicators, animations, mobile layout

The suggested implementation order is **1 → 2 → 4 (simplified) → 3**, getting multiplayer sync in early rather than retrofitting it later.

## Game Mechanics Summary

### Board
- 15 hex tiles in an oval: rows of 2·3·4·3·3
- 6 colored tiles (2 per color: red, blue, green) — positions TBD via playtesting
- Adjacency = shared hex edge

### Cards & Deck
- 15 cards per player; 3 colors (red, blue, green); charisma values 1–3 (CHA4 exists only on Mr. Popular)
- Starting distribution per hand: 7×CHA2, 5×CHA1, 3×CHA3; 5 cards per color
- Each player guaranteed 1 Party Leader in their starting hand
- Draw pile (~20–25 cards) feeds the card store between rounds

### Scoring
- Solo tile: `charisma × 1d6`; grouped tile: `sum(charisma × 1d6)` across all tiles in group
- Entrenchment (same card left on same tile from prior round): flat +2 bonus, max 1 entrenched card per group per player
- Round winner = most tiles/groups won; game winner = first to 3 round wins

### Gerrymandering (winner's privilege)
- Previous round winner regroups tiles before cards are placed (information asymmetry is intentional)
- Max group size: 3 in round 2, 4 in round 3+; at least 3 tiles must remain solo
- Adjacency required; broken groups can be directly merged without becoming solo first

### Card Buying (between rounds)
- Turn order: worst → best finish; last place gets 2 swaps, all others get 1
- 4-card face-up store, replenishes after each pick
- Full ability details in **card_abilities.md**

## Key Design Constraints (for implementation)

- Hidden card placement must be enforced server-side — Supabase RLS prevents opponents reading face-down cards before reveal
- All reveals are simultaneous — server flips all cards at once and pushes via Realtime
- Hard Worker card CHA escalation requires per-card, per-tile tracking across rounds
- Scout card swap (peek then optionally swap with own card on another tile) is a public action during reveal phase
- Odd tile count (15) guarantees no tie on round winner

## Open Design Questions (deferred to playtesting)

- Exact colored tile positions on the board
- Physical tracking method for Hard Worker CHA escalation
- Whether edge tiles need a compensating mechanic (fewer adjacency options)
- Exact grouping limits (currently suggestions, not final)
