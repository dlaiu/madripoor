import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeAbilityScoreBonus, resolveRoundMP } from './resolver.js';
import type { Card, CardColor, MPRoundSnapshot, ResolverContext, TileGroup } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCard = (
	id: string,
	opts: {
		charisma?: 1 | 2 | 3 | 4;
		color?: CardColor;
		ability?: Card['ability'];
		type?: Card['type'];
		owner?: Card['owner'];
	} = {}
): Card => ({
	id,
	owner: opts.owner ?? 'human',
	color: opts.color ?? 'red',
	charisma: opts.charisma ?? 2,
	type: opts.type ?? 'generic',
	ability: opts.ability ?? 'none'
});

const makePL = (id: string, color: CardColor = 'red'): Card =>
	makeCard(id, { color, type: 'party_leader', ability: 'none' });

// ── computeAbilityScoreBonus ──────────────────────────────────────────────────

describe('computeAbilityScoreBonus', () => {
	describe('Party Leader', () => {
		it('always grants +2 flat bonus', () => {
			const card = makePL('pl1', 'red');
			expect(computeAbilityScoreBonus(card, 1, null, true, [], false)).toBe(2);
		});

		it('still grants +2 even when hasPartyLeaderPenalty is true', () => {
			const card = makePL('pl1', 'red');
			expect(computeAbilityScoreBonus(card, 1, null, true, [], true)).toBe(2);
		});

		it('Party Leader has no hometown bonus (party_leader type, ability none)', () => {
			const card = makePL('pl1', 'red');
			// Party leaders have ability 'none', so no hometown bonus — only the +2 PL bonus
			expect(computeAbilityScoreBonus(card, 1, 'red', true, [], false)).toBe(2);
		});
	});

	describe('Hometown', () => {
		it('grants +2 when card color matches tile color', () => {
			const card = makeCard('h1', { ability: 'hometown', color: 'red' });
			expect(computeAbilityScoreBonus(card, 1, 'red', false, [], false)).toBe(2);
		});

		it('grants +2 for CHA3 hometown card with matching color', () => {
			const card = makeCard('h1', { ability: 'hometown', color: 'blue', charisma: 3 });
			expect(computeAbilityScoreBonus(card, 1, 'blue', false, [], false)).toBe(2);
		});

		it('grants 0 when card color does not match tile color', () => {
			const card = makeCard('h1', { ability: 'hometown', color: 'red' });
			expect(computeAbilityScoreBonus(card, 1, 'blue', false, [], false)).toBe(0);
		});

		it('grants 0 when tile has no color (null)', () => {
			const card = makeCard('h1', { ability: 'hometown', color: 'red' });
			expect(computeAbilityScoreBonus(card, 1, null, false, [], false)).toBe(0);
		});

		it('grants 0 when card is mr_popular even if colors match', () => {
			const card = makeCard('mp1', { ability: 'mr_popular', color: 'red' });
			expect(computeAbilityScoreBonus(card, 1, 'red', false, [], false)).toBe(0);
		});
	});

	describe('Independent', () => {
		it('grants +2 when tile is solo', () => {
			const card = makeCard('i1', { ability: 'independent' });
			expect(computeAbilityScoreBonus(card, 1, null, true, [], false)).toBe(2);
		});

		it('grants 0 when tile is in a group', () => {
			const card = makeCard('i1', { ability: 'independent' });
			expect(computeAbilityScoreBonus(card, 1, null, false, [], false)).toBe(0);
		});

		it('grants 0 for mr_popular even on solo tile', () => {
			const card = makeCard('mp1', { ability: 'mr_popular' });
			expect(computeAbilityScoreBonus(card, 1, null, true, [], false)).toBe(0);
		});
	});

	describe('Coalition', () => {
		it('grants +2 when in a group with at least 1 different-color card', () => {
			const card = makeCard('c1', { ability: 'coalition', color: 'red' });
			const groupCards = [card, makeCard('c2', { color: 'blue' })];
			expect(computeAbilityScoreBonus(card, 1, null, false, groupCards, false)).toBe(2);
		});

		it('grants 0 when all group cards are the same color', () => {
			const card = makeCard('c1', { ability: 'coalition', color: 'red' });
			const groupCards = [card, makeCard('c2', { color: 'red' })];
			expect(computeAbilityScoreBonus(card, 1, null, false, groupCards, false)).toBe(0);
		});

		it('grants 0 when tile is solo (not in a group)', () => {
			const card = makeCard('c1', { ability: 'coalition', color: 'red' });
			expect(computeAbilityScoreBonus(card, 1, null, true, [], false)).toBe(0);
		});
	});

	describe('Mr. Popular', () => {
		it('has no hometown bonus even with matching color', () => {
			const card = makeCard('mp1', { ability: 'mr_popular', color: 'green' });
			expect(computeAbilityScoreBonus(card, 1, 'green', false, [], false)).toBe(0);
		});

		it('has no independent bonus on solo tile', () => {
			const card = makeCard('mp1', { ability: 'mr_popular' });
			expect(computeAbilityScoreBonus(card, 1, null, true, [], false)).toBe(0);
		});
	});

	describe('none ability', () => {
		it('grants 0 for a generic card with no ability', () => {
			const card = makeCard('g1', { ability: 'none' });
			expect(computeAbilityScoreBonus(card, 1, null, false, [], false)).toBe(0);
		});
	});
});

