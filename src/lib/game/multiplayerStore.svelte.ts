import { buildHand, coerceCard } from './deckFactory.js';
import * as db from '../db.js';
import { addTileToGroup, groupContaining, removeTileFromGroup, validateGroups } from './groups.js';
import { resolveRoundMP } from './resolver.js';
import type {
	Card,
	CardColor,
	GamePlayerRow,
	MPGroupResult,
	MPRoundSnapshot,
	MPTileResult,
	MultiplayerPhase,
	ResolverContext,
	TileGroup
} from './types.js';
import { getNeighbors } from '../board/hex.js';
import { supabase } from '../supabase.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Player state shape ─────────────────────────────────────────────────────────

export interface PlayerState {
	userId: string;
	displayName: string;
	playerIndex: number;
	roundWins: number;
	placedCount: number;
	isReady: boolean;
}

const SESSION_KEY = 'madripoor_session';

// ── Store ──────────────────────────────────────────────────────────────────────

export const mp = $state({
	// Identity
	myUserId: null as string | null,
	myPlayerIndex: null as number | null,
	myDisplayName: '',

	// Game metadata
	gameId: null as string | null,
	roomCode: '',
	phase: 'lobby' as MultiplayerPhase,
	roundNumber: 1,
	gerryPlayerId: null as string | null,
	maxPlayers: 2,

	// All players (including self)
	players: [] as PlayerState[],

	// My game state
	myHand: [] as Card[],
	selectedCard: null as Card | null,
	myPlacements: {} as Record<number, Card>,
	groups: [] as TileGroup[],
	gerrySelectedTileId: null as number | null,

	// All players' placements (populated after reveal)
	allPlacements: {} as Record<string, Record<number, Card>>,

	// N-player results
	tileResults: [] as MPTileResult[],
	groupResults: [] as MPGroupResult[],

	// Card buying
	cardStore: [] as (Card | null)[],
	buyingTurnUserId: null as string | null,
	drawPile: [] as Card[],

	// For entrenchment detection
	history: [] as MPRoundSnapshot[],

	// Mr. Popular pending placement (awaiting color declaration)
	mrPopularPending: null as { tileId: number; card: Card } | null,

	// Hard Worker CHA escalation levels: "cardId:tileId" -> current CHA
	hardWorkerLevels: {} as Record<string, number>,

	error: null as string | null
});

// ── Derived helpers ────────────────────────────────────────────────────────────

export function isHost(): boolean {
	return mp.myPlayerIndex === 0;
}

export function isGerrymanderer(): boolean {
	return mp.myUserId !== null && mp.myUserId === mp.gerryPlayerId;
}

export function allPlaced(): boolean {
	return mp.players.length > 0 && mp.players.every((p) => p.placedCount === 15);
}

export function myState(): PlayerState | undefined {
	return mp.players.find((p) => p.userId === mp.myUserId);
}

export function otherPlayers(): PlayerState[] {
	return mp.players.filter((p) => p.userId !== mp.myUserId);
}

export function myRoundWins(): number {
	return myState()?.roundWins ?? 0;
}

// Party Leader penalty visibility: ≥2 PLs in hand + placed → display CHA1
export function myPartyLeaderPenalty(): boolean {
	return (
		[...mp.myHand, ...Object.values(mp.myPlacements)].filter((c) => c.type === 'party_leader')
			.length >= 2
	);
}

// ── Session persistence ────────────────────────────────────────────────────────

export function saveSession(gameId: string, roomCode: string): void {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify({ gameId, roomCode }));
	} catch {
		// ignore
	}
}

export function loadSession(): { gameId: string; roomCode: string } | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		// ignore
	}
}

// ── Realtime channel ref ───────────────────────────────────────────────────────

let _channel: RealtimeChannel | null = null;
let _revealTriggered = false;

// ── Init ───────────────────────────────────────────────────────────────────────

