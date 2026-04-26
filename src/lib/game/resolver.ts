import type { Card, GroupResult, PlayerKey, RoundState, TileGroup, TileResult } from './types.js';

export function rollD6(): number {
	return Math.floor(Math.random() * 6) + 1;
}

export function resolveTile(tileId: number, humanCard: Card, cpuCard: Card): TileResult {
	let humanRoll = rollD6();
	let cpuRoll = rollD6();
	let humanScore = humanCard.charisma * humanRoll;
	let cpuScore = cpuCard.charisma * cpuRoll;

	if (humanScore === cpuScore) {
		humanRoll = rollD6();
		cpuRoll = rollD6();
		humanScore = humanCard.charisma * humanRoll;
		cpuScore = cpuCard.charisma * cpuRoll;
	}

	let winner: PlayerKey | 'tie';
	if (humanScore > cpuScore) winner = 'human';
	else if (cpuScore > humanScore) winner = 'cpu';
	else winner = 'tie';

	return { tileId, humanCard, cpuCard, humanRoll, humanScore, cpuRoll, cpuScore, winner };
}

export function cpuPlaceCards(cpuHand: Card[], tileIds: number[]): Map<number, Card> {
	const shuffled = [...cpuHand];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return new Map(tileIds.map((id, i) => [id, shuffled[i]]));
}

function detectEntrenchment(
	tileId: number,
	player: PlayerKey,
	card: Card,
	prev: RoundState | null
): boolean {
	if (!prev) return false;
	const prevCard =
		player === 'human' ? prev.humanPlacements[tileId] : prev.cpuPlacements[tileId];
	return prevCard?.id === card.id;
}

function sumGroupScores(perTile: TileResult[]): { human: number; cpu: number } {
	return perTile.reduce(
		(acc, r) => ({ human: acc.human + r.humanScore, cpu: acc.cpu + r.cpuScore }),
		{ human: 0, cpu: 0 }
	);
}

function resolveGroup(
	group: TileGroup,
	humanPlacements: Record<number, Card>,
	cpuPlacements: Map<number, Card>,
	prev: RoundState | null
): GroupResult {
	const perTile = group.tileIds.map((tileId) =>
		resolveTile(tileId, humanPlacements[tileId], cpuPlacements.get(tileId)!)
	);

	let { human: humanBase, cpu: cpuBase } = sumGroupScores(perTile);

	// Entrenchment: +2 for the first entrenched card per player per group
	const humanEntrenched = group.tileIds.some((id) =>
		detectEntrenchment(id, 'human', humanPlacements[id], prev)
	);
	const cpuEntrenched = group.tileIds.some((id) =>
		detectEntrenchment(id, 'cpu', cpuPlacements.get(id)!, prev)
	);

	const humanTotal = humanBase + (humanEntrenched ? 2 : 0);
	const cpuTotal = cpuBase + (cpuEntrenched ? 2 : 0);

	let winner: PlayerKey | 'tie';
	if (humanTotal > cpuTotal) {
		winner = 'human';
	} else if (cpuTotal > humanTotal) {
		winner = 'cpu';
	} else {
		// Tie-break: re-roll all tiles in the group
		const rerollPerTile = group.tileIds.map((tileId) =>
			resolveTile(tileId, humanPlacements[tileId], cpuPlacements.get(tileId)!)
		);
		const reroll = sumGroupScores(rerollPerTile);
		const humanReroll = reroll.human + (humanEntrenched ? 2 : 0);
		const cpuReroll = reroll.cpu + (cpuEntrenched ? 2 : 0);
		if (humanReroll > cpuReroll) winner = 'human';
		else if (cpuReroll > humanReroll) winner = 'cpu';
		else winner = 'tie';
	}

	return {
		groupId: group.id,
		tileIds: group.tileIds,
		humanTotalScore: humanTotal,
		cpuTotalScore: cpuTotal,
		perTile,
		winner
	};
}

export function resolveRound(
	humanPlacements: Record<number, Card>,
	cpuPlacements: Map<number, Card>,
	groups: TileGroup[],
	prev: RoundState | null
): { tileResults: TileResult[]; groupResults: GroupResult[] } {
	const groupedTileIds = new Set(groups.flatMap((g) => g.tileIds));

	const tileResults: TileResult[] = [];
	for (const [key, humanCard] of Object.entries(humanPlacements)) {
		const tileId = Number(key);
		if (groupedTileIds.has(tileId)) continue;
		const cpuCard = cpuPlacements.get(tileId)!;
		tileResults.push(resolveTile(tileId, humanCard as Card, cpuCard));
	}

	const groupResults: GroupResult[] = groups.map((group) =>
		resolveGroup(group, humanPlacements, cpuPlacements, prev)
	);

	return { tileResults, groupResults };
}