// ── Phase 2: Party Leader CHA penalty ────────────────────────────────────────

describe('Party Leader CHA penalty in resolveRoundMP', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('overrides PL charisma to 1 when player has ≥2 Party Leaders (hand + placed)', () => {
		// u1 has 2 PLs (1 placed, 1 in hand) → penalty applies
		// Party Leader card with CHA2 penalty → CHA1 override
		// But PL still gets +2 ability bonus
		const pl1 = makePL('pl1', 'red'); // placed on tile 1 (CHA2 by default in makePL)
		const pl2 = makePL('pl2', 'blue'); // in hand
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: pl1 }],
			['u2', { [tileId]: makeCard('g1', { charisma: 3 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: {},
			playerHands: { u1: [pl2] } // u1 has pl2 in hand → total PLs = 2
		};

		// With penalty: u1 effective CHA = 1, roll = 1 → base 1×1=1, + PL bonus +2 = 3
		// u2: CHA3, roll = 1 → score 3×1=3
		// They tie at 3 → reroll with extra mocks:
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1 roll: 1
			.mockReturnValueOnce(0.0) // u2 roll: 1 → tie (u1=1×1+2=3, u2=3×1=3)
			.mockReturnValueOnce(0.9) // u1 reroll: 6 → 1×6+2=8
			.mockReturnValueOnce(0.0); // u2 reroll: 1 → 3×1=3

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// With CHA1 penalty + PL +2 bonus: score = 1×1+2 = 3 (matches u2's 3×1=3 → tie)
		// After reroll u1: 1×6+2=8 vs u2: 3×1=3 → u1 wins
		expect(tr.winner).toBe('u1');
		// Verify u1's score after reroll includes PL bonus
		expect(tr.scores['u1'].score).toBe(8); // 1×6 + 2 PL bonus
	});

	it('does NOT apply CHA penalty when player has only 1 Party Leader', () => {
		const pl1 = makePL('pl1', 'red');
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: pl1 }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: {},
			playerHands: { u1: [] } // only 1 PL total → no penalty
		};

		// u1: CHA2 (no penalty) × 1 + PL +2 = 4; u2: CHA1 × 1 = 1 → u1 wins
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: 1
			.mockReturnValueOnce(0.0); // u2: 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// CHA2 × 1 + PL bonus +2 = 4
		expect(tr.scores['u1'].score).toBe(4);
		expect(tr.winner).toBe('u1');
	});
});

// ── Phase 2: Hard Worker CHA override ────────────────────────────────────────

describe('Hard Worker CHA override in resolveRoundMP', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('applies hardWorkerLevels CHA override when key exists', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: { 'hw1:1': 3 }, // escalated to CHA3
			playerHands: {}
		};

		// u1 (CHA3 via escalation) rolls 6 → score 18; u2 (CHA1) rolls 1 → score 1
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1: roll 6 → 3×6 = 18
			.mockReturnValueOnce(0.0); // u2: roll 1 → 1×1 = 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// CHA3 (from escalation) × 6 = 18
		expect(tr.scores['u1'].score).toBe(18);
		expect(tr.winner).toBe('u1');
	});

	it('uses card charisma when hardWorkerLevels key is missing', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 2 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: {}, // no entry
			playerHands: {}
		};

		// u1 (CHA2 own charisma) rolls 6 → score 12; u2 (CHA1) rolls 1 → score 1
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1: roll 6 → 2×6 = 12
			.mockReturnValueOnce(0.0); // u2: roll 1 → 1×1 = 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// CHA2 (card's own charisma) × 6 = 12
		expect(tr.scores['u1'].score).toBe(12);
		expect(tr.winner).toBe('u1');
	});
});

