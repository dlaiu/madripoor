import { buildHand } from './deckFactory.js';
import {
	addTileToGroup,
	cpuAutoGerrymander,
	groupContaining,
	removeTileFromGroup,
	validateGroups
} from './groups.js';
import { cpuPlaceCards, resolveRound } from './resolver.js';
import type { Card, GameState, PlayerKey, RoundState } from './types.js';
import { getNeighbors, TILES } from '../board/hex.js';

const TILE_IDS = TILES.map((t) => t.id);

function freshRound(roundNumber: number): RoundState {
	return {
		roundNumber,
		groups: [],
		humanPlacements: {},
		cpuPlacements: {},
		results: [],
		groupResults: [],
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
	history: [],
	gerrySelectedTileId: null
});

export function resetGame(): void {
	game.phase = 'placement';
	game.roundWins = { human: 0, cpu: 0 };
	game.humanHand = buildHand('human');
	game.cpuHand = buildHand('cpu');
	game.selectedCard = null;
	game.currentRound = freshRound(1);
	game.history = [];
	game.gerrySelectedTileId = null;
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
	const prev = game.history.length > 0 ? game.history[game.history.length - 1] : null;

	const { tileResults, groupResults } = resolveRound(
		game.currentRound.humanPlacements,
		cpuPlacements,
		game.currentRound.groups,
		prev
	);

	game.currentRound.cpuPlacements = Object.fromEntries(cpuPlacements);
	game.currentRound.results = tileResults;
	game.currentRound.groupResults = groupResults;

	let humanTiles = tileResults.filter((r) => r.winner === 'human').length;
	let cpuTiles = tileResults.filter((r) => r.winner === 'cpu').length;
	for (const gr of groupResults) {
		if (gr.winner === 'human') humanTiles += gr.tileIds.length;
		else if (gr.winner === 'cpu') cpuTiles += gr.tileIds.length;
	}

	game.currentRound.humanTilesWon = humanTiles;
	game.currentRound.cpuTilesWon = cpuTiles;

	const roundWinner: PlayerKey = humanTiles >= cpuTiles ? 'human' : 'cpu';
	game.currentRound.winner = roundWinner;
	game.roundWins[roundWinner]++;

	game.phase = game.roundWins[roundWinner] >= 3 ? 'game_over' : 'round_end';
}

export function startNextRound(): void {
	game.history.push(game.currentRound);
	const nextRoundNum = game.currentRound.roundNumber + 1;
	const previousWinner = game.currentRound.winner;

	game.humanHand = buildHand('human');
	game.cpuHand = buildHand('cpu');
	game.selectedCard = null;
	game.gerrySelectedTileId = null;
	game.currentRound = freshRound(nextRoundNum);

	if (previousWinner === 'cpu') {
		game.currentRound.groups = cpuAutoGerrymander(nextRoundNum);
		game.phase = 'placement';
	} else {
		game.phase = 'gerrymandering';
	}
}

export function gerryClickTile(tileId: number): void {
	const anchor = game.gerrySelectedTileId;

	if (anchor === null) {
		const inGroup = groupContaining(game.currentRound.groups, tileId);
		if (inGroup) {
			game.currentRound.groups = removeTileFromGroup(game.currentRound.groups, tileId);
		} else {
			game.gerrySelectedTileId = tileId;
		}
		return;
	}

	if (anchor === tileId) {
		game.gerrySelectedTileId = null;
		return;
	}

	const neighborIds = new Set(getNeighbors(anchor).map((n) => n.id));
	if (neighborIds.has(tileId)) {
		game.currentRound.groups = addTileToGroup(game.currentRound.groups, tileId, anchor);
		game.gerrySelectedTileId = null;
	} else {
		game.gerrySelectedTileId = tileId;
	}
}

export function confirmGerrymandering(): void {
	const { valid } = validateGroups(
		game.currentRound.groups,
		game.currentRound.roundNumber
	);
	if (valid) {
		game.phase = 'placement';
	}
}

export function clearGroups(): void {
	game.currentRound.groups = [];
	game.gerrySelectedTileId = null;
}
