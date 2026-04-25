import type { Card, PlayerKey, TileResult } from './types.js';

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

export function resolveRound(
	humanPlacements: Record<number, Card>,
	cpuPlacements: Map<number, Card>
): TileResult[] {
	const results: TileResult[] = [];
	for (const [key, humanCard] of Object.entries(humanPlacements)) {
		const tileId = Number(key);
		const cpuCard = cpuPlacements.get(tileId)!;
		results.push(resolveTile(tileId, humanCard as Card, cpuCard));
	}
	return results;
}
