import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rollD6, resolveTile, cpuPlaceCards, resolveRound, resolveRoundMP } from './resolver.js';
import type { Card, MPRoundSnapshot } from './types.js';
import { TILES } from '../board/hex.js';

const makeCard = (id: string, charisma: 1 | 2 | 3 = 2): Card => ({
	id,
	owner: 'human',
	color: 'red',
	charisma,
	type: 'generic',
	ability: 'none'
});

const humanCard = makeCard('h-1', 2);
const cpuCard = makeCard('c-1', 2);

describe('rollD6', () => {
	it('returns an integer between 1 and 6 inclusive', () => {
		for (let i = 0; i < 100; i++) {
			const n = rollD6();
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(6);
			expect(Number.isInteger(n)).toBe(true);
		}
	});
});

describe('resolveTile', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('human wins when human score is higher', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
		const result = resolveTile(1, makeCard('h', 2), makeCard('c', 2));
		expect(result.winner).toBe('human');
		expect(result.humanScore).toBeGreaterThan(result.cpuScore);
	});

	it('cpu wins when cpu score is higher', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
		const result = resolveTile(1, makeCard('h', 2), makeCard('c', 2));
		expect(result.winner).toBe('cpu');
		expect(result.cpuScore).toBeGreaterThan(result.humanScore);
	});

	it('re-rolls once on tie and human wins second roll', () => {
		// First pair: both roll 3 (tie). Second pair: human rolls 6, cpu rolls 1.
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0.4) // human: 3
			.mockReturnValueOnce(0.4) // cpu: 3 → tie
			.mockReturnValueOnce(0.9) // human re-roll: 6
			.mockReturnValueOnce(0.1); // cpu re-roll: 1
		const result = resolveTile(1, makeCard('h', 1), makeCard('c', 1));
		expect(result.winner).toBe('human');
	});

	it('records tie if second roll also ties', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.4); // always rolls 3
		const result = resolveTile(1, makeCard('h', 1), makeCard('c', 1));
		expect(result.winner).toBe('tie');
	});

	it('records correct tileId, cards, rolls, and scores', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
		const result = resolveTile(7, makeCard('h', 3), makeCard('c', 2));
		expect(result.tileId).toBe(7);
		expect(result.humanCard.id).toBe('h');
		expect(result.cpuCard.id).toBe('c');
		expect(result.humanRoll).toBe(6);
		expect(result.humanScore).toBe(18); // 3 × 6
		expect(result.cpuRoll).toBe(1);
		expect(result.cpuScore).toBe(2); // 2 × 1
	});
});

describe('cpuPlaceCards', () => {
	const tileIds = TILES.map((t) => t.id);

	it('returns a Map covering all 15 tile IDs', () => {
		const hand = TILES.map((t, i) => makeCard(`c-${i}`));
		const placements = cpuPlaceCards(hand, tileIds);
		expect(placements.size).toBe(15);
		for (const id of tileIds) {
			expect(placements.has(id)).toBe(true);
		}
	});

	it('uses each card exactly once', () => {
		const hand = TILES.map((t, i) => makeCard(`c-${i}`));
		const placements = cpuPlaceCards(hand, tileIds);
		const placed = [...placements.values()];
		const placedIds = placed.map((c) => c.id);
		const unique = new Set(placedIds);
		expect(unique.size).toBe(15);
	});
});

describe('resolveRound', () => {
	it('returns one TileResult per tile (15 total)', () => {
		const tileIds = TILES.map((t) => t.id);
		const humanPlacements: Record<number, Card> = Object.fromEntries(tileIds.map((id, i) => [id, makeCard(`h-${i}`)]));
		const cpuPlacements = new Map(tileIds.map((id, i) => [id, makeCard(`c-${i}`)]));
		const { tileResults, groupResults } = resolveRound(humanPlacements, cpuPlacements, [], null);
		expect(groupResults).toHaveLength(0);
		expect(tileResults).toHaveLength(15);
		const resultTileIds = tileResults.map((r) => r.tileId).sort((a, b) => a - b);
		expect(resultTileIds).toEqual([...tileIds].sort((a, b) => a - b));
	});
});

