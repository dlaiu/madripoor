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
