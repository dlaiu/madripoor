# Board Game Design Document
> Generated from design session. Intended for handoff to another agent or collaborator.

---

## Overview

A 2–4 player competitive tile-placement board game where players compete to win tiles by playing cards and rolling dice. The game is played over multiple rounds, with a gerrymandering mechanic that lets the round winner reshape the board before each new round.

---

## Players & Victory

- **Player count:** 2–4 players
- **Victory condition:** First player to win **3 rounds** wins the game
- **Tile count does not carry over** between rounds — only round wins matter

---

## The Board

- **15 hex tiles** arranged in an oval layout: **2·3·4·3·3 rows**
- Tiles are numbered 1–15 for reference
- All tiles begin **solo (ungrouped)** at the start of Round 1
- Adjacency is defined by shared hex edges

### Adjacency map (for reference)
```
Row 1 (2 tiles):  1, 2
Row 2 (3 tiles):  3, 4, 5
Row 3 (4 tiles):  6, 7, 8, 9
Row 4 (3 tiles):  10, 11, 12
Row 5 (3 tiles):  13, 14, 15
```

### Colored tiles
- **6 out of 15 tiles are colored** — 2 tiles per color (red, blue, green)
- Colored tiles interact with the Hometown Card ability (see Card Abilities)
- Exact placement of colored tiles on the board to be decided during playtesting

---

## The Deck

- **Starting deck:** 60 cards (15 cards per player × 4 players)
- **Draw pile:** Separate pool of cards feeding the card store — approximately 20–25 cards including special ability cards
- **Colors:** 3 colors (red, blue, green)
- **Cards per color per hand:** 5 (color distribution becomes flexible from round 2 onwards as players swap cards)
- **Charisma values:** 1, 2, 3, and 4 (CHA4 exists on one card only — Mr. Popular)

### Charisma distribution per hand (15 cards):
| Value | Count | Rule |
|-------|-------|------|
| 2 | 7 | Most common |
| 1 | 5 | Second most common |
| 3 | 3 | Least common |

### Full deck totals (4 players):
| Value | Total cards |
|-------|------------|
| 2 | 28 |
| 1 | 20 |
| 3 | 12 |

### Key constraint:
- Every player starts with an **identical hand distribution** (same count of each value, same count of each color)
- The charisma values on specific colored cards **can differ** between players
- Each player is **guaranteed 1 Party Leader card** in their starting hand

### Player count scaling:
| Players | Starting deck | Adjustment |
|---------|--------------|------------|
| 4 | 60 cards | Full deck |
| 3 | 45 cards | Remove 1 party leader + 14 regular cards (5×CHA1, 7×CHA2, 2×CHA3) |
| 2 | 30 cards | Remove 2 party leaders + 28 regular cards — denser ability card experience |

### Card abilities:
- A subset of cards have special abilities — see **card_abilities.md** for full details
- **Starting 60 ability cards (19 total):** Party Leaders ×4, Hometown CHA1+2 ×6, Pollster ×3, Scout ×3, Hard Worker ×3
- **Draw pile ability cards (18 total):** Mr. Popular ×1, Party Leader extra ×2, Hometown CHA3 ×3, Independent ×3, Coalition ×3, Underdog ×3, Disadvantage ×3

---

## Round Structure

### Round 1
1. **Place cards face down** — each player places 1 card on each of the 15 tiles simultaneously, with entrenchment markers if desired (all face down)
2. **Reveal phase** — all cards, entrenchment markers, and colored tile bonuses resolved simultaneously
3. **Dice roll phase** — players roll and calculate scores
4. **Resolution** — winner of each tile/group determined
5. **Round winner** = player who wins the most tiles/groups

### Round 2 onwards
1. **Gerrymander** — the previous round's winner regroups tiles (see Gerrymandering)
2. **Place cards face down** — with entrenchment markers if desired (all face down)
3. **Reveal phase** — all cards, entrenchment markers, and colored tile bonuses resolved simultaneously
4. **Dice roll phase**
5. **Resolution**
6. **Card buying phase** (between rounds — see Card Buying)

---

## Scoring a Tile or Group

### Solo tile
- Each player plays 1 card on the tile
- Each player rolls **1d6** and multiplies by their card's charisma value
- **Score = charisma × d6**
- Highest score wins the tile
- **Tiebreaker:** re-roll

