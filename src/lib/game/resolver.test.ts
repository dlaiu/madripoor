import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rollD6, resolveTile, cpuPlaceCards, resolveRound } from './resolver.js';
import type { Card } from './types.js';
import { TILES } from '../board/hex.js';

const makeCard = (id: string, charisma: 1 | 2 | 3 = 2): Card => ({
	id,
	owner: 'human',
	color: 'red',
	charisma,
	type: 'generic'
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