export async function initMultiplayer(
	gameId: string,
	myUserId: string,
	myPlayerIndex: number
): Promise<void> {
	mp.gameId = gameId;
	mp.myUserId = myUserId;
	mp.myPlayerIndex = myPlayerIndex;

	const [players, gameRes] = await Promise.all([
		db.getGamePlayers(gameId),
		supabase.from('games').select('*').eq('id', gameId).single()
	]);

	const gameRow = gameRes.data;
	if (!gameRow) { mp.error = 'Game not found'; return; }

	mp.phase = gameRow.phase;
	mp.roundNumber = gameRow.round_number;
	mp.gerryPlayerId = gameRow.gerry_player_id;
	mp.roomCode = gameRow.room_code;
	mp.maxPlayers = gameRow.max_players ?? 2;
	mp.cardStore = (gameRow.card_store_json ?? []).map((c) => c ? coerceCard(c as unknown as Record<string, unknown>) : null);
	mp.buyingTurnUserId = gameRow.buying_turn_player_id ?? null;
	mp.drawPile = (gameRow.draw_pile_json ?? []).map((c) => coerceCard(c as unknown as Record<string, unknown>));
	mp.hardWorkerLevels = gameRow.hard_worker_levels_json ?? {};

	const groupRound = gameRow.phase === 'gerrymandering'
		? gameRow.round_number
		: gameRow.round_number - 1;
	const groupRows = groupRound >= 1 ? await db.getGroupsForRound(gameId, groupRound) : [];

	applyPlayers(players);
	mp.groups = groupRows.map((r) => ({ id: r.group_local_id, tileIds: r.tile_ids }));

	// Load hand from DB or generate fresh on round 1
	if (mp.phase !== 'lobby') {
		await loadMyHand(gameId, myUserId, gameRow.round_number);
	}

	// Restore placements on page-refresh mid-placement
	if (mp.phase === 'placement') {
		const placementRows = await db.getCardPlacements(gameId, gameRow.round_number);
		const mine = placementRows.filter((r) => r.user_id === myUserId);
		if (mine.length > 0) {
			mp.myPlacements = Object.fromEntries(mine.map((r) => [r.tile_id, r.card_json]));
			const placedIds = new Set(mine.map((r) => r.card_json.id));
			mp.myHand = mp.myHand.filter((c) => !placedIds.has(c.id));
			const myP = mp.players.find((p) => p.userId === myUserId);
			if (myP) myP.placedCount = mine.length;
		}
	}

	subscribeRealtime(gameId);
}

async function loadMyHand(gameId: string, myUserId: string, roundNumber: number): Promise<void> {
	const rows = await db.getGamePlayers(gameId);
	const myRow = rows.find((r) => r.user_id === myUserId);
	if (myRow?.hand_json && myRow.hand_json.length > 0) {
		mp.myHand = myRow.hand_json.map((c) => coerceCard(c as unknown as Record<string, unknown>));
	} else {
		// Round 1 or hand not yet persisted — build fresh and save
		const freshHand = buildHand('human');
		mp.myHand = freshHand;
		await db.saveHand(gameId, freshHand);
	}
}

function applyPlayers(players: GamePlayerRow[]): void {
	mp.players = players.map((p) => ({
		userId: p.user_id,
		displayName: p.display_name,
		playerIndex: p.player_index,
		roundWins: p.round_wins,
		placedCount: p.placed_count,
		isReady: p.is_ready
	}));

	const me = players.find((p) => p.user_id === mp.myUserId);
	if (me) mp.myDisplayName = me.display_name;
}

// ── Realtime ───────────────────────────────────────────────────────────────────

function subscribeRealtime(gameId: string): void {
	if (_channel) supabase.removeChannel(_channel);

	_channel = supabase
		.channel(`game:${gameId}`)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
			handleGameChange
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
			handlePlayersChange
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'round_groups', filter: `game_id=eq.${gameId}` },
			handleGroupsChange
		)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'round_results',
				filter: `game_id=eq.${gameId}`
			},
			handleResultsChange
		)
		.subscribe();
}

