import { buildHand } from './deckFactory.js';
import * as db from '../db.js';
import { addTileToGroup, groupContaining, removeTileFromGroup, validateGroups } from './groups.js';
import { resolveRound } from './resolver.js';
import type {
	Card,
	GamePlayerRow,
	MultiplayerPhase,
	MultiplayerRoundSnapshot,
	TileGroup,
	TileResult,
	GroupResult
} from './types.js';
import { getNeighbors } from '../board/hex.js';
import { supabase } from '../supabase.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const SESSION_KEY = 'madripoor_session';

export const mp = $state({
	// Identity
	myUserId: null as string | null,
	myPlayerIndex: null as 0 | 1 | null,
	myDisplayName: '',
	opponentUserId: null as string | null,
	opponentDisplayName: '',

	// Game metadata
	gameId: null as string | null,
	roomCode: '',
	phase: 'lobby' as MultiplayerPhase,
	roundNumber: 1,
	gerryPlayerId: null as string | null,

	// Ready / placement counters
	myIsReady: false,
	opponentIsReady: false,
	myPlacedCount: 0,
	opponentPlacedCount: 0,
	roundWins: { my: 0, opponent: 0 },
	players: [] as { userId: string; displayName: string; playerIndex: 0 | 1 }[],

	// Game state
	myHand: [] as Card[],
	selectedCard: null as Card | null,
	myPlacements: {} as Record<number, Card>,
	opponentPlacements: null as Record<number, Card> | null,
	groups: [] as TileGroup[],
	gerrySelectedTileId: null as number | null,

	// Results
	tileResults: [] as TileResult[],
	groupResults: [] as GroupResult[],

	// For entrenchment detection
	history: [] as MultiplayerRoundSnapshot[],

	error: null as string | null
});