// ── Phase 4: Pollster dice ability ────────────────────────────────────────────

describe('Pollster dice ability', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('rolls 2d6 and takes the higher value when Pollster has no Disadvantage opponent', () => {
		const pollster = makeCard('p1', { ability: 'pollster', charisma: 1 });
		const opponent = makeCard('g1', { charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: pollster }],
			['u2', { [tileId]: opponent }]
		]);

		// Roll loop order: u1 first (pollster → 2d6), then u2 (1d6)
		// No disadvantage reroll for anyone
		// u1: 2d6 → 0.0→1, 0.9→6, keeps 6
		// u2: 1d6 → 0.0→1
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1 pollster roll 1: 1
			.mockReturnValueOnce(0.9) // u1 pollster roll 2: 6 → keeps 6
			.mockReturnValueOnce(0.0); // u2 roll: 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1: 1×6 = 6, u2: 1×1 = 1
		expect(tr.scores['u1'].roll).toBe(6);
		expect(tr.winner).toBe('u1');
	});

	it('rolls only 1d6 (Pollster negated) when opponent has Disadvantage on same tile', () => {
		const pollster = makeCard('p1', { ability: 'pollster', charisma: 2 });
		const disadvantage = makeCard('d1', { ability: 'disadvantage', charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: pollster }],
			['u2', { [tileId]: disadvantage }]
		]);

		// u1: Pollster negated (u2 has disadvantage) → 1d6 initial roll, then disadvantage reroll (take lower)
		// u2: no opponent disadvantage against them → normal 1d6, no reroll
		// Roll loop: u1: 0.5→4, u2: 0.0→1
		// Disadvantage reroll: u1 only (u2 is the disadvantage holder, not the victim)
		//   u1 reroll: 0.8→5 → min(4,5)=4 (still 4)
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.5)  // u1 initial roll: 4
			.mockReturnValueOnce(0.0)  // u2 initial roll: 1
			.mockReturnValueOnce(0.8); // u1 disadvantage reroll: 5 → min(4,5)=4

		const { tileResults } = resolveRoundMP(allPlacements, [], null);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1: 2×4=8 (only 1 roll consumed, Pollster negated), u2: 1×1=1
		expect(tr.scores['u1'].roll).toBe(4);
		expect(tr.scores['u2'].roll).toBe(1);
		expect(tr.winner).toBe('u1');
	});
});

// ── Phase 4: Disadvantage ability ────────────────────────────────────────────

