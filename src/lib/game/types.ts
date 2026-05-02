export type CardColor = 'red' | 'blue' | 'green';
export type PlayerKey = 'human' | 'cpu';
export type GamePhase =
	| 'placement'
	| 'scouting'
	| 'revealing'
	| 'resolution'
	| 'round_end'
	| 'card_buying'
	| 'gerrymandering'
	| 'game_over';

export type CardAbility =
	| 'hometown'
	| 'pollster'
	| 'hard_worker'
	| 'scout'
	| 'independent'
	| 'mr_popular'
	| 'disadvantage'
	| 'coalition'
	| 'underdog'
	| 'none';

export interface Card {
	id: string;
	owner: PlayerKey;
	color: CardColor;
	charisma: 1 | 2 | 3 | 4; // CHA4 exists only on Mr. Popular
	type: 'party_leader' | 'generic';
	ability: CardAbility;
}

// Passed to the resolver to apply ability logic without changing the base pipeline
export interface ResolverContext {
	coloredTileColors: Record<number, CardColor>; // tile id -> fixed color
	hardWorkerLevels: Record<string, number>; // "cardId:tileId" -> current CHA (missing = CHA1)
	playerHands: Record<string, Card[]>; // userId -> hand (for Party Leader penalty check)
}

export interface TileGroup {
	id: string;
	tileIds: number[];
}

export interface ScoreBonuses {
	ability: number;
	entrench: number;
	rollType: 'pollster' | 'disadvantage' | 'normal';
	abilityLabel?: string;
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
	humanBonuses?: ScoreBonuses;
	cpuBonuses?: ScoreBonuses;
}

export interface GroupResult {
	groupId: string;
	tileIds: number[];
	humanTotalScore: number;
	cpuTotalScore: number;
	perTile: TileResult[];
	winner: PlayerKey | 'tie';
	humanEntrenchBonus?: number;
	cpuEntrenchBonus?: number;
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
	drawPile: Card[];
	cardStore: (Card | null)[];
	hardWorkerLevels: Record<string, number>;
	mrPopularPending: { tileId: number; card: Card } | null;
	humanSwapsUsed: number;
	humanMaxSwaps: number;
	soloScoutState: {
		humanScoutTileId: number;
		peekedCard: Card;           // CPU card on the scout's tile (shown immediately)
		swapTargetTileId: number | null; // human's other tile they want to move scout to
	} | null;
}

// ── Multiplayer types ──────────────────────────────────────────────────────────

export type MultiplayerPhase =
	| 'lobby'
	| 'placement'
	| 'scouting'
	| 'revealing'
	| 'resolution'
	| 'round_end'
	| 'card_buying'
	| 'gerrymandering'
	| 'game_over';

// N-player result types (multiplayer only; solo still uses TileResult/GroupResult)
export interface MPPlayerScore {
	card: Card;
	roll: number;
	score: number;
	bonuses?: {
		ability: number;                                       // from computeAbilityScoreBonus
		entrench: number;                                      // 0 or 2 (solo tiles only)
		rollType: 'pollster' | 'disadvantage' | 'normal';
		abilityLabel?: string;                                 // e.g. 'Hometown', 'Coalition'
	};
}

export interface MPTileResult {
	tileId: number;
	scores: Record<string, MPPlayerScore>; // keyed by userId
	winner: string;                         // userId of winner
	underdogActive?: boolean;
}

export interface MPGroupResult {
	groupId: string;
	tileIds: number[];
	totals: Record<string, number>;         // userId -> total group score
	perTile: MPTileResult[];
	winner: string;                         // userId of winner
	groupEntrenchBonuses?: Record<string, number>; // userId -> 2 if entrenched (0 if not/underdog)
	underdogActive?: boolean;
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
	hard_worker_levels_json: Record<string, number> | null;
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
	scout_done: boolean;
	scout_swap: { scoutTileId: number; targetTileId: number; actorUserId: string } | null;
	created_at: string;
}

export interface CardPlacementRow {
	id: string;
	game_id: string;
	round_number: number;
	user_id: string;
	tile_id: number;
	card_json: Card;
	declared_color: CardColor | null;
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
