import { supabase } from './supabase.js';
import { buildDrawPile, coerceCard, shuffleCards } from './game/deckFactory.js';
import type {
	Card,
	CardColor,
	CardPlacementRow,
	GamePlayerRow,
	GameRow,
	GroupResult,
	MPGroupResult,
	MPTileResult,
	RoundGroupRow,
	RoundResultRow,
	TileGroup,
	TileResult
} from './game/types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars

export function generateRoomCode(): string {
	return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function unwrap<T>(result: { data: T | null; error: unknown }): T {
	if (result.error) throw result.error;
	return result.data as T;
}

// ── Auth + Game Creation ───────────────────────────────────────────────────────

export async function createGame(
	displayName: string,
	maxPlayers: 2 | 3 | 4 = 2
): Promise<{ gameId: string; roomCode: string; myUserId: string; myPlayerId: string }> {
	const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
	if (authErr || !authData.user) throw authErr ?? new Error('Auth failed');
	const myUserId = authData.user.id;

	const drawPile = shuffleCards(buildDrawPile());

	// Retry on room code collision (UNIQUE constraint)
	let gameId: string | undefined;
	let roomCode: string | undefined;
	for (let attempt = 0; attempt < 5; attempt++) {
		roomCode = generateRoomCode();
		const res = await supabase
			.from('games')
			.insert({
				room_code: roomCode,
				phase: 'lobby',
				round_number: 1,
				max_players: maxPlayers,
				draw_pile_json: drawPile
			})
			.select('id')
			.single();
		if (!res.error) {
			gameId = res.data.id;
			break;
		}
		if (res.error.code !== '23505') throw res.error; // only retry on unique violation
	}
	if (!gameId || !roomCode) throw new Error('Failed to generate unique room code');

	const playerRes = await supabase
		.from('game_players')
		.insert({ game_id: gameId, user_id: myUserId, display_name: displayName, player_index: 0 })
		.select('id')
		.single();
	const myPlayerId = unwrap(playerRes).id;

	return { gameId, roomCode, myUserId, myPlayerId };
}

export async function joinGame(
	roomCode: string,
	displayName: string
): Promise<{ gameId: string; myUserId: string; myPlayerId: string; myPlayerIndex: number } | { error: string }> {
	const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
	if (authErr || !authData.user) return { error: 'Auth failed' };
	const myUserId = authData.user.id;

	const gameRes = await supabase
		.from('games')
		.select('id, phase, max_players')
		.eq('room_code', roomCode.toUpperCase())
		.single();
	if (gameRes.error || !gameRes.data) return { error: 'Room not found' };
	if (gameRes.data.phase !== 'lobby') return { error: 'Game already started' };
	const gameId = gameRes.data.id;
	const maxPlayers = gameRes.data.max_players ?? 2;

	const existingPlayers = await supabase
		.from('game_players')
		.select('user_id, player_index')
		.eq('game_id', gameId);
	if (existingPlayers.error) return { error: 'Failed to load game' };

	// Already in this game (e.g. page refresh)
	const existing = existingPlayers.data.find((p) => p.user_id === myUserId);
	if (existing) {
		const playerRes = await supabase
			.from('game_players')
			.select('id, player_index')
			.eq('game_id', gameId)
			.eq('user_id', myUserId)
			.single();
		if (playerRes.error) return { error: 'Failed to rejoin' };
		return { gameId, myUserId, myPlayerId: playerRes.data.id, myPlayerIndex: playerRes.data.player_index };
	}

	if (existingPlayers.data.length >= maxPlayers) return { error: 'Game is full' };

	// Assign next available player_index
	const usedIndices = new Set(existingPlayers.data.map((p) => p.player_index));
	let nextIndex = 0;
	while (usedIndices.has(nextIndex)) nextIndex++;

	const playerRes = await supabase
		.from('game_players')
		.insert({ game_id: gameId, user_id: myUserId, display_name: displayName, player_index: nextIndex })
		.select('id')
		.single();
	if (playerRes.error) return { error: 'Failed to join game' };

	return { gameId, myUserId, myPlayerId: playerRes.data.id, myPlayerIndex: nextIndex };
}

// ── Game Queries ───────────────────────────────────────────────────────────────

export async function getGameByRoomCode(roomCode: string): Promise<GameRow | null> {
	const res = await supabase
		.from('games')
		.select('*')
		.eq('room_code', roomCode.toUpperCase())
		.maybeSingle();
	if (res.error) throw res.error;
	return res.data as GameRow | null;
}

export async function getGamePlayers(gameId: string): Promise<GamePlayerRow[]> {
	const res = await supabase.from('game_players').select('*').eq('game_id', gameId);
	return unwrap(res) as GamePlayerRow[];
}

// ── Phase Management ───────────────────────────────────────────────────────────

export async function startGame(gameId: string): Promise<void> {
	unwrap(await supabase.from('games').update({ phase: 'placement' }).eq('id', gameId));
}

export async function updatePhase(gameId: string, phase: string): Promise<void> {
	unwrap(await supabase.from('games').update({ phase }).eq('id', gameId));
}

export async function updatePhaseAndGerry(gameId: string, gerryUserId: string): Promise<void> {
	unwrap(
		await supabase
			.from('games')
			.update({ phase: 'gerrymandering', gerry_player_id: gerryUserId })
			.eq('id', gameId)
	);
}

export async function updateRoundNumber(gameId: string, roundNumber: number): Promise<void> {
	unwrap(await supabase.from('games').update({ round_number: roundNumber }).eq('id', gameId));
}

// ── Placement ─────────────────────────────────────────────────────────────────

export async function submitPlacement(
	gameId: string,
	roundNumber: number,
	tileId: number,
	card: Card,
	declaredColor?: CardColor | null
): Promise<void> {
	unwrap(
		await supabase.from('card_placements').upsert(
			{
				game_id: gameId,
				round_number: roundNumber,
				user_id: (await supabase.auth.getUser()).data.user!.id,
				tile_id: tileId,
				card_json: card,
				declared_color: declaredColor ?? null
			},
			{ onConflict: 'game_id,round_number,user_id,tile_id' }
		)
	);
}

export async function removePlacement(
	gameId: string,
	roundNumber: number,
	tileId: number
): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('card_placements')
			.delete()
			.eq('game_id', gameId)
			.eq('round_number', roundNumber)
			.eq('user_id', userId)
			.eq('tile_id', tileId)
	);
}