describe('Disadvantage ability', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('forces opponent to reroll and take lower value', () => {
		const disadvantage = makeCard('d1', { ability: 'disadvantage', charisma: 1 });
		const opponent = makeCard('g1', { charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: disadvantage }],
			['u2', { [tileId]: opponent }]
		]);

		// Roll loop: u1 (disadvantage holder) not affected by own disadvantage → 1d6
		//           u2 (victim) has opponent disadvantage → 1d6 initial
		// Disadvantage reroll: u2 only → take lower
		// u1: 0.8→5; u2 initial: 0.9→6; u2 reroll: 0.0→1 → min(6,1)=1
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.8)  // u1 roll: 5
			.mockReturnValueOnce(0.9)  // u2 initial roll: 6
			.mockReturnValueOnce(0.0); // u2 disadvantage reroll: 1 → min(6,1)=1

		const { tileResults } = resolveRoundMP(allPlacements, [], null);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1: 1×5=5, u2: 1×1=1
		expect(tr.scores['u1'].roll).toBe(5);
		expect(tr.scores['u2'].roll).toBe(1);
		expect(tr.winner).toBe('u1');
	});

	it('multiple Disadvantage cards do not stack — victim still rerolls exactly once', () => {
		// 3-player: u1 and u2 both have Disadvantage, u3 is the victim
		// Design: multiple Disadvantage = no stacking; victim rerolls once and takes lower
		// We verify u3 rerolls only once by making the reroll obviously worse
		// and checking u3's final roll
		const dis1 = makeCard('d1', { ability: 'disadvantage', charisma: 1 });
		const dis2 = makeCard('d2', { ability: 'disadvantage', charisma: 1 });
		const victim = makeCard('g1', { charisma: 3 }); // CHA3 so they stand out
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: dis1 }],
			['u2', { [tileId]: dis2 }],
			['u3', { [tileId]: victim }]
		]);

		// Roll loop: u1 (has dis opponent u2) → 1d6, u2 (has dis opponent u1) → 1d6, u3 (has dis opponents u1,u2) → 1d6
		// Disadvantage reroll: u1 rerolls (take lower), u2 rerolls (take lower), u3 rerolls ONCE (take lower)
		// Mocks:
		//   Initial rolls:  u1:0.9→6, u2:0.0→1, u3:0.0→1
		//   Rerolls:        u1:0.0→1 → min(6,1)=1, u2:0.9→6 → min(1,6)=1, u3:0.9→6 → min(1,6)=1
		// After rerolls: u1=1, u2=1, u3=1 → all scores: u1=1×1=1, u2=1×1=1, u3=3×1=3 → u3 wins
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1 initial: 6
			.mockReturnValueOnce(0.0) // u2 initial: 1
			.mockReturnValueOnce(0.0) // u3 initial: 1
			.mockReturnValueOnce(0.0) // u1 disadvantage reroll: 1 → min(6,1)=1
			.mockReturnValueOnce(0.9) // u2 disadvantage reroll: 6 → min(1,6)=1
			.mockReturnValueOnce(0.9); // u3 disadvantage reroll: 6 → min(1,6)=1

		const { tileResults } = resolveRoundMP(allPlacements, [], null);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u3 (CHA3×1=3) wins over u1 (CHA1×1=1) and u2 (CHA1×1=1)
		expect(tr.winner).toBe('u3');
		// u3 rerolled exactly once (no stacking) — if it rerolled twice, the behavior would differ
		expect(tr.scores['u3'].roll).toBe(1);
	});
});

// ── Phase 3: Underdog ability ─────────────────────────────────────────────────