function handleGameChange(payload: { new: Record<string, unknown> }): void {
	const row = payload.new;
	const prevPhase = mp.phase;
	mp.phase = row.phase as MultiplayerPhase;
	mp.roundNumber = row.round_number as number;
	mp.gerryPlayerId = (row.gerry_player_id as string) ?? null;
	mp.cardStore = ((row.card_store_json as (Card | null)[]) ?? []).map((c) => c ? coerceCard(c as unknown as Record<string, unknown>) : null);
	mp.buyingTurnUserId = (row.buying_turn_player_id as string) ?? null;
	mp.drawPile = ((row.draw_pile_json as Card[]) ?? []).map((c) => coerceCard(c as unknown as Record<string, unknown>));
	mp.hardWorkerLevels = (row.hard_worker_levels_json as Record<string, number>) ?? {};

	if (mp.phase !== prevPhase) {
		onPhaseTransition(prevPhase, mp.phase);
	}
}

function handlePlayersChange(payload: { new: Record<string, unknown> }): void {
	const row = payload.new as GamePlayerRow;

	const idx = mp.players.findIndex((p) => p.userId === row.user_id);
	if (idx >= 0) {
		mp.players[idx].isReady = row.is_ready;
		mp.players[idx].placedCount = row.placed_count;
		mp.players[idx].roundWins = row.round_wins;
		mp.players[idx].displayName = row.display_name;
	} else {
		mp.players = [
			...mp.players,
			{
				userId: row.user_id,
				displayName: row.display_name,
				playerIndex: row.player_index,
				roundWins: row.round_wins,
				placedCount: row.placed_count,
				isReady: row.is_ready
			}
		];
	}

	// Host: check if all players ready → trigger reveal
	if (isHost() && mp.phase === 'placement' && mp.gameId) {
		const allReady = mp.players.length === mp.maxPlayers && mp.players.every((p) => p.isReady);
		if (allReady && !_revealTriggered) {
			_revealTriggered = true;
			db.updatePhase(mp.gameId, 'revealing').catch(console.error);
		}
	}

	// Host: process card buying swap requests
	if (isHost() && mp.phase === 'card_buying' && mp.gameId) {
		const req = row.swap_request;
		if (!req) return;

		if (req.action === 'buy' && req.storePosition !== undefined) {
			// Replenish the store slot; return discarded card to bottom of draw pile
			const newDrawPile = [...mp.drawPile];
			const newCard = newDrawPile.shift() ?? null;
			if (req.discardedCard) newDrawPile.push(req.discardedCard);
			const newStore = [...mp.cardStore];
			newStore[req.storePosition] = newCard;
			db.replenishStoreSlot(mp.gameId, newStore, newDrawPile).catch(console.error);
		}

		// Check if this player's turn is done
		const buyer = mp.players.find((p) => p.userId === row.user_id);
		const maxSwaps = getBuyerMaxSwaps(row.user_id);
		if (req.action === 'done' || (buyer && row.swaps_used >= maxSwaps)) {
			advanceBuyingTurn().catch(console.error);
		}
	}
}

function handleGroupsChange(payload: {
	eventType: string;
	new: Record<string, unknown>;
	old: Record<string, unknown>;
}): void {
	if (payload.eventType === 'DELETE') {
		const localId = payload.old.group_local_id as string | undefined;
		if (localId) {
			mp.groups = mp.groups.filter((g) => g.id !== localId);
		} else if (mp.gameId) {
			// REPLICA IDENTITY not FULL — payload.old has no group_local_id; reload from DB
			const rn = mp.roundNumber;
			db.getGroupsForRound(mp.gameId, rn).then((rows) => {
				mp.groups = rows.map((r) => ({ id: r.group_local_id, tileIds: r.tile_ids }));
			}).catch(console.error);
		}
	} else {
		// Gerrymanderer manages mp.groups directly — ignore Realtime echoes of their own writes
		// to prevent a race where the INSERT echo arrives after a local delete
		if (isGerrymanderer()) return;

		const row = payload.new;
		const group: TileGroup = {
			id: row.group_local_id as string,
			tileIds: row.tile_ids as number[]
		};
		const idx = mp.groups.findIndex((g) => g.id === group.id);
		if (idx >= 0) {
			mp.groups = mp.groups.map((g, i) => (i === idx ? group : g));
		} else {
			mp.groups = [...mp.groups, group];
		}
	}
}