// Derived helpers — used in components via import
export function isHost(): boolean {
	return mp.myPlayerIndex === 0;
}
export function isGerrymanderer(): boolean {
	return mp.myUserId !== null && mp.myUserId === mp.gerryPlayerId;
}
export function allPlaced(): boolean {
	return mp.myPlacedCount === 15;
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

// ── Init ───────────────────────────────────────────────────────────────────────

export async function initMultiplayer(
	gameId: string,
	myUserId: string,
	myPlayerIndex: 0 | 1
): Promise<void> {
	mp.gameId = gameId;
	mp.myUserId = myUserId;
	mp.myPlayerIndex = myPlayerIndex;

	// Load game + players first to know the round number for group fetching
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

	// Gerrymandering groups live at the current round; placement/resolution use previous round's
	const groupRound = gameRow.phase === 'gerrymandering'
		? gameRow.round_number
		: gameRow.round_number - 1;
	const groupRows = groupRound >= 1 ? await db.getGroupsForRound(gameId, groupRound) : [];

	applyPlayers(players);
	mp.groups = groupRows.map((r) => ({ id: r.group_local_id, tileIds: r.tile_ids }));

	if (mp.phase !== 'lobby') {
		mp.myHand = buildHand('human');
	}

	// Restore existing placements so a page-refresh mid-placement doesn't blank the board
	if (mp.phase === 'placement') {
		const placementRows = await db.getCardPlacements(gameId, gameRow.round_number);
		const mine = placementRows.filter((r) => r.user_id === myUserId);
		if (mine.length > 0) {
			mp.myPlacements = Object.fromEntries(mine.map((r) => [r.tile_id, r.card_json]));
			const placedIds = new Set(mine.map((r) => r.card_json.id));
			mp.myHand = mp.myHand.filter((c) => !placedIds.has(c.id));
			mp.myPlacedCount = mine.length;
		}
	}

	subscribeRealtime(gameId);
}

function applyPlayers(players: GamePlayerRow[]): void {
	mp.players = players.map((p) => ({
		userId: p.user_id,
		displayName: p.display_name,
		playerIndex: p.player_index
	}));

	const me = players.find((p) => p.user_id === mp.myUserId);
	const opp = players.find((p) => p.user_id !== mp.myUserId);

	if (me) {
		mp.myDisplayName = me.display_name;
		mp.myIsReady = me.is_ready;
		mp.myPlacedCount = me.placed_count;
		mp.roundWins.my = me.round_wins;
	}
	if (opp) {
		mp.opponentUserId = opp.user_id;
		mp.opponentDisplayName = opp.display_name;
		mp.opponentIsReady = opp.is_ready;
		mp.opponentPlacedCount = opp.placed_count;
		mp.roundWins.opponent = opp.round_wins;
	}
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

	if (mp.phase !== prevPhase) {
		onPhaseTransition(prevPhase, mp.phase);
	}
}

function handlePlayersChange(payload: { new: Record<string, unknown> }): void {
	const row = payload.new as GamePlayerRow;
	if (row.user_id === mp.myUserId) {
		mp.myIsReady = row.is_ready;
		mp.myPlacedCount = row.placed_count;
		mp.roundWins.my = row.round_wins;
	} else {
		mp.opponentUserId = row.user_id;
		mp.opponentDisplayName = row.display_name;
		mp.opponentIsReady = row.is_ready;
		mp.opponentPlacedCount = row.placed_count;
		mp.roundWins.opponent = row.round_wins;

		// Update players list
		const existing = mp.players.find((p) => p.userId === row.user_id);
		if (existing) {
			existing.displayName = row.display_name;
		} else {
			mp.players = [
				...mp.players,
				{ userId: row.user_id, displayName: row.display_name, playerIndex: row.player_index }
			];
		}
	}

	// Host orchestration: both ready → trigger reveal
	if (
		isHost() &&
		mp.phase === 'placement' &&
		mp.myIsReady &&
		mp.opponentIsReady &&
		mp.gameId
	) {
		db.updatePhase(mp.gameId, 'revealing').catch(console.error);
	}
}

function handleGroupsChange(payload: {
	eventType: string;
	new: Record<string, unknown>;
	old: Record<string, unknown>;
}): void {
	if (payload.eventType === 'DELETE') {
		const localId = payload.old.group_local_id as string;
		mp.groups = mp.groups.filter((g) => g.id !== localId);
	} else {
		// INSERT or UPDATE
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
	mp.tileResults = row.tile_results as TileResult[];
	mp.groupResults = row.group_results as GroupResult[];

	// Host already updated roundWins and DB in runResolution.
	// Guest: derive the round winner from player_tile_wins and update own state + DB row.
	// RLS prevents the host from updating the guest's game_players row, so the guest
	// must call updatePlayerRoundWins for themselves here.
	if (isHost() || !mp.myUserId || !mp.opponentUserId || !mp.gameId) return;

	const wins = row.player_tile_wins as Record<string, number>;
	const myTileWins = wins[mp.myUserId] ?? 0;
	const oppTileWins = wins[mp.opponentUserId] ?? 0;

	if (myTileWins > oppTileWins) {
		// Guest won (strictly more tiles — host wins ties to match runResolution's >= rule)
		mp.roundWins.my = mp.roundWins.my + 1;
		db.updatePlayerRoundWins(mp.gameId, mp.myUserId, mp.roundWins.my).catch(console.error);
	} else {
		// Host won (or tied — host takes the win)
		mp.roundWins.opponent = mp.roundWins.opponent + 1;
	}
}

// ── Phase transition side-effects ──────────────────────────────────────────────

function onPhaseTransition(from: MultiplayerPhase, to: MultiplayerPhase): void {
	if (to === 'revealing' && isHost()) {
		runResolution().catch(console.error);
	}

	if (to === 'placement') {
		// New round starting
		if (mp.gameId) {
			mp.myPlacements = {};
			mp.opponentPlacements = null;
			mp.myIsReady = false;
			mp.opponentIsReady = false;
			mp.myPlacedCount = 0;
			mp.opponentPlacedCount = 0;
			mp.selectedCard = null;
			mp.gerrySelectedTileId = null;
			// Don't clear groups here — they were set during gerrymandering
			mp.myHand = buildHand('human');
			db.resetReadyStatus(mp.gameId).catch(console.error);
		}
	}

	if (to === 'gerrymandering') {
		mp.gerrySelectedTileId = null;
		// Pre-populate with previous round's groups as starting point.
		// The gerrymanderer writes them to DB for the new round; spectator sees via Realtime.
		if (mp.groups.length > 0 && mp.gameId && isGerrymanderer()) {
			for (const group of mp.groups) {
				db.writeGroup(mp.gameId, mp.roundNumber, group).catch(console.error);
			}
		}
		// If no previous groups, mp.groups stays empty — that's correct for round 2
	}
}

// ── Host resolution ────────────────────────────────────────────────────────────

async function runResolution(): Promise<void> {
	if (!mp.gameId || !mp.myUserId || !mp.opponentUserId) return;

	const rows = await db.getCardPlacements(mp.gameId, mp.roundNumber);

	const myRaw = rows.filter((r) => r.user_id === mp.myUserId);
	const oppRaw = rows.filter((r) => r.user_id === mp.opponentUserId);

	const myPlacements: Record<number, Card> = Object.fromEntries(
		myRaw.map((r) => [r.tile_id, r.card_json])
	);
	const opponentPlacements: Record<number, Card> = Object.fromEntries(
		oppRaw.map((r) => [r.tile_id, r.card_json])
	);
	const cpuMap = new Map<number, Card>(
		oppRaw.map((r) => [r.tile_id, r.card_json])
	);

	// Update local state so the board shows opponent cards immediately
	mp.myPlacements = myPlacements;
	mp.opponentPlacements = opponentPlacements;

	// Shim prev RoundState shape for entrenchment detection
	const last = mp.history[mp.history.length - 1] ?? null;
	const fakePrev = last
		? {
				humanPlacements: last.myPlacements,
				cpuPlacements: last.opponentPlacements,
				roundNumber: last.roundNumber,
				groups: last.groups,
				results: last.tileResults,
				groupResults: last.groupResults,
				humanTilesWon: 0,
				cpuTilesWon: 0,
				winner: null
			}
		: null;

	const { tileResults, groupResults } = resolveRound(
		myPlacements,
		cpuMap,
		mp.groups,
		fakePrev
	);

	const playerTileWins: Record<string, number> = {
		[mp.myUserId]: tileResults.filter((r) => r.winner === 'human').length,
		[mp.opponentUserId]: tileResults.filter((r) => r.winner === 'cpu').length
	};
	for (const gr of groupResults) {
		if (gr.winner === 'human') playerTileWins[mp.myUserId] += gr.tileIds.length;
		else if (gr.winner === 'cpu') playerTileWins[mp.opponentUserId] += gr.tileIds.length;
	}

	const myTiles = playerTileWins[mp.myUserId];
	const oppTiles = playerTileWins[mp.opponentUserId];
	const winnerUserId = myTiles >= oppTiles ? mp.myUserId : mp.opponentUserId;
	const newWins = (winnerUserId === mp.myUserId ? mp.roundWins.my : mp.roundWins.opponent) + 1;

	// Update local state immediately so the host sees correct results before Realtime arrives
	mp.tileResults = tileResults;
	mp.groupResults = groupResults;
	if (winnerUserId === mp.myUserId) {
		mp.roundWins.my = newWins;
	} else {
		mp.roundWins.opponent = newWins;
	}

	const finalPhase = newWins >= 3 ? 'game_over' : 'resolution';

	await db.writeRoundResults(mp.gameId, mp.roundNumber, tileResults, groupResults, playerTileWins);

	// RLS only allows each player to UPDATE their own game_players row.
	// When the host wins: update own row. When guest wins: skip — the guest
	// will call updatePlayerRoundWins for themselves in handleResultsChange.
	if (winnerUserId === mp.myUserId) {
		await db.updatePlayerRoundWins(mp.gameId, mp.myUserId, newWins);
	}

	await db.updatePhase(mp.gameId, finalPhase);
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
	const displaced = mp.myPlacements[tileId];

	mp.myHand = mp.myHand.filter((c) => c.id !== card.id);
	if (displaced) mp.myHand = [...mp.myHand, displaced];

	mp.myPlacements = { ...mp.myPlacements, [tileId]: card };
	mp.selectedCard = null;
	mp.myPlacedCount = Object.keys(mp.myPlacements).length;

	await db.submitPlacement(mp.gameId, mp.roundNumber, tileId, card);
	if (displaced) await db.removePlacement(mp.gameId, mp.roundNumber, tileId);
	await db.setPlacedCount(mp.gameId, mp.myPlacedCount);
}

export async function unplaceCard(tileId: number): Promise<void> {
	if (!mp.gameId) return;
	const card = mp.myPlacements[tileId];
	if (!card) return;

	const { [tileId]: _removed, ...rest } = mp.myPlacements;
	mp.myPlacements = rest;
	mp.myHand = [...mp.myHand, card];
	mp.myPlacedCount = Object.keys(mp.myPlacements).length;

	await db.removePlacement(mp.gameId, mp.roundNumber, tileId);
	await db.setPlacedCount(mp.gameId, mp.myPlacedCount);
}

export async function setReady(): Promise<void> {
	if (!mp.gameId || mp.myPlacedCount !== 15) return;
	mp.myIsReady = true;
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
			void prev; // suppress unused warning
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

		// Find groups that changed
		for (const g of mp.groups) {
			const was = prevGroups.find((p) => p.id === g.id);
			if (!was || JSON.stringify(was.tileIds) !== JSON.stringify(g.tileIds)) {
				await db.writeGroup(mp.gameId, mp.roundNumber, g);
			}
		}
		// Find groups that were removed (merged away)
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

	// Determine round winner from latest results
	const myTiles =
		mp.tileResults.filter((r) => r.winner === 'human').length +
		mp.groupResults.filter((r) => r.winner === 'human').reduce((s, r) => s + r.tileIds.length, 0);
	const oppTiles =
		mp.tileResults.filter((r) => r.winner === 'cpu').length +
		mp.groupResults.filter((r) => r.winner === 'cpu').reduce((s, r) => s + r.tileIds.length, 0);
	const winnerUserId =
		myTiles >= oppTiles ? (mp.myUserId ?? '') : (mp.opponentUserId ?? '');

	const winCount = winnerUserId === mp.myUserId ? mp.roundWins.my : mp.roundWins.opponent;
	if (winCount >= 3) {
		await db.updatePhase(mp.gameId, 'game_over');
		return;
	}

	// Push current snapshot to history
	mp.history = [
		...mp.history,
		{
			roundNumber: mp.roundNumber,
			myPlacements: mp.myPlacements,
			opponentPlacements: mp.opponentPlacements ?? {},
			groups: mp.groups,
			tileResults: mp.tileResults,
			groupResults: mp.groupResults
		}
	];

	await db.updatePhaseAndGerry(mp.gameId, winnerUserId);
}

export function cleanup(): void {
	if (_channel) {
		supabase.removeChannel(_channel);
		_channel = null;
	}
}