export async function setPlacedCount(gameId: string, count: number): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ placed_count: count })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function setReady(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ is_ready: true })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function resetReadyStatus(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ is_ready: false, placed_count: 0, swaps_used: 0, swap_request: null, scout_done: false, scout_swap: null })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function getCardPlacements(
	gameId: string,
	roundNumber: number
): Promise<CardPlacementRow[]> {
	const res = await supabase
		.from('card_placements')
		.select('*')
		.eq('game_id', gameId)
		.eq('round_number', roundNumber);
	const rows = unwrap(res) as CardPlacementRow[];
	// Coerce pre-M6 rows that lack the `ability` field
	return rows.map((r) => ({ ...r, card_json: coerceCard(r.card_json as unknown as Record<string, unknown>) }));
}

// ── Hand persistence ──────────────────────────────────────────────────────────

export async function saveHand(gameId: string, hand: Card[]): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ hand_json: hand })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

// ── Resolution ────────────────────────────────────────────────────────────────

export async function writeRoundResults(
	gameId: string,
	roundNumber: number,
	tileResults: MPTileResult[],
	groupResults: MPGroupResult[],
	playerTileWins: Record<string, number>
): Promise<void> {
	unwrap(
		await supabase.from('round_results').insert({
			game_id: gameId,
			round_number: roundNumber,
			tile_results: tileResults,
			group_results: groupResults,
			player_tile_wins: playerTileWins
		})
	);
}