function handleResultsChange(payload: { new: Record<string, unknown> }): void {
	const row = payload.new;
	mp.tileResults = row.tile_results as MPTileResult[];
	mp.groupResults = row.group_results as MPGroupResult[];

	if (!mp.myUserId || !mp.gameId) return;

	const wins = row.player_tile_wins as Record<string, number>;
	const winnerId = determineRoundWinner(wins);

	if (!isHost() && winnerId === mp.myUserId) {
		const myP = myState();
		if (myP) {
			myP.roundWins += 1;
			db.updatePlayerRoundWins(mp.gameId, mp.myUserId, myP.roundWins).catch(console.error);
		}
	}
}

// ── Phase transition side-effects ──────────────────────────────────────────────

function onPhaseTransition(from: MultiplayerPhase, to: MultiplayerPhase): void {
	if (to === 'revealing' && isHost()) {
		runResolution().catch(console.error);
	}

	if (to === 'placement' && mp.gameId) {
		_revealTriggered = false;
		mp.myPlacements = {};
		mp.allPlacements = {};
		mp.selectedCard = null;
		mp.gerrySelectedTileId = null;
		mp.tileResults = [];
		mp.groupResults = [];
		// Reset ready/placed counts for everyone
		for (const p of mp.players) {
			p.isReady = false;
			p.placedCount = 0;
		}
		// Load hand from DB (persisted from previous round's card buying, or fresh on round 1)
		loadMyHand(mp.gameId, mp.myUserId!, mp.roundNumber).catch(console.error);
		db.resetReadyStatus(mp.gameId).catch(console.error);
	}

	if (to === 'gerrymandering') {
		mp.gerrySelectedTileId = null;
		if (mp.groups.length > 0 && mp.gameId && isGerrymanderer()) {
			for (const group of mp.groups) {
				db.writeGroup(mp.gameId, mp.roundNumber, group).catch(console.error);
			}
		}
	}

	// Reload hand from DB (hand_json was not updated during placement, so it still has the full hand)
	if (to === 'card_buying' && mp.gameId && mp.myUserId) {
		loadMyHand(mp.gameId, mp.myUserId, mp.roundNumber).catch(console.error);
	}
}

// ── Host resolution ────────────────────────────────────────────────────────────

async function runResolution(): Promise<void> {
	if (!mp.gameId || !mp.myUserId) return;

	const rows = await db.getCardPlacements(mp.gameId, mp.roundNumber);

	// Build N-player placements map
	const allPlacementsMap = new Map<string, Record<number, Card>>();
	for (const r of rows) {
		if (!allPlacementsMap.has(r.user_id)) allPlacementsMap.set(r.user_id, {});
		let card = coerceCard(r.card_json as unknown as Record<string, unknown>);
		if (card.ability === 'mr_popular' && r.declared_color) {
			card = { ...card, color: r.declared_color };
		}
		allPlacementsMap.get(r.user_id)![r.tile_id] = card;
	}

	// Update local allPlacements so board shows everyone's cards immediately
	mp.allPlacements = Object.fromEntries(allPlacementsMap.entries());

	// Build prev snapshot for entrenchment detection
	const last = mp.history[mp.history.length - 1] ?? null;

	const players = await db.getGamePlayers(mp.gameId);
	const ctx: ResolverContext = {
		coloredTileColors: {},
		hardWorkerLevels: mp.hardWorkerLevels,
		playerHands: Object.fromEntries(players.map((p) => [p.user_id, p.hand_json ?? []]))
	};

	const { tileResults, groupResults, hardWorkerEscalations } = resolveRoundMP(allPlacementsMap, mp.groups, last, ctx);

	// Compute tile wins per player
	const playerTileWins: Record<string, number> = {};
	for (const tr of tileResults) {
		playerTileWins[tr.winner] = (playerTileWins[tr.winner] ?? 0) + 1;
	}
	for (const gr of groupResults) {
		playerTileWins[gr.winner] = (playerTileWins[gr.winner] ?? 0) + gr.tileIds.length;
	}

	const winnerId = determineRoundWinner(playerTileWins);
	const winnerPlayer = mp.players.find((p) => p.userId === winnerId);
	const newWins = (winnerPlayer?.roundWins ?? 0) + 1;

	// Update local state immediately
	mp.tileResults = tileResults;
	mp.groupResults = groupResults;
	if (winnerPlayer) winnerPlayer.roundWins = newWins;

	const finalPhase = newWins >= 3 ? 'game_over' : 'resolution';

	await db.writeRoundResults(mp.gameId, mp.roundNumber, tileResults, groupResults, playerTileWins);

	// Persist Hard Worker escalations
	mp.hardWorkerLevels = hardWorkerEscalations;
	await supabase.from('games').update({ hard_worker_levels_json: hardWorkerEscalations }).eq('id', mp.gameId);

	// Host updates their own round_wins if they won (RLS blocks updating others)
	if (winnerId === mp.myUserId) {
		await db.updatePlayerRoundWins(mp.gameId, mp.myUserId, newWins);
	}

	await db.updatePhase(mp.gameId, finalPhase);
}

