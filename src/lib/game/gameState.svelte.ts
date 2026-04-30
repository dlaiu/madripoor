import { buildDrawPile, buildHand } from './deckFactory.js';
import {
	addTileToGroup,
	cpuAutoGerrymander,
	groupContaining,
	removeTileFromGroup,
	validateGroups
} from './groups.js';
import { cpuPlaceCards, resolveRound } from './resolver.js';
import type { Card, CardColor, GameState, PlayerKey, RoundState } from './types.js';
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
	gerrySelectedTileId: null,
	drawPile: [],
	cardStore: [null, null, null, null],
	hardWorkerLevels: {},
	mrPopularPending: null,
	humanSwapsUsed: 0,
	humanMaxSwaps: 1
});

export function soloPartyLeaderPenalty(): boolean {
	return (
		[...game.humanHand, ...Object.values(game.currentRound.humanPlacements)].filter(
			(c) => c.type === 'party_leader'
		).length >= 2
	);
}

export function resetGame(): void {
	game.phase = 'placement';
	game.roundWins = { human: 0, cpu: 0 };
	game.humanHand = buildHand('human');
	game.cpuHand = buildHand('cpu');
	game.selectedCard = null;
	game.currentRound = freshRound(1);
	game.history = [];
	game.gerrySelectedTileId = null;
	game.drawPile = buildDrawPile(2);
	game.cardStore = [null, null, null, null];
	game.hardWorkerLevels = {};
	game.mrPopularPending = null;
	game.humanSwapsUsed = 0;
	game.humanMaxSwaps = 1;
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

	// Mr. Popular requires a color declaration before placement is committed
	if (card.ability === 'mr_popular') {
		game.mrPopularPending = { tileId, card };
		game.selectedCard = null;
		return;
	}

	const displaced = game.currentRound.humanPlacements[tileId];

	game.humanHand = game.humanHand.filter((c) => c.id !== card.id);
	if (displaced) game.humanHand = [...game.humanHand, displaced];

	game.currentRound.humanPlacements = { ...game.currentRound.humanPlacements, [tileId]: card };
	game.selectedCard = null;
}

export function confirmMrPopularColorSolo(color: CardColor): void {
	if (!game.mrPopularPending) return;

	const { tileId, card } = game.mrPopularPending;
	const displaced = game.currentRound.humanPlacements[tileId];

	game.humanHand = game.humanHand.filter((c) => c.id !== card.id);
	if (displaced) game.humanHand = [...game.humanHand, displaced];

	// Store the card with the declared color applied so resolver sees it correctly
	const cardWithColor: Card = { ...card, color };
	game.currentRound.humanPlacements = { ...game.currentRound.humanPlacements, [tileId]: cardWithColor };
	game.mrPopularPending = null;
}

export function cancelMrPopularPlacementSolo(): void {
	game.mrPopularPending = null;
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

	const ctx = {
		coloredTileColors: {} as Record<number, CardColor>,
		hardWorkerLevels: game.hardWorkerLevels,
		playerHands: {} as Record<string, Card[]>
	};

	const { tileResults, groupResults, hardWorkerEscalations } = resolveRound(
		game.currentRound.humanPlacements,
		cpuPlacements,
		game.currentRound.groups,
		prev,
		ctx
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

	game.hardWorkerLevels = hardWorkerEscalations;

	game.phase = game.roundWins[roundWinner] >= 3 ? 'game_over' : 'round_end';
}

export function cpuBuyCard(
	hand: Card[],
	store: (Card | null)[]
): { storePos: number; handCardId: string } | null {
	// Score a card: abilities > CHA3 generic > CHA2 generic > CHA1 generic
	function cardScore(c: Card): number {
		if (c.ability !== 'none') return 100 + c.charisma;
		return c.charisma;
	}

	// Find best store card
	let bestStorePos = -1;
	let bestStoreScore = -1;
	for (let i = 0; i < store.length; i++) {
		const c = store[i];
		if (!c) continue;
		const score = cardScore(c);
		if (score > bestStoreScore) {
			bestStoreScore = score;
			bestStorePos = i;
		}
	}
	if (bestStorePos === -1) return null;

	// Find worst hand card to discard (lowest score)
	let worstHandCard: Card | null = null;
	let worstScore = Infinity;
	for (const c of hand) {
		const score = cardScore(c);
		if (score < worstScore) {
			worstScore = score;
			worstHandCard = c;
		}
	}
	if (!worstHandCard) return null;

	// Only buy if the store card is strictly better than the worst hand card
	if (bestStoreScore <= worstScore) return null;

	return { storePos: bestStorePos, handCardId: worstHandCard.id };
}

export function startBuying(): void {
	const maxSwaps = game.currentRound.winner === 'human' ? 1 : 2;
	game.humanSwapsUsed = 0;
	game.humanMaxSwaps = maxSwaps;

	// Deal up to 4 cards from draw pile into store
	const newDrawPile = [...game.drawPile];
	const newStore: (Card | null)[] = [null, null, null, null];
	for (let i = 0; i < 4; i++) {
		newStore[i] = newDrawPile.shift() ?? null;
	}
	game.drawPile = newDrawPile;
	game.cardStore = newStore;
	game.phase = 'card_buying';
}

export function buyCardSolo(storePosition: number, handCardId: string): void {
	if (game.humanSwapsUsed >= game.humanMaxSwaps) return;
	const storeCard = game.cardStore[storePosition];
	if (!storeCard) return;
	const handCard = game.humanHand.find((c) => c.id === handCardId);
	if (!handCard) return;

	// Swap
	game.humanHand = game.humanHand.map((c) => (c.id === handCardId ? storeCard : c));
	const newStore = [...game.cardStore];
	newStore[storePosition] = handCard;
	game.cardStore = newStore;
	game.humanSwapsUsed++;
}

export function confirmSoloBuying(): void {
	// CPU auto-buys
	const cpuMaxSwaps = game.currentRound.winner === 'cpu' ? 1 : 2;
	let cpuSwapsUsed = 0;
	while (cpuSwapsUsed < cpuMaxSwaps) {
		const buy = cpuBuyCard(game.cpuHand, game.cardStore);
		if (!buy) break;
		const { storePos, handCardId } = buy;
		const storeCard = game.cardStore[storePos]!;
		const handCard = game.cpuHand.find((c) => c.id === handCardId)!;
		game.cpuHand = game.cpuHand.map((c) => (c.id === handCardId ? storeCard : c));
		const newStore = [...game.cardStore];
		newStore[storePos] = handCard;
		game.cardStore = newStore;
		cpuSwapsUsed++;
	}

	// Proceed to next round — keep existing hands (don't rebuild them)
	const prevGroups = game.currentRound.groups.map((g) => ({ ...g, tileIds: [...g.tileIds] }));
	game.history.push(game.currentRound);
	const nextRoundNum = game.currentRound.roundNumber + 1;
	const previousWinner = game.currentRound.winner;

	game.selectedCard = null;
	game.gerrySelectedTileId = null;
	game.currentRound = freshRound(nextRoundNum);

	if (previousWinner === 'cpu') {
		game.currentRound.groups = cpuAutoGerrymander(nextRoundNum);
		game.phase = 'placement';
	} else {
		// Human gerrymanders — start from the previous round's groups so they can modify them
		game.currentRound.groups = prevGroups;
		game.phase = 'gerrymandering';
	}
}

export function startNextRound(): void {
	startBuying();
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
