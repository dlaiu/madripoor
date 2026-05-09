import { describe, it, expect, beforeEach, vi } from 'vitest';
import { game, selectCard, placeCard, unplaceCard, resetGame, soloScoutKeep, soloScoutSwap, startScouting } from './gameState.svelte.js';
import type { Card } from './types.js';

beforeEach(() => {
	resetGame();
	vi.restoreAllMocks();
});

describe('selectCard', () => {
	it('sets game.selectedCard to the given card', () => {
		const card = game.humanHand[0];
		selectCard(card);
		expect(game.selectedCard).toBe(card);
	});

	it('deselects when the same card is clicked again', () => {
		const card = game.humanHand[0];
		selectCard(card);
		selectCard(card);
		expect(game.selectedCard).toBeNull();
	});

	it('switches selection to a different card', () => {
		const first = game.humanHand[0];
		const second = game.humanHand[1];
		selectCard(first);
		selectCard(second);
		expect(game.selectedCard).toBe(second);
	});
});

describe('placeCard', () => {
	it('removes the selected card from humanHand', () => {
		const card = game.humanHand[0];
		selectCard(card);
		placeCard(1);
		expect(game.humanHand.find((c) => c.id === card.id)).toBeUndefined();
	});

	it('adds the card to humanPlacements for the given tile', () => {
		const card = game.humanHand[0];
		selectCard(card);
		placeCard(1);
		expect(game.currentRound.humanPlacements[1]).toBe(card);
	});

	it('clears selectedCard after placing', () => {
		selectCard(game.humanHand[0]);
		placeCard(1);
		expect(game.selectedCard).toBeNull();
	});

	it('is a no-op when no card is selected', () => {
		placeCard(1);
		expect(1 in game.currentRound.humanPlacements).toBe(false);
	});

	it('swaps when tile is already occupied: new card goes on tile, old card returns to hand', () => {
		const first = game.humanHand[0];
		selectCard(first);
		placeCard(1);

		const second = game.humanHand[0];
		selectCard(second);
		placeCard(1); // swap

		expect(game.currentRound.humanPlacements[1]).toBe(second);
		expect(game.humanHand.find((c) => c.id === first.id)).toBeDefined();
		expect(game.selectedCard).toBeNull();
	});

	it('hand size stays constant across a swap', () => {
		selectCard(game.humanHand[0]);
		placeCard(1);
		expect(game.humanHand.length).toBe(14);

		selectCard(game.humanHand[0]);
		placeCard(1); // swap — hand should still be 14
		expect(game.humanHand.length).toBe(14);
	});

	it('humanHand reaches 0 after placing all 15 cards on distinct tiles', () => {
		const tileIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
		for (const tileId of tileIds) {
			selectCard(game.humanHand[0]);
			placeCard(tileId);
		}
		expect(game.humanHand.length).toBe(0);
	});
});

describe('unplaceCard', () => {
	it('removes card from humanPlacements and returns it to humanHand', () => {
		const card = game.humanHand[0];
		selectCard(card);
		placeCard(1);
		expect(game.humanHand.length).toBe(14);

		unplaceCard(1);
		expect(game.humanHand.length).toBe(15);
		expect(1 in game.currentRound.humanPlacements).toBe(false);
		expect(game.humanHand.find((c) => c.id === card.id)).toBeDefined();
	});

	it('is a no-op when tile has no card placed', () => {
		unplaceCard(1);
		expect(game.humanHand.length).toBe(15);
	});
});

