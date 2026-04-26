import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	isConnected,
	maxGroupSize,
	validateGroups,
	addTileToGroup,
	removeTileFromGroup,
	groupContaining,
	cpuAutoGerrymander
} from './groups.js';
import type { TileGroup } from './types.js';

// Helpers
function group(id: string, ...tileIds: number[]): TileGroup {
	return { id, tileIds };
}

describe('isConnected', () => {
	it('single tile is trivially connected', () => {
		expect(isConnected([1])).toBe(true);
	});

	it('two adjacent tiles are connected (1 and 2 share an edge)', () => {
		// Tile 1 (q=2,r=0) and Tile 2 (q=3,r=0): offset [1,0] — adjacent
		expect(isConnected([1, 2])).toBe(true);
	});

	it('linear chain 6→7→8 is connected', () => {
		// 6(q=0,r=2), 7(q=1,r=2), 8(q=2,r=2) — horizontal neighbors
		expect(isConnected([6, 7, 8])).toBe(true);
	});

	it('disconnected tiles 1 and 15 return false', () => {
		// Tile 1 (q=2,r=0) and Tile 15 (q=0,r=5) — far apart
		expect(isConnected([1, 15])).toBe(false);
	});

	it('three tiles where two are adjacent but the third is isolated returns false', () => {
		// 1 and 2 are adjacent; 15 is far from both
		expect(isConnected([1, 2, 15])).toBe(false);
	});
});

describe('maxGroupSize', () => {
	it('round 1 returns 1 (no groups allowed)', () => {
		expect(maxGroupSize(1)).toBe(1);
	});

	it('round 2 returns 3', () => {
		expect(maxGroupSize(2)).toBe(3);
	});

	it('round 3 returns 4', () => {
		expect(maxGroupSize(3)).toBe(4);
	});

	it('round 10 returns 4', () => {
		expect(maxGroupSize(10)).toBe(4);
	});
});

describe('validateGroups', () => {
	it('empty groups array is valid', () => {
		const { valid } = validateGroups([], 2);
		expect(valid).toBe(true);
	});

	it('valid config: two groups of 2, 11 solos', () => {
		// tiles 6-7 adjacent, tiles 10-11 adjacent
		const { valid } = validateGroups([group('g1', 6, 7), group('g2', 10, 11)], 2);
		expect(valid).toBe(true);
	});

	it('group with fewer than 2 tiles is invalid', () => {
		const { valid, errors } = validateGroups([group('g1', 5)], 2);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('fewer than 2'))).toBe(true);
	});

	it('group exceeding maxGroupSize for round 2 is invalid', () => {
		// round 2 max = 3; group of 4 is invalid
		const { valid, errors } = validateGroups([group('g1', 6, 7, 8, 9)], 2);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('max size'))).toBe(true);
	});

	it('group of 4 is valid in round 3', () => {
		// 6(q=0,r=2), 7(q=1,r=2), 8(q=2,r=2), 9(q=3,r=2) — all horizontally adjacent
		const { valid } = validateGroups([group('g1', 6, 7, 8, 9)], 3);
		expect(valid).toBe(true);
	});

	it('disconnected group is invalid', () => {
		const { valid, errors } = validateGroups([group('g1', 1, 15)], 2);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('disconnected'))).toBe(true);
	});

	it('tile in two groups is invalid', () => {
		const { valid, errors } = validateGroups([group('g1', 6, 7), group('g2', 7, 8)], 2);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('more than one group'))).toBe(true);
	});

	it('too many grouped tiles (< 3 solo) is invalid', () => {
		// 15 tiles, group all 12 in 4 groups of 3 → 3 solo, which is exactly 3 — should be valid
		const groups = [
			group('g1', 6, 7, 8),
			group('g2', 10, 11, 12),
			group('g3', 3, 4, 5),
			group('g4', 1, 2, 9),  // 1(q=2,r=0),2(q=3,r=0) adjacent; 9(q=3,r=2) not adjacent to 2 — disconnected
		];
		// g4 is disconnected, so invalid for that reason; just test the solo count directly
		const manyGroups = [
			group('g1', 6, 7, 8),
			group('g2', 10, 11, 12),
			group('g3', 3, 4, 5),
			// This gives 9 grouped, 6 solo — valid
		];
		const { valid: v1 } = validateGroups(manyGroups, 3);
		expect(v1).toBe(true);

		// Now add enough groups to exceed: 15 - 13 = 2 solo → invalid
		const tooMany = [
			group('g1', 6, 7, 8),    // 3 tiles
			group('g2', 10, 11, 12), // 3 tiles
			group('g3', 3, 4, 5),    // 3 tiles
			group('g4', 13, 14),     // 13(q=0,r=4), 14(q=1,r=4) — adjacent; +2 = 11 grouped, 4 solo
			group('g5', 1, 2),       // 1(q=2,r=0), 2(q=3,r=0) — adjacent; +2 = 13 grouped, 2 solo → invalid
		];
		const { valid: v2, errors } = validateGroups(tooMany, 3);
		expect(v2).toBe(false);
		expect(errors.some(e => e.includes('solo'))).toBe(true);
	});
});