// ── Card buying helpers ────────────────────────────────────────────────────────

function getBuyingTurnOrder(): string[] {
	// Worst → best: sort players by tile wins in this round (ascending)
	const tileWins: Record<string, number> = {};
	for (const tr of mp.tileResults) {
		tileWins[tr.winner] = (tileWins[tr.winner] ?? 0) + 1;
	}
	for (const gr of mp.groupResults) {
		tileWins[gr.winner] = (tileWins[gr.winner] ?? 0) + gr.tileIds.length;
	}
	return [...mp.players]
		.sort((a, b) => {
			const winsA = tileWins[a.userId] ?? 0;
			const winsB = tileWins[b.userId] ?? 0;
			if (winsA !== winsB) return winsA - winsB; // ascending tile wins
			return a.playerIndex - b.playerIndex; // tiebreak: lower index first
		})
		.map((p) => p.userId);
}

function getBuyerMaxSwaps(userId: string): number {
	const order = getBuyingTurnOrder();
	return order[0] === userId ? 2 : 1; // last place (first in order) gets 2
}

async function initCardBuying(): Promise<void> {
	if (!mp.gameId) return;
	const order = getBuyingTurnOrder();
	// Draw 4 cards from draw pile for the store
	const pile = [...mp.drawPile];
	const storeCards: (Card | null)[] = [
		pile.shift() ?? null,
		pile.shift() ?? null,
		pile.shift() ?? null,
		pile.shift() ?? null
	];
	await db.initCardBuyingPhase(mp.gameId, order[0], storeCards, pile);
}

async function advanceBuyingTurn(): Promise<void> {
	if (!mp.gameId) return;
	const order = getBuyingTurnOrder();
	const currentIdx = order.indexOf(mp.buyingTurnUserId ?? '');
	const nextUserId = currentIdx >= 0 && currentIdx < order.length - 1
		? order[currentIdx + 1]
		: null;

	if (nextUserId) {
		await db.advanceBuyingTurn(mp.gameId, nextUserId);
	} else {
		// All done — gerry_player_id already set by advanceToNextRound; go to gerrymandering
		await db.updatePhase(mp.gameId, 'gerrymandering');
	}
}

// ── Round winner determination ─────────────────────────────────────────────────

function determineRoundWinner(playerTileWins: Record<string, number>): string {
	// Winner = most tile wins; tiebreak by lowest player_index
	let winnerId = '';
	let winCount = -1;
	let winIndex = Infinity;

	for (const [userId, count] of Object.entries(playerTileWins)) {
		const player = mp.players.find((p) => p.userId === userId);
		const pIndex = player?.playerIndex ?? Infinity;
		if (count > winCount || (count === winCount && pIndex < winIndex)) {
			winnerId = userId;
			winCount = count;
			winIndex = pIndex;
		}
	}
	return winnerId;
}

