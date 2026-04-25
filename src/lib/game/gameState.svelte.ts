import { buildHand } from './deckFactory.js';
import { cpuPlaceCards, resolveRound } from './resolver.js';
import type { Card, GameState, PlayerKey, RoundState } from './types.js';
import { TILES } from '../board/hex.js';

const TILE_IDS = TILES.map((t) => t.id);

function freshRound(roundNumber: number): RoundState {
	return {
		roundNumber,
		humanPlacements: {},
		results: [],
		humanTilesWon: 0,
		cpuTilesWon: 0,
		winner: null
	};
}

export const game: GameState = $state({
	phase: 'placement',
	roundWins: { human: 0, cpu: 0 },
	humanHand: buildHand('human'),
	cpuHand: buildHand('cpu'),
	selectedCard: null,
	currentRound: freshRound(1),
	history: []
});

export function resetGame(): void {
	game.phase = 'placement';
	game.roundWins = { human: 0, cpu: 0 };
	game.humanHand = buildHand('human');
	game.cpuHand = buildHand('cpu');
	game.selectedCard = null;
	game.currentRound = freshRound(1);
	game.history = [];
}

export function selectCard(card: Card): void {
	if (game.selectedCard?.id === card.id) {
		game.selectedCard = null;
	} else {
		game.selectedCard = card;
	}
}

export function placeCard(tileId: number): void {
	if (!game.selectedCard) return;

	const card = game.selectedCard;
	const displaced = game.currentRound.humanPlacements[tileId];

	game.humanHand = game.humanHand.filter((c) => c.id !== card.id);
	if (displaced) game.humanHand = [...game.humanHand, displaced];

	game.currentRound.humanPlacements = { ...game.currentRound.humanPlacements, [tileId]: card };
	game.selectedCard = null;
}

export function unplaceCard(tileId: number): void {
	const card = game.currentRound.humanPlacements[tileId];
	if (!card) return;
	const { [tileId]: _removed, ...rest } = game.currentRound.humanPlacements;
	game.currentRound.humanPlacements = rest;
	game.humanHand = [...game.humanHand, card];
}

export function startReveal(): void {
	game.phase = 'revealing';
	setTimeout(resolve, 1200);
}

export function resolve(): void {
	const cpuPlacements = cpuPlaceCards(game.cpuHand, TILE_IDS);
	const results = resolveRound(game.currentRound.humanPlacements, cpuPlacements);

	game.currentRound.results = results;
	game.currentRound.humanTilesWon = results.filter((r) => r.winner === 'human').length;
	game.currentRound.cpuTilesWon = results.filter((r) => r.winner === 'cpu').length;

	const roundWinner: PlayerKey =
		game.currentRound.humanTilesWon >= game.currentRound.cpuTilesWon ? 'human' : 'cpu';
	game.currentRound.winner = roundWinner;
	game.roundWins[roundWinner]++;

	game.phase = game.roundWins[roundWinner] >= 3 ? 'game_over' : 'round_end';
}

export function startNextRound(): void {
	game.history.push(game.currentRound);
	const nextRoundNum = game.currentRound.roundNumber + 1;
	game.humanHand = buildHand('human');
	game.cpuHand = buildHand('cpu');
	game.selectedCard = null;
	game.currentRound = freshRound(nextRoundNum);
	game.phase = 'placement';
}