### Grouped tiles
- Each player plays 1 card **per tile** in the group
- Each player rolls **1 die per tile** in the group
- **Score = sum of (charisma × d6) for each tile in the group**, plus any entrenchment bonus
- Highest total score wins **all tiles in the group**
- **Tiebreaker:** re-roll

---

## Entrenchment

- A player may **leave the same card on the same tile** from the previous round
- That card is considered **entrenched** and earns a **+2 bonus** added to the final score for that tile or group
- Entrenchment is **declared face down** simultaneously with card placement, revealed during the reveal phase
- **Per group limit:** each player may designate **only 1 entrenched card per group** (including solo tiles)
- The +2 bonus is **flat** — it does not stack across multiple rounds of entrenchment
- Entrenchment bonus **survives regrouping** — if a tile is moved into a new group but the same player keeps the same card on that tile, the bonus is retained
- Both winners and losers of the previous round can entrench

---

## Gerrymandering

- Only the **previous round's winner** may gerrymander
- The winner may choose **not to gerrymander** — existing groups persist untouched
- Gerrymandering happens **before cards are placed**, so other players do not know the winner's card plans when groups are formed (intentional information asymmetry as a reward for winning)

### Grouping rules
- Tiles can only be grouped with **adjacent** tiles (shared hex edge)
- **Maximum group size:** 4 tiles
- **At least 3 tiles must remain solo** (ungrouped) at all times
- Groups from the previous round **persist** into the new round by default
- The winner may **break existing groups** and reform them — broken tiles can be directly merged into new groups without first becoming solo
- The winner may regroup **any tiles**, including tiles previously won by opponents
- When regrouping, tiles from different previous groups can be combined, provided they are adjacent

### Grouping limits (suggested — to be finalised):
| Round | Max group size | Suggested group limit |
|-------|---------------|----------------------|
| 2 | 3 | Up to 3 groups of 3, with ≥3 solo tiles |
| 3+ | 4 | Up to 2 groups of 4 + 1 group of 3, with ≥3 solo tiles |

> ⚠️ Exact grouping limits are a suggested starting point and may need playtesting to balance.

---

## Card Buying (Between Rounds)

- Occurs **after resolution**, before the next round begins
- Uses a **replenishing card store** — 4 cards are revealed from the deck face up
- Players take turns picking from the store in order of **worst to best finish**
- Each pick is a **swap** — the player takes 1 card from the store and discards 1 card from their hand, keeping hand size at 15
- After each pick, the store is **immediately replenished** with a new face-up card from the deck
- **Picking is optional** — a player may skip their turn(s)

### Swap limits per round:
| Finish position | Max swaps |
|----------------|-----------|
| Last place | Up to 2 |
| All other players | Up to 1 |

### Key design notes:
- All non-last-place players are treated equally regardless of how many tiles they won — no mid-tier ranking needed
- The replenishing store means later pickers see partially refreshed options, adding variance across the phase
- Last place's 2-swap allowance is the primary catch-up mechanic against the gerrymandering snowball
- Discarded cards return to the draw pile once it runs down — the pile self-sustains across a full game

---

## Open Questions (Deferred)

1. **Colored tile placement** — exact position of the 6 colored tiles on the board to be decided during playtesting
2. **Hard Worker tracking** — physical marker or token system needed to track CHA escalation at the table
3. **Edge tile imbalance** — edge tiles have fewer adjacency options than central tiles; no compensating mechanic added yet, to be revisited after playtesting

---

## Design Notes & Rationale

- **Odd tile count (15)** ensures someone always wins a round outright with no tie possible on total tiles
- **d6 × charisma** keeps high-value cards advantaged but not guaranteed to win (a value 1 card can beat a value 3 card)
- **Entrenchment flat +2** is intentionally modest — rewards commitment without making card swapping feel like a trap
- **Gerrymandering information asymmetry** (winner knows their own cards when grouping) is an intentional reward for winning, not a bug
- **Snowball risk** is considered manageable due to: card buying catch-up mechanic, dice variance, and the adjacency constraint on regrouping
- **Edge tiles** have fewer adjacency options than central tiles — no compensating mechanic added yet, to be revisited after playtesting
- **Card buying system** uses a replenishing store over a static draft — chosen because it gives last place a meaningful catch-up opportunity (2 swaps) without letting them fully rebuild their hand, and keeps the phase interesting for all players via store variance
