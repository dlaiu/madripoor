export type CardColor = 'red' | 'blue' | 'green';
export type PlayerKey = 'human' | 'cpu';
export type GamePhase = 'placement' | 'revealing' | 'resolution' | 'round_end' | 'gerrymandering' | 'game_over';

export interface Card {
	id: string;
	owner: PlayerKey;
	color: CardColor;
	charisma: 1 | 2 | 3 | 4; // CHA4 exists only on Mr. Popular
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
	| 'round_end' | 'card_buying' | 'gerrymandering' | 'game_over';

// N-player result types (multiplayer only; solo still uses TileResult/GroupResult)
export interface MPPlayerScore {
	card: Card;
	roll: number;
	score: number;
}

export interface MPTileResult {
	tileId: number;
	scores: Record<string, MPPlayerScore>; // keyed by userId
	winner: string;                         // userId of winner
}

export interface MPGroupResult {
	groupId: string;
	tileIds: number[];
	totals: Record<string, number>;         // userId -> total group score
	perTile: MPTileResult[];
	winner: string;                         // userId of winner
}

export interface MPRoundSnapshot {
	roundNumber: number;
	allPlacements: Record<string, Record<number, Card>>; // userId -> tileId -> Card
	groups: TileGroup[];
	tileResults: MPTileResult[];
	groupResults: MPGroupResult[];
}

// DB row shapes (returned from Supabase queries)
export interface GameRow {
	id: string;
	room_code: string;
	phase: MultiplayerPhase;
	round_number: number;
	gerry_player_id: string | null;
	max_players: number;
	buying_turn_player_id: string | null;
	card_store_json: (Card | null)[] | null;
	draw_pile_json: Card[] | null;
	created_at: string;
}

export interface GamePlayerRow {
	id: string;
	game_id: string;
	user_id: string;
	display_name: string;
	player_index: number;
	round_wins: number;
	placed_count: number;
	is_ready: boolean;
	hand_json: Card[] | null;
	swaps_used: number;
	swap_request: { action: 'buy' | 'done'; storePosition?: number; discardedCardId?: string; discardedCard?: Card } | null;
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
	tile_results: MPTileResult[];
	group_results: MPGroupResult[];
	player_tile_wins: Record<string, number>;
	created_at: string;
}