describe('Underdog ability', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	const tileId = 1;

	it('negates entrenchment for all players when Underdog player did NOT win tile in prev round', () => {
		// u1 uses a NEW underdog card (not entrenched); u2 re-uses their card (entrenched)
		// Without underdogActive: u2 gets +2 entrenchment → u2 score=3, u1 score=1 → u2 wins
		// With underdogActive (expected): entrenchment negated → both score=1 → tie → u1 wins reroll
		const underdogCardPrev = makeCard('u1c-prev', { ability: 'underdog', charisma: 1 });
		const underdogCardNew = makeCard('u1c-new', { ability: 'underdog', charisma: 1 }); // new card, not entrenched
		const entrenchedCard = makeCard('u2c', { charisma: 1 });

		const allPlacements = new Map([
			['u1', { [tileId]: underdogCardNew }], // new card → NOT entrenched
			['u2', { [tileId]: entrenchedCard }]   // same card as prev → entrenched
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: {
				u1: { [tileId]: underdogCardPrev }, // u1 had DIFFERENT card in prev
				u2: { [tileId]: entrenchedCard }
			},
			groups: [],
			tileResults: [
				{
					tileId,
					scores: {
						u1: { card: underdogCardPrev, roll: 1, score: 1 },
						u2: { card: entrenchedCard, roll: 3, score: 3 }
					},
					winner: 'u2' // u1 (underdog) did NOT win → underdogActive = true
				}
			],
			groupResults: []
		};

		// Without underdogActive: u2 entrenched → u2=1×1+2=3, u1=1×1=1 → u2 wins outright (no tie)
		// With underdogActive (correct behavior): entrenchment negated → u2=1×1=1, u1=1×1=1 → tie → u1 wins reroll
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: 1
			.mockReturnValueOnce(0.0) // u2: 1 → tie (underdogActive negates u2's entrenchment bonus)
			.mockReturnValueOnce(0.9) // u1 reroll: 6
			.mockReturnValueOnce(0.0); // u2 reroll: 1

		const { tileResults } = resolveRoundMP(allPlacements, [], prev);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// If underdogActive worked: tie → u1 wins reroll
		// If underdogActive was NOT working: u2 scores 3 vs u1's 1 → u2 wins outright (no reroll needed, 2 mocks consumed)
		expect(tr.winner).toBe('u1');
	});

	it('does NOT activate when Underdog player WON the tile in prev round', () => {
		// u1 plays a NEW underdog card this round (not entrenched); u2 re-uses their card (entrenched)
		// This isolates the test: only u2 gets entrenchment, verifying underdogActive=false
		const underdogCardPrev = makeCard('u1c-prev', { ability: 'underdog', charisma: 1 });
		const underdogCardNew = makeCard('u1c-new', { ability: 'underdog', charisma: 1 });
		const entrenchedCard = makeCard('u2c', { charisma: 1 });

		const allPlacements = new Map([
			['u1', { [tileId]: underdogCardNew }], // new card → NOT entrenched
			['u2', { [tileId]: entrenchedCard }]   // same card as prev → entrenched
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: {
				u1: { [tileId]: underdogCardPrev }, // different card → u1 not entrenched this round
				u2: { [tileId]: entrenchedCard }
			},
			groups: [],
			tileResults: [
				{
					tileId,
					scores: {
						u1: { card: underdogCardPrev, roll: 5, score: 5 },
						u2: { card: entrenchedCard, roll: 1, score: 1 }
					},
					winner: 'u1' // u1 (underdog) WON → underdogActive = false
				}
			],
			groupResults: []
		};

		// underdogActive = false → entrenchment applies for u2 only
		// u1 (not entrenched): 1×1 = 1; u2 (entrenched): 1×1+2 = 3 → u2 wins, no tie
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: 1
			.mockReturnValueOnce(0.0); // u2: 1 → u2 score = 1+2=3, u1 score = 1 → u2 wins

		const { tileResults } = resolveRoundMP(allPlacements, [], prev);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1: 1×1=1 (no entrenchment, new card); u2: 1×1+2=3 → u2 wins
		expect(tr.winner).toBe('u2');
		expect(tr.scores['u2'].score).toBe(3);
	});

	it('has no effect in round 1 (prev === null) — no entrenchment exists', () => {
		const underdogCard = makeCard('u1c', { ability: 'underdog', charisma: 2 });
		const otherCard = makeCard('u2c', { charisma: 1 });

		const allPlacements = new Map([
			['u1', { [tileId]: underdogCard }],
			['u2', { [tileId]: otherCard }]
		]);

		// No prev → underdog has no effect, no entrenchment either
		// u1 (CHA2) rolls 6 → 12; u2 (CHA1) rolls 1 → 1 → u1 wins clearly
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1: 6 → 2×6=12
			.mockReturnValueOnce(0.0); // u2: 1 → 1×1=1

		const { tileResults } = resolveRoundMP(allPlacements, [], null);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		expect(tr.winner).toBe('u1');
		expect(tr.scores['u1'].score).toBe(12);
	});
});

// ── Phase 5: Integration — Hometown bonus in resolveRoundMP ──────────────────

describe('Integration: Hometown bonus', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('adds +2 to score when hometown card color matches tile color', () => {
		const hometownCard = makeCard('ht1', { ability: 'hometown', color: 'blue', charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: hometownCard }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: { [tileId]: 'blue' }, // tile 1 is blue
			hardWorkerLevels: {},
			playerHands: {}
		};

		// u1: 1×1 + hometown +2 = 3; u2: 1×1 = 1 → u1 wins
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: 1
			.mockReturnValueOnce(0.0); // u2: 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1: 1×1 + hometown +2 = 3; u2: 1×1 = 1
		expect(tr.scores['u1'].score).toBe(3);
		expect(tr.winner).toBe('u1');
	});

	it('adds no bonus when hometown card color does not match tile color', () => {
		const hometownCard = makeCard('ht1', { ability: 'hometown', color: 'red', charisma: 1 });
		const tileId = 1;

		const allPlacements = new Map([
			['u1', { [tileId]: hometownCard }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const ctx: ResolverContext = {
			coloredTileColors: { [tileId]: 'blue' }, // tile is blue, card is red
			hardWorkerLevels: {},
			playerHands: {}
		};

		// No hometown bonus — u1=1×1=1, u2=1×1=1 → tie → u1 wins reroll
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: 1
			.mockReturnValueOnce(0.0) // u2: 1 → tie (no hometown bonus)
			.mockReturnValueOnce(0.9) // u1 reroll: 6
			.mockReturnValueOnce(0.0); // u2 reroll: 1

		const { tileResults } = resolveRoundMP(allPlacements, [], null, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// No bonus → both score 1 → tie → u1 wins reroll
		expect(tr.scores['u1'].score).toBe(6); // 1×6 after reroll
		expect(tr.winner).toBe('u1');
	});
});

// ── Phase 5: Integration — Coalition bonus in resolveRoundMP ─────────────────

describe('Integration: Coalition bonus in group', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('adds +2 Coalition bonus when group has cards of different colors', () => {
		const coalitionCard = makeCard('c1', { ability: 'coalition', color: 'red', charisma: 1 });
		const tile1 = 1;
		const tile2 = 3; // a neighboring tile

		const allPlacements = new Map([
			['u1', { [tile1]: coalitionCard, [tile2]: makeCard('u1t2', { color: 'blue', charisma: 1 }) }],
			['u2', { [tile1]: makeCard('g1', { color: 'blue', charisma: 1 }), [tile2]: makeCard('g2', { charisma: 1 }) }]
		]);

		const group: TileGroup = { id: 'g1', tileIds: [tile1, tile2] };

		// All roll 1. u1 on tile1 has coalition +2 (group has red + blue = different colors)
		// u1 on tile1: 1×1+2=3; u2 on tile1: 1×1=1
		// u1 on tile2: 1×1=1; u2 on tile2: 1×1=1 → tile2 is a tie, will reroll
		// To avoid complexity, let's check tile-level scores for the coalition tile
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1 tile1 roll: 1
			.mockReturnValueOnce(0.0) // u2 tile1 roll: 1
			.mockReturnValueOnce(0.0) // u1 tile2 roll: 1
			.mockReturnValueOnce(0.0) // u2 tile2 roll: 1 → tile2 tie
			.mockReturnValueOnce(0.9) // u1 tile2 reroll: 6
			.mockReturnValueOnce(0.0); // u2 tile2 reroll: 1

		const { groupResults } = resolveRoundMP(allPlacements, [group], null);
		const gr = groupResults[0];

		// u1 on tile1 should have coalition +2 bonus
		const u1TileScore = gr.perTile.find((t) => t.tileId === tile1)!.scores['u1'].score;
		expect(u1TileScore).toBe(3); // 1×1 + coalition +2
	});

	it('adds no Coalition bonus when all group cards are same color', () => {
		// Use CHA2 for u1 coalition and CHA1 for u2 to avoid ties and still verify no bonus
		const coalitionCard = makeCard('c1', { ability: 'coalition', color: 'red', charisma: 2 });
		const tile1 = 1;
		const tile2 = 3;

		const allPlacements = new Map([
			['u1', { [tile1]: coalitionCard, [tile2]: makeCard('u1t2', { color: 'red', charisma: 2 }) }],
			['u2', { [tile1]: makeCard('g1', { color: 'red', charisma: 1 }), [tile2]: makeCard('g2', { color: 'red', charisma: 1 }) }]
		]);

		const group: TileGroup = { id: 'g1', tileIds: [tile1, tile2] };

		// All red cards → no coalition bonus for u1
		// u1 rolls 3 → score 2×3=6; u2 rolls 3 → score 1×3=3 → no tie, u1 wins
		// 0.4 → Math.floor(0.4 * 6) + 1 = 2 + 1 = 3
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.4) // u1 tile1 roll: 3 → 2×3=6 (no coalition)
			.mockReturnValueOnce(0.4) // u2 tile1 roll: 3 → 1×3=3
			.mockReturnValueOnce(0.4) // u1 tile2 roll: 3 → 2×3=6
			.mockReturnValueOnce(0.4); // u2 tile2 roll: 3 → 1×3=3

		const { groupResults } = resolveRoundMP(allPlacements, [group], null);
		const gr = groupResults[0];

		const u1TileScore = gr.perTile.find((t) => t.tileId === tile1)!.scores['u1'].score;
		// 2×3 = 6 (no coalition bonus — all cards are red)
		expect(u1TileScore).toBe(6);
	});
});

// ── Phase 7: Hard Worker escalation return ───────────────────────────────────

describe('Hard Worker escalation (hardWorkerEscalations return value)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	const tileId = 1;

	it('escalates CHA by 1 when Hard Worker owner LOST the tile', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 1 });
		const stronger = makeCard('g1', { charisma: 3 });

		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: stronger }]
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileId]: hw } }, // hw was on same tile
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: { 'hw1:1': 1 }, // current CHA is 1
			playerHands: {}
		};

		// u1 (CHA1) rolls 1 → score 1; u2 (CHA3) rolls 6 → score 18 → u2 wins → u1 lost
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: roll 1 → score 1
			.mockReturnValueOnce(0.9); // u2: roll 6 → score 18

		const { hardWorkerEscalations, tileResults } = resolveRoundMP(allPlacements, [], prev, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		expect(tr.winner).toBe('u2'); // u1 lost
		expect(hardWorkerEscalations['hw1:1']).toBe(2); // CHA1 → CHA2
	});

	it('does NOT escalate when Hard Worker owner WON the tile', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 2 });
		const weaker = makeCard('g1', { charisma: 1 });

		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: weaker }]
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileId]: hw } }, // same tile as prev
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: { 'hw1:1': 2 }, // currently CHA2
			playerHands: {}
		};

		// u1 (CHA2) rolls 6 → score 12; u2 (CHA1) rolls 1 → score 1 → u1 wins
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1: roll 6 → 2×6=12
			.mockReturnValueOnce(0.0); // u2: roll 1 → 1×1=1

		const { hardWorkerEscalations, tileResults } = resolveRoundMP(allPlacements, [], prev, ctx);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		expect(tr.winner).toBe('u1');
		expect(hardWorkerEscalations['hw1:1']).toBe(2); // unchanged, u1 won
	});

	it('caps escalation at CHA3', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 3 });
		const stronger = makeCard('g1', { charisma: 1 });

		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: stronger }]
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileId]: hw } },
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: { 'hw1:1': 3 }, // already at max CHA3
			playerHands: {}
		};

		// u1 (CHA3) rolls 1 → score 3; u2 (CHA1) rolls 6 → score 6 → u2 wins → u1 lost
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.0) // u1: roll 1 → 3×1=3
			.mockReturnValueOnce(0.9); // u2: roll 6 → 1×6=6

		const { hardWorkerEscalations } = resolveRoundMP(allPlacements, [], prev, ctx);
		expect(hardWorkerEscalations['hw1:1']).toBe(3); // capped at 3
	});

	it('removes escalation key when Hard Worker moved to a different tile', () => {
		const hw = makeCard('hw1', { ability: 'hard_worker', charisma: 2 });
		const tileIdOld = 2;

		// hw is now on tileId (1), but in prev it was on tileIdOld (2)
		const allPlacements = new Map([
			['u1', { [tileId]: hw }],
			['u2', { [tileId]: makeCard('g1', { charisma: 1 }) }]
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileIdOld]: hw } }, // was on tile 2, now on tile 1
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const ctx: ResolverContext = {
			coloredTileColors: {},
			hardWorkerLevels: { 'hw1:2': 2 }, // old key for old tile
			playerHands: {}
		};

		// u1 (CHA2) rolls 6 → score 12; u2 (CHA1) rolls 1 → score 1 → u1 wins
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9) // u1: 6 → 2×6=12
			.mockReturnValueOnce(0.0); // u2: 1 → 1×1=1

		const { hardWorkerEscalations } = resolveRoundMP(allPlacements, [], prev, ctx);
		// hw was NOT on tile 1 in prev (it was on tile 2) → moved → key 'hw1:1' should not be set
		expect(hardWorkerEscalations['hw1:1']).toBeUndefined();
	});
});

