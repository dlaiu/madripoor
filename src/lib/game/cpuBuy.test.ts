import { describe, it, expect } from 'vitest';
import { cpuBuyCard } from './gameState.svelte.js';
import type { Card } from './types.js';

const makeCard = (id: string, charisma: 1 | 2 | 3, ability: string = 'none'): Card => ({
	id, owner: 'cpu', color: 'red', charisma, type: 'generic',
	ability: ability as Card['ability']
});

describe('cpuBuyCard', () => {
	it('returns null when store is empty', () => {
		const hand = [makeCard('h1', 2), makeCard('h2', 2)];
		expect(cpuBuyCard(hand, [null, null, null, null])).toBeNull();
	});

	it('returns null when no store card is better than worst hand card', () => {
		const hand = [makeCard('h1', 3), makeCard('h2', 3)];
		const store = [makeCard('s1', 2), null, null, null];
		expect(cpuBuyCard(hand, store)).toBeNull();
	});

	it('buys the best store card by discarding the worst hand card', () => {
		const hand = [makeCard('h1', 1), makeCard('h2', 3)];
		const store = [makeCard('s1', 2), null, null, null];
		const result = cpuBuyCard(hand, store);
		expect(result).not.toBeNull();
		expect(result!.storePos).toBe(0);
		expect(result!.handCardId).toBe('h1'); // discard the CHA1
	});

	it('prioritises ability cards over higher-CHA generics', () => {
		const hand = [makeCard('h1', 1), makeCard('h2', 2)];
		const store = [makeCard('s1', 3), makeCard('s2', 1, 'scout'), null, null];
		const result = cpuBuyCard(hand, store);
		expect(result).not.toBeNull();
		expect(result!.storePos).toBe(1); // scout (score=101) > CHA3 generic (score=3)
	});

	it('discards lowest-score card from hand', () => {
		const hand = [makeCard('h1', 2), makeCard('h2', 1), makeCard('h3', 3)];
		const store = [null, makeCard('s1', 2, 'pollster'), null, null];
		const result = cpuBuyCard(hand, store);
		expect(result).not.toBeNull();
		expect(result!.handCardId).toBe('h2'); // CHA1 is worst
	});
});
