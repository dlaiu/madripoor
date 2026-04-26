export type CardColor = 'red' | 'blue' | 'green';
export type PlayerKey = 'human' | 'cpu';
export type GamePhase = 'placement' | 'revealing' | 'resolution' | 'round_end' | 'gerrymandering' | 'game_over';

export interface Card {
	id: string;
	owner: PlayerKey;
	color: CardColor;
	charisma: 1 | 2 | 3;
	type: 'party_leader' | 'generic';
}

export interface TileGroup {
	id: string;
	tileIds: number[];
}

export interface TileResult {
	tileId: number;
	humanCard: Card;
	cpuCard: Card;
	humanRoll: number;
	humanScore: number;
	cpuRoll: number;
	cpuScore: number;
	winner: PlayerKey | 'tie';
}

export interface GroupResult {
	groupId: string;
	tileIds: number[];
	humanTotalScore: number;
	cpuTotalScore: number;
	perTile: TileResult[];
	winner: PlayerKey | 'tie';
}

export interface RoundState {
	roundNumber: number;
	groups: TileGroup[];
	humanPlacements: Record<number, Card>;
	cpuPlacements: Record<number, Card>;
	results: TileResult[];
	groupResults: GroupResult[];
	humanTilesWon: number;
	cpuTilesWon: number;
	winner: PlayerKey | null;
}

export interface GameState {
	phase: GamePhase;
	roundWins: Record<PlayerKey, number>;
	humanHand: Card[];
	cpuHand: Card[];
	selectedCard: Card | null;
	currentRound: RoundState;
	history: RoundState[];
	gerrySelectedTileId: number | null;
}

// ── Multiplayer types ──────────────────────────────────────────────────────────

export type MultiplayerPhase =
	| 'lobby' | 'placement' | 'revealing' | 'resolution'
	| 'round_end' | 'gerrymandering' | 'game_over';

export interface MultiplayerRoundSnapshot {
	roundNumber: number;
	myPlacements: Record<number, Card>;
	opponentPlacements: Record<number, Card>;
	groups: TileGroup[];
	tileResults: TileResult[];
	groupResults: GroupResult[];
}

// DB row shapes (returned from Supabase queries)
export interface GameRow {
	id: string;
	room_code: string;
	phase: MultiplayerPhase;
	round_number: number;
	gerry_player_id: string | null;
	created_at: string;
}

export interface GamePlayerRow {
	id: string;
	game_id: string;
	user_id: string;
	display_name: string;
	player_index: 0 | 1;
	round_wins: number;
	placed_count: number;
	is_ready: boolean;
	created_at: string;
}

export interface CardPlacementRow {
	id: string;
	game_id: string;
	round_number: number;
	user_id: string;
	tile_id: number;
	card_json: Card;
	created_at: string;
}

export interface RoundGroupRow {
	id: string;
	game_id: string;
	round_number: number;
	group_local_id: string;
	tile_ids: number[];
	created_at: string;
}

export interface RoundResultRow {
	id: string;
	game_id: string;
	round_number: number;
	tile_results: TileResult[];
	group_results: GroupResult[];
	player_tile_wins: Record<string, number>;
	created_at: string;
}