describe('multi-scout solo mode', () => {
	const makeCard = (id: string, ability: Card['ability'] = 'none'): Card => ({
		id,
		owner: 'human',
		color: 'red',
		charisma: 2,
		type: 'generic',
		ability
	});

	describe('startScouting', () => {
		it('sets remainingScoutTileIds to [] for a single scout', () => {
			game.currentRound.humanPlacements = { 1: makeCard('s1', 'scout') };
			startScouting();
			expect(game.phase).toBe('scouting');
			expect(game.soloScoutState?.humanScoutTileId).toBe(1);
			expect(game.soloScoutState?.remainingScoutTileIds).toEqual([]);
		});

		it('sets remainingScoutTileIds to the second tile when two scouts are placed', () => {
			game.currentRound.humanPlacements = {
				1: makeCard('s1', 'scout'),
				2: makeCard('s2', 'scout')
			};
			startScouting();
			expect(game.phase).toBe('scouting');
			expect(game.soloScoutState?.humanScoutTileId).toBe(1);
			expect(game.soloScoutState?.remainingScoutTileIds).toEqual([2]);
		});
	});

	describe('soloScoutKeep', () => {
		it('activates the next scout when more remain', () => {
			const nextCpuCard = makeCard('cpu-2');
			game.currentRound.cpuPlacements = { 2: nextCpuCard };
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: null,
				remainingScoutTileIds: [2]
			};
			game.phase = 'scouting';

			soloScoutKeep();

			expect(game.soloScoutState?.humanScoutTileId).toBe(2);
			expect(game.soloScoutState?.peekedCard).toStrictEqual(nextCpuCard);
			expect(game.soloScoutState?.remainingScoutTileIds).toEqual([]);
			expect(game.phase).toBe('scouting');
		});

		it('transitions to revealing when no scouts remain', () => {
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: null,
				remainingScoutTileIds: []
			};
			game.phase = 'scouting';

			soloScoutKeep();

			expect(game.soloScoutState).toBeNull();
			expect(game.phase).toBe('revealing');
		});

		it('skips a remaining scout tile that has no CPU card and activates the next valid one', () => {
			const cpuCard3 = makeCard('cpu-3');
			game.currentRound.cpuPlacements = { 3: cpuCard3 }; // no CPU card on tile 2
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: null,
				remainingScoutTileIds: [2, 3]
			};
			game.phase = 'scouting';

			soloScoutKeep();

			expect(game.soloScoutState?.humanScoutTileId).toBe(3);
			expect(game.soloScoutState?.peekedCard).toStrictEqual(cpuCard3);
		});

		it('goes to revealing when all remaining scouts have no CPU card', () => {
			game.currentRound.cpuPlacements = {}; // no CPU cards anywhere
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: null,
				remainingScoutTileIds: [2, 3]
			};
			game.phase = 'scouting';

			soloScoutKeep();

			expect(game.soloScoutState).toBeNull();
			expect(game.phase).toBe('revealing');
		});
	});

	describe('soloScoutSwap', () => {
		it('swaps cards and activates the next scout when more remain', () => {
			const scoutCard = makeCard('scout-1', 'scout');
			const targetCard = makeCard('other-3');
			const nextCpuCard = makeCard('cpu-2');

			game.currentRound.humanPlacements = { 1: scoutCard, 3: targetCard };
			game.currentRound.cpuPlacements = { 2: nextCpuCard };
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: 3,
				remainingScoutTileIds: [2]
			};
			game.phase = 'scouting';

			soloScoutSwap();

			expect(game.currentRound.humanPlacements[1]).toStrictEqual(targetCard);
			expect(game.currentRound.humanPlacements[3]).toStrictEqual(scoutCard);
			expect(game.soloScoutState?.humanScoutTileId).toBe(2);
			expect(game.soloScoutState?.peekedCard).toStrictEqual(nextCpuCard);
			expect(game.phase).toBe('scouting');
		});

		it('swaps cards and transitions to revealing when no scouts remain', () => {
			const scoutCard = makeCard('scout-1', 'scout');
			const targetCard = makeCard('other-3');

			game.currentRound.humanPlacements = { 1: scoutCard, 3: targetCard };
			game.soloScoutState = {
				humanScoutTileId: 1,
				peekedCard: makeCard('cpu-1'),
				swapTargetTileId: 3,
				remainingScoutTileIds: []
			};
			game.phase = 'scouting';

			soloScoutSwap();

			expect(game.currentRound.humanPlacements[1]).toStrictEqual(targetCard);
			expect(game.currentRound.humanPlacements[3]).toStrictEqual(scoutCard);
			expect(game.soloScoutState).toBeNull();
			expect(game.phase).toBe('revealing');
		});
	});
});