describe('resolveRoundMP', () => {
	const tileIds = TILES.map((t) => t.id);

	const makeAllPlacements = (userIds: string[]): Map<string, Record<number, Card>> => {
		return new Map(
			userIds.map((uid, pi) => [
				uid,
				Object.fromEntries(tileIds.map((id, i) => [id, makeCard(`${uid}-${i}`)]))
			])
		);
	};

	it('returns 15 MPTileResults and no group results for ungrouped board', () => {
		const placements = makeAllPlacements(['u1', 'u2']);
		const { tileResults, groupResults } = resolveRoundMP(placements, [], null);
		expect(tileResults).toHaveLength(15);
		expect(groupResults).toHaveLength(0);
	});

	it('each tile result has a score entry for every player', () => {
		const placements = makeAllPlacements(['u1', 'u2', 'u3']);
		const { tileResults } = resolveRoundMP(placements, [], null);
		for (const tr of tileResults) {
			expect(Object.keys(tr.scores)).toHaveLength(3);
			expect(tr.scores['u1']).toBeDefined();
			expect(tr.scores['u2']).toBeDefined();
			expect(tr.scores['u3']).toBeDefined();
		}
	});

	it('winner has the highest score on each tile', () => {
		const placements = makeAllPlacements(['u1', 'u2']);
		const { tileResults } = resolveRoundMP(placements, [], null);
		for (const tr of tileResults) {
			const winnerScore = tr.scores[tr.winner].score;
			for (const [uid, s] of Object.entries(tr.scores)) {
				if (uid !== tr.winner) expect(winnerScore).toBeGreaterThan(s.score);
			}
		}
	});

	it('applies entrenchment +2 to group score when same card on same tile as previous round', () => {
		const cardU1 = makeCard('u1-card', 1); // CHA1 so rolls are small, +2 is significant
		const cardU2 = makeCard('u2-card', 1);
		const tileId = tileIds[0];
		const groupTileId = tileIds[1];

		const placements = new Map([
			['u1', { [tileId]: cardU1, [groupTileId]: makeCard('u1-g', 1) }],
			['u2', { [tileId]: cardU2, [groupTileId]: makeCard('u2-g', 1) }]
		]);

		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileId]: cardU1, [groupTileId]: makeCard('u1-g', 1) } },
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const group = { id: 'g1', tileIds: [tileId, groupTileId] };
		const { groupResults } = resolveRoundMP(placements, [group], prev);
		expect(groupResults).toHaveLength(1);
		// u1 should have +2 entrenchment bonus
		const u1Total = groupResults[0].totals['u1'];
		const u2Total = groupResults[0].totals['u2'];
		// u1's base score before entrenchment is the sum of their tile scores
		const u1BaseFromPerTile = groupResults[0].perTile.reduce((s, t) => s + (t.scores['u1']?.score ?? 0), 0);
		expect(u1Total).toBe(u1BaseFromPerTile + 2);
		expect(u2Total).toBe(groupResults[0].perTile.reduce((s, t) => s + (t.scores['u2']?.score ?? 0), 0));
	});

	it('ungrouped tiles are excluded from tileResults when in a group', () => {
		const placements = makeAllPlacements(['u1', 'u2']);
		const group = { id: 'g1', tileIds: [tileIds[0], tileIds[1]] };
		const { tileResults, groupResults } = resolveRoundMP(placements, [group], null);
		expect(tileResults).toHaveLength(13);
		expect(groupResults).toHaveLength(1);
		const soloIds = tileResults.map((t) => t.tileId);
		expect(soloIds).not.toContain(tileIds[0]);
		expect(soloIds).not.toContain(tileIds[1]);
	});

	it('applies entrenchment +2 to solo tile scores for MP', () => {
		const cardU1 = makeCard('u1-solo', 1);
		const cardU2 = makeCard('u2-solo', 1);
		const tileId = tileIds[0];

		const placements = new Map([
			['u1', { [tileId]: cardU1 }],
			['u2', { [tileId]: cardU2 }]
		]);
		const prev: MPRoundSnapshot = {
			roundNumber: 1,
			allPlacements: { u1: { [tileId]: cardU1 } }, // u1 entrenched, u2 not
			groups: [],
			tileResults: [],
			groupResults: []
		};

		const { tileResults } = resolveRoundMP(placements, [], prev);
		const tr = tileResults.find((r) => r.tileId === tileId)!;
		// u1's score = charisma×roll + 2; u2's score = charisma×roll
		const u1Base = tr.scores['u1'].card.charisma * tr.scores['u1'].roll;
		const u2Base = tr.scores['u2'].card.charisma * tr.scores['u2'].roll;
		expect(tr.scores['u1'].score).toBe(u1Base + 2);
		expect(tr.scores['u2'].score).toBe(u2Base);
	});
});

describe('resolveTile solo entrenchment', () => {
	it('adds +2 to entrenched player score', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.1); // both roll 1
		const result = resolveTile(1, makeCard('h', 2), makeCard('c', 2), true, false);
		// human: 2×1+2=4, cpu: 2×1=2
		expect(result.humanScore).toBe(4);
		expect(result.cpuScore).toBe(2);
		expect(result.winner).toBe('human');
	});

	it('entrenchment breaks a tie that would otherwise re-roll', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5); // everyone rolls 4
		const result = resolveTile(1, makeCard('h', 1), makeCard('c', 1), true, false);
		// human: 1×4+2=6, cpu: 1×4+0=4 — no re-roll needed
		expect(result.humanScore).toBe(6);
		expect(result.cpuScore).toBe(4);
		expect(result.winner).toBe('human');
	});
});