// ── Actions ────────────────────────────────────────────────────────────────────

export function selectCard(card: Card): void {
	if (mp.selectedCard?.id === card.id) {
		mp.selectedCard = null;
	} else {
		mp.selectedCard = card;
	}
}

export async function placeCard(tileId: number): Promise<void> {
	if (!mp.selectedCard || !mp.gameId) return;

	const card = mp.selectedCard;

	// Mr. Popular requires a color declaration before placement is written to DB
	if (card.ability === 'mr_popular') {
		mp.mrPopularPending = { tileId, card };
		mp.selectedCard = null;
		return;
	}

	const displaced = mp.myPlacements[tileId];

	mp.myHand = mp.myHand.filter((c) => c.id !== card.id);
	if (displaced) mp.myHand = [...mp.myHand, displaced];

	mp.myPlacements = { ...mp.myPlacements, [tileId]: card };
	mp.selectedCard = null;

	const myP = myState();
	if (myP) myP.placedCount = Object.keys(mp.myPlacements).length;

	await db.submitPlacement(mp.gameId, mp.roundNumber, tileId, card);
	if (displaced) await db.removePlacement(mp.gameId, mp.roundNumber, tileId);
	await db.setPlacedCount(mp.gameId, Object.keys(mp.myPlacements).length);
}

export async function confirmMrPopularColor(color: CardColor): Promise<void> {
	if (!mp.mrPopularPending || !mp.gameId) return;

	const { tileId, card } = mp.mrPopularPending;
	const displaced = mp.myPlacements[tileId];

	mp.myHand = mp.myHand.filter((c) => c.id !== card.id);
	if (displaced) mp.myHand = [...mp.myHand, displaced];

	mp.myPlacements = { ...mp.myPlacements, [tileId]: card };
	mp.mrPopularPending = null;

	const myP = myState();
	if (myP) myP.placedCount = Object.keys(mp.myPlacements).length;

	await db.submitPlacement(mp.gameId, mp.roundNumber, tileId, card, color);
	if (displaced) await db.removePlacement(mp.gameId, mp.roundNumber, tileId);
	await db.setPlacedCount(mp.gameId, Object.keys(mp.myPlacements).length);
}

export function cancelMrPopularPlacement(): void {
	mp.mrPopularPending = null;
}

export async function unplaceCard(tileId: number): Promise<void> {
	if (!mp.gameId) return;
	const card = mp.myPlacements[tileId];
	if (!card) return;

	const { [tileId]: _removed, ...rest } = mp.myPlacements;
	mp.myPlacements = rest;
	mp.myHand = [...mp.myHand, card];

	const myP = myState();
	if (myP) myP.placedCount = Object.keys(mp.myPlacements).length;

	await db.removePlacement(mp.gameId, mp.roundNumber, tileId);
	await db.setPlacedCount(mp.gameId, Object.keys(mp.myPlacements).length);
}

export async function setReady(): Promise<void> {
	if (!mp.gameId || Object.keys(mp.myPlacements).length !== 15) return;
	const myP = myState();
	if (myP) myP.isReady = true;
	await db.setReady(mp.gameId);
}

export async function gerryClickTile(tileId: number): Promise<void> {
	if (!mp.gameId || !isGerrymanderer()) return;
	const anchor = mp.gerrySelectedTileId;

	if (anchor === null) {
		const inGroup = groupContaining(mp.groups, tileId);
		if (inGroup) {
			const prev = mp.groups.find((g) => g.id === inGroup.id)!;
			mp.groups = removeTileFromGroup(mp.groups, tileId);
			const after = mp.groups.find((g) => g.id === inGroup.id);
			if (!after) {
				await db.deleteGroup(mp.gameId, mp.roundNumber, inGroup.id);
			} else {
				await db.writeGroup(mp.gameId, mp.roundNumber, after);
			}
			void prev;
		} else {
			mp.gerrySelectedTileId = tileId;
		}
		return;
	}

	if (anchor === tileId) {
		mp.gerrySelectedTileId = null;
		return;
	}

	const neighborIds = new Set(getNeighbors(anchor).map((n) => n.id));
	if (neighborIds.has(tileId)) {
		const prevGroups = [...mp.groups];
		mp.groups = addTileToGroup(mp.groups, tileId, anchor);
		mp.gerrySelectedTileId = null;

		for (const g of mp.groups) {
			const was = prevGroups.find((p) => p.id === g.id);
			if (!was || JSON.stringify(was.tileIds) !== JSON.stringify(g.tileIds)) {
				await db.writeGroup(mp.gameId, mp.roundNumber, g);
			}
		}
		for (const old of prevGroups) {
			if (!mp.groups.find((g) => g.id === old.id)) {
				await db.deleteGroup(mp.gameId, mp.roundNumber, old.id);
			}
		}
	} else {
		mp.gerrySelectedTileId = tileId;
	}
}

