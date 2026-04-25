import { describe, it, expect, beforeEach, vi } from 'vitest';
import { game, selectCard, placeCard, unplaceCard, resetGame } from './gameState.svelte.js';

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
