import { describe, it, expect } from 'vitest';
import { buildHand } from './deckFactory.js';

describe('buildHand', () => {
	it('returns exactly 15 cards', () => {
		expect(buildHand('human').length).toBe(15);
		expect(buildHand('cpu').length).toBe(15);
	});

	it('sets owner field to the argument passed', () => {
		expect(buildHand('human').every((c) => c.owner === 'human')).toBe(true);
		expect(buildHand('cpu').every((c) => c.owner === 'cpu')).toBe(true);
	});

	it('has exactly 5 cards of each color', () => {
		const hand = buildHand('human');
		expect(hand.filter((c) => c.color === 'red').length).toBe(5);
		expect(hand.filter((c) => c.color === 'blue').length).toBe(5);
		expect(hand.filter((c) => c.color === 'green').length).toBe(5);
	});

	it('has exactly 5 CHA1, 7 CHA2, 3 CHA3', () => {
		const hand = buildHand('human');
		expect(hand.filter((c) => c.charisma === 1).length).toBe(5);
		expect(hand.filter((c) => c.charisma === 2).length).toBe(7);
		expect(hand.filter((c) => c.charisma === 3).length).toBe(3);
	});

	it('has exactly 1 Party Leader', () => {
		expect(buildHand('human').filter((c) => c.type === 'party_leader').length).toBe(1);
	});

	it('has all unique card IDs', () => {
		const hand = buildHand('human');
		const ids = hand.map((c) => c.id);
		expect(new Set(ids).size).toBe(15);
	});

	it('Party Leader has CHA3', () => {
		const leader = buildHand('human').find((c) => c.type === 'party_leader')!;
		expect(leader.charisma).toBe(3);
	});
});