// ── Existing resolveRoundMP passes with new optional ctx param ────────────────

describe('resolveRoundMP backward compatibility', () => {
	it('returns hardWorkerEscalations in result without ctx argument', () => {
		const tileIds = [1, 2, 3];
		const allPlacements = new Map([
			['u1', Object.fromEntries(tileIds.map((id, i) => [id, makeCard(`u1-${i}`, { charisma: 3 })]))],
			['u2', Object.fromEntries(tileIds.map((id, i) => [id, makeCard(`u2-${i}`, { charisma: 1 })]))]
		]);

		// u1 has CHA3, u2 has CHA1 → u1 should dominate on most tiles
		// Use deterministic rolls to avoid infinite loop: u1 always rolls 6, u2 always rolls 1
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.9).mockReturnValueOnce(0.0) // tile 1
			.mockReturnValueOnce(0.9).mockReturnValueOnce(0.0) // tile 2
			.mockReturnValueOnce(0.9).mockReturnValueOnce(0.0); // tile 3

		const result = resolveRoundMP(allPlacements, [], null);
		expect(result.tileResults).toHaveLength(3);
		expect(result.groupResults).toHaveLength(0);
		expect(result.hardWorkerEscalations).toBeDefined();
		expect(typeof result.hardWorkerEscalations).toBe('object');
	});
});