export async function updatePlayerRoundWins(
	gameId: string,
	userId: string,
	roundWins: number
): Promise<void> {
	unwrap(
		await supabase
			.from('game_players')
			.update({ round_wins: roundWins })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function writeGroup(
	gameId: string,
	roundNumber: number,
	group: TileGroup
): Promise<void> {
	unwrap(
		await supabase.from('round_groups').upsert(
			{
				game_id: gameId,
				round_number: roundNumber,
				group_local_id: group.id,
				tile_ids: group.tileIds
			},
			{ onConflict: 'game_id,round_number,group_local_id' }
		)
	);
}

export async function deleteGroup(
	gameId: string,
	roundNumber: number,
	groupLocalId: string
): Promise<void> {
	unwrap(
		await supabase
			.from('round_groups')
			.delete()
			.eq('game_id', gameId)
			.eq('round_number', roundNumber)
			.eq('group_local_id', groupLocalId)
	);
}

export async function clearGroupsForRound(gameId: string, roundNumber: number): Promise<void> {
	unwrap(
		await supabase
			.from('round_groups')
			.delete()
			.eq('game_id', gameId)
			.eq('round_number', roundNumber)
	);
}

export async function getGroupsForRound(
	gameId: string,
	roundNumber: number
): Promise<RoundGroupRow[]> {
	const res = await supabase
		.from('round_groups')
		.select('*')
		.eq('game_id', gameId)
		.eq('round_number', roundNumber);
	return unwrap(res) as RoundGroupRow[];
}

// ── Card buying ───────────────────────────────────────────────────────────────

export async function initCardBuyingPhase(
	gameId: string,
	firstBuyerUserId: string,
	storeCards: (Card | null)[],
	drawPile: Card[]
): Promise<void> {
	unwrap(
		await supabase
			.from('games')
			.update({
				phase: 'card_buying',
				buying_turn_player_id: firstBuyerUserId,
				card_store_json: storeCards,
				draw_pile_json: drawPile
			})
			.eq('id', gameId)
	);
}

export async function advanceToCardBuying(
	gameId: string,
	gerryUserId: string,
	firstBuyerUserId: string,
	storeCards: (Card | null)[],
	drawPile: Card[]
): Promise<void> {
	unwrap(
		await supabase
			.from('games')
			.update({
				phase: 'card_buying',
				gerry_player_id: gerryUserId,
				buying_turn_player_id: firstBuyerUserId,
				card_store_json: storeCards,
				draw_pile_json: drawPile
			})
			.eq('id', gameId)
	);
}

export async function replenishStoreSlot(
	gameId: string,
	newStore: (Card | null)[],
	newDrawPile: Card[]
): Promise<void> {
	unwrap(
		await supabase
			.from('games')
			.update({ card_store_json: newStore, draw_pile_json: newDrawPile })
			.eq('id', gameId)
	);
}

export async function advanceBuyingTurn(gameId: string, nextUserId: string): Promise<void> {
	unwrap(
		await supabase
			.from('games')
			.update({ buying_turn_player_id: nextUserId })
			.eq('id', gameId)
	);
}

export async function submitBuyAction(
	gameId: string,
	newHand: Card[],
	storePosition: number,
	discardedCardId: string,
	discardedCard: Card
): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	const row = await supabase
		.from('game_players')
		.select('swaps_used')
		.eq('game_id', gameId)
		.eq('user_id', userId)
		.single();
	const swapsUsed = (row.data?.swaps_used ?? 0) + 1;
	unwrap(
		await supabase
			.from('game_players')
			.update({
				hand_json: newHand,
				swaps_used: swapsUsed,
				swap_request: { action: 'buy', storePosition, discardedCardId, discardedCard }
			})
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function passBuyTurn(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ swap_request: { action: 'done' } })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function resetBuyingState(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ swaps_used: 0, swap_request: null })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

// ── Scout phase ───────────────────────────────────────────────────────────────

export async function peekScoutTile(
	gameId: string,
	roundNumber: number,
	tileId: number
): Promise<CardPlacementRow[]> {
	const res = await supabase.rpc('peek_scout_tile', {
		p_game_id: gameId,
		p_round_number: roundNumber,
		p_tile_id: tileId
	});
	const rows = unwrap(res) as CardPlacementRow[];
	return rows.map((r) => ({ ...r, card_json: coerceCard(r.card_json as unknown as Record<string, unknown>) }));
}

export async function submitScoutSwap(
	gameId: string,
	roundNumber: number,
	scoutTileId: number,
	targetTileId: number
): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	// Swap the two card_placements rows for this player
	const rows = unwrap(
		await supabase
			.from('card_placements')
			.select('tile_id, card_json, declared_color')
			.eq('game_id', gameId)
			.eq('round_number', roundNumber)
			.eq('user_id', userId)
			.in('tile_id', [scoutTileId, targetTileId])
	) as { tile_id: number; card_json: unknown; declared_color: string | null }[];

	const scoutRow = rows.find((r) => r.tile_id === scoutTileId);
	const targetRow = rows.find((r) => r.tile_id === targetTileId);
	if (!scoutRow || !targetRow) throw new Error('Scout swap: rows not found');

	// Upsert both swapped positions
	unwrap(
		await supabase.from('card_placements').upsert(
			[
				{ game_id: gameId, round_number: roundNumber, user_id: userId, tile_id: scoutTileId, card_json: targetRow.card_json, declared_color: targetRow.declared_color },
				{ game_id: gameId, round_number: roundNumber, user_id: userId, tile_id: targetTileId, card_json: scoutRow.card_json, declared_color: scoutRow.declared_color }
			],
			{ onConflict: 'game_id,round_number,user_id,tile_id' }
		)
	);

	// Mark scout_swap + scout_done
	unwrap(
		await supabase
			.from('game_players')
			.update({
				scout_swap: { scoutTileId, targetTileId, actorUserId: userId },
				scout_done: true
			})
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function setScoutDone(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ scout_done: true })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}

export async function resetScoutState(gameId: string): Promise<void> {
	const userId = (await supabase.auth.getUser()).data.user!.id;
	unwrap(
		await supabase
			.from('game_players')
			.update({ scout_done: false, scout_swap: null })
			.eq('game_id', gameId)
			.eq('user_id', userId)
	);
}
