import { supabase } from './supabase.js';
import type {
	Card,
	CardPlacementRow,
	GamePlayerRow,
	GameRow,
	GroupResult,
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
	displayName: string
): Promise<{ gameId: string; roomCode: string; myUserId: string; myPlayerId: string }> {
	const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
	if (authErr || !authData.user) throw authErr ?? new Error('Auth failed');
	const myUserId = authData.user.id;

	// Retry on room code collision (UNIQUE constraint)
	let gameId: string | undefined;
	let roomCode: string | undefined;
	for (let attempt = 0; attempt < 5; attempt++) {
		roomCode = generateRoomCode();
		const res = await supabase
			.from('games')
			.insert({ room_code: roomCode, phase: 'lobby', round_number: 1 })
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
): Promise<{ gameId: string; myUserId: string; myPlayerId: string } | { error: string }> {
	const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
	if (authErr || !authData.user) return { error: 'Auth failed' };
	const myUserId = authData.user.id;

	const gameRes = await supabase
		.from('games')
		.select('id, phase')
		.eq('room_code', roomCode.toUpperCase())
		.single();
	if (gameRes.error || !gameRes.data) return { error: 'Room not found' };
	if (gameRes.data.phase !== 'lobby') return { error: 'Game already started' };
	const gameId = gameRes.data.id;

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
			.select('id')
			.eq('game_id', gameId)
			.eq('user_id', myUserId)
			.single();
		if (playerRes.error) return { error: 'Failed to rejoin' };
		return { gameId, myUserId, myPlayerId: playerRes.data.id };
	}

	if (existingPlayers.data.length >= 2) return { error: 'Game is full' };

	const playerRes = await supabase
		.from('game_players')
		.insert({ game_id: gameId, user_id: myUserId, display_name: displayName, player_index: 1 })
		.select('id')
		.single();
	if (playerRes.error) return { error: 'Failed to join game' };

	return { gameId, myUserId, myPlayerId: playerRes.data.id };
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
	card: Card
): Promise<void> {
	unwrap(
		await supabase.from('card_placements').upsert(
			{
				game_id: gameId,
				round_number: roundNumber,
				user_id: (await supabase.auth.getUser()).data.user!.id,
				tile_id: tileId,
				card_json: card
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
			.update({ is_ready: false, placed_count: 0 })
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
	return unwrap(res) as CardPlacementRow[];
}

// ── Resolution ────────────────────────────────────────────────────────────────

export async function writeRoundResults(
	gameId: string,
	roundNumber: number,
	tileResults: TileResult[],
	groupResults: GroupResult[],
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