export async function confirmGerrymandering(): Promise<void> {
	if (!mp.gameId || !isGerrymanderer()) return;
	const { valid } = validateGroups(mp.groups, mp.roundNumber + 1);
	if (!valid) return;

	await db.updateRoundNumber(mp.gameId, mp.roundNumber + 1);
	await db.updatePhase(mp.gameId, 'placement');
}

export async function clearGroups(): Promise<void> {
	if (!mp.gameId || !isGerrymanderer()) return;
	mp.groups = [];
	mp.gerrySelectedTileId = null;
	await db.clearGroupsForRound(mp.gameId, mp.roundNumber);
}

export async function advanceToNextRound(): Promise<void> {
	if (!mp.gameId || !isHost()) return;

	// Derive round winner from current results
	const playerTileWins: Record<string, number> = {};
	for (const tr of mp.tileResults) {
		playerTileWins[tr.winner] = (playerTileWins[tr.winner] ?? 0) + 1;
	}
	for (const gr of mp.groupResults) {
		playerTileWins[gr.winner] = (playerTileWins[gr.winner] ?? 0) + gr.tileIds.length;
	}
	const winnerUserId = determineRoundWinner(playerTileWins);

	const winnerPlayer = mp.players.find((p) => p.userId === winnerUserId);
	if ((winnerPlayer?.roundWins ?? 0) >= 3) {
		await db.updatePhase(mp.gameId, 'game_over');
		return;
	}

	// Push snapshot to history for entrenchment detection next round
	mp.history = [
		...mp.history,
		{
			roundNumber: mp.roundNumber,
			allPlacements: { ...mp.allPlacements },
			groups: mp.groups,
			tileResults: mp.tileResults,
			groupResults: mp.groupResults
		}
	];

	// Atomically transition to card_buying with store initialized and gerry player stored
	const order = getBuyingTurnOrder();
	const pile = [...mp.drawPile];
	const storeCards: (Card | null)[] = [
		pile.shift() ?? null,
		pile.shift() ?? null,
		pile.shift() ?? null,
		pile.shift() ?? null
	];
	await db.advanceToCardBuying(mp.gameId, winnerUserId, order[0], storeCards, pile);
}

// Card buying actions
export async function buyCard(storePosition: number, handCardId: string): Promise<void> {
	if (!mp.gameId || !mp.myUserId) return;
	if (mp.buyingTurnUserId !== mp.myUserId) return;

	const storeCard = mp.cardStore[storePosition];
	if (!storeCard) return;

	const discardedCard = mp.myHand.find((c) => c.id === handCardId);
	if (!discardedCard) return;

	const newHand = mp.myHand.filter((c) => c.id !== handCardId).concat(storeCard);
	mp.myHand = newHand;

	await db.submitBuyAction(mp.gameId, newHand, storePosition, handCardId, discardedCard);
}

export async function passBuyTurn(): Promise<void> {
	if (!mp.gameId || !mp.myUserId) return;
	if (mp.buyingTurnUserId !== mp.myUserId) return;
	await db.passBuyTurn(mp.gameId);
}

export function cleanup(): void {
	if (_channel) {
		supabase.removeChannel(_channel);
		_channel = null;
	}
}