describe('groupContaining', () => {
	it('returns null when tile is not in any group', () => {
		expect(groupContaining([group('g1', 6, 7)], 8)).toBeNull();
	});

	it('returns the correct group', () => {
		const g = group('g1', 6, 7);
		expect(groupContaining([g], 7)).toEqual(g);
	});
});

describe('addTileToGroup', () => {
	it('creates a new group when neither tile is grouped', () => {
		const result = addTileToGroup([], 7, 6);
		expect(result).toHaveLength(1);
		expect(result[0].tileIds).toContain(6);
		expect(result[0].tileIds).toContain(7);
	});

	it('adds tile to anchor group when anchor is grouped', () => {
		const groups = [group('g1', 6, 7)];
		const result = addTileToGroup(groups, 8, 6); // anchor=6 in g1, click=8
		expect(result).toHaveLength(1);
		expect(result[0].tileIds).toContain(8);
	});

	it('adds anchor to clicked tile group when clicked is grouped', () => {
		const groups = [group('g1', 7, 8)];
		const result = addTileToGroup(groups, 6, 9); // anchor=9 not grouped, click=6 not in group — wait
		// anchor=9, click=7 (which is in g1)
		const result2 = addTileToGroup(groups, 7, 9); // anchor=9, click=7 in g1
		expect(result2[0].tileIds).toContain(9);
	});

	it('merges two groups when both tiles are in different groups', () => {
		const groups = [group('g1', 6, 7), group('g2', 8, 9)];
		// anchor=7 in g1, click=8 in g2
		const result = addTileToGroup(groups, 8, 7);
		expect(result).toHaveLength(1);
		expect(result[0].tileIds).toContain(6);
		expect(result[0].tileIds).toContain(7);
		expect(result[0].tileIds).toContain(8);
		expect(result[0].tileIds).toContain(9);
	});

	it('no-op when both tiles are already in the same group', () => {
		const groups = [group('g1', 6, 7)];
		const result = addTileToGroup(groups, 7, 6);
		expect(result).toHaveLength(1);
		expect(result[0].tileIds).toHaveLength(2);
	});
});

describe('removeTileFromGroup', () => {
	it('removing a tile from a 3-member group leaves a 2-member group', () => {
		const groups = [group('g1', 6, 7, 8)];
		const result = removeTileFromGroup(groups, 8);
		expect(result).toHaveLength(1);
		expect(result[0].tileIds).toHaveLength(2);
		expect(result[0].tileIds).not.toContain(8);
	});

	it('removing a tile from a 2-member group dissolves the group', () => {
		const groups = [group('g1', 6, 7)];
		const result = removeTileFromGroup(groups, 7);
		expect(result).toHaveLength(0);
	});

	it('removing a tile not in any group is a no-op', () => {
		const groups = [group('g1', 6, 7)];
		const result = removeTileFromGroup(groups, 15);
		expect(result).toHaveLength(1);
	});
});

describe('cpuAutoGerrymander', () => {
	afterEach(() => vi.restoreAllMocks());

	it('result satisfies validateGroups for round 2', () => {
		const groups = cpuAutoGerrymander(2);
		const { valid, errors } = validateGroups(groups, 2);
		expect(valid).toBe(true);
	});

	it('result satisfies validateGroups for round 3', () => {
		const groups = cpuAutoGerrymander(3);
		const { valid } = validateGroups(groups, 3);
		expect(valid).toBe(true);
	});

	it('returns empty array for round 1 (maxGroupSize=1, nothing to group)', () => {
		const groups = cpuAutoGerrymander(1);
		// All candidate groups would be size 1 which is < 2, so none form
		expect(groups).toHaveLength(0);
	});
});
