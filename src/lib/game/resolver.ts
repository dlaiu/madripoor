import type {
	Card,
	GroupResult,
	MPGroupResult,
	MPPlayerScore,
	MPRoundSnapshot,
	MPTileResult,
	PlayerKey,
	RoundState,
	TileGroup,
	TileResult
} from './types.js';

export function rollD6(): number {
	return Math.floor(Math.random() * 6) + 1;
}

export function resolveTile(
	tileId: number,
	humanCard: Card,
	cpuCard: Card,
	humanEntrenched = false,
	cpuEntrenched = false
): TileResult {
	const hBonus = humanEntrenched ? 2 : 0;
	const cBonus = cpuEntrenched ? 2 : 0;

	let humanRoll = rollD6();
	let cpuRoll = rollD6();
	let humanScore = humanCard.charisma * humanRoll + hBonus;
	let cpuScore = cpuCard.charisma * cpuRoll + cBonus;

	if (humanScore === cpuScore) {
		humanRoll = rollD6();
		cpuRoll = rollD6();
		humanScore = humanCard.charisma * humanRoll + hBonus;
		cpuScore = cpuCard.charisma * cpuRoll + cBonus;
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
		const hE = detectEntrenchment(tileId, 'human', humanCard as Card, prev);
		const cE = detectEntrenchment(tileId, 'cpu', cpuCard, prev);
		tileResults.push(resolveTile(tileId, humanCard as Card, cpuCard, hE, cE));
	}

	const groupResults: GroupResult[] = groups.map((group) =>
		resolveGroup(group, humanPlacements, cpuPlacements, prev)
	);

	return { tileResults, groupResults };
}

// ── N-player resolver (multiplayer) ───────────────────────────────────────────

function resolveTileMP(
	tileId: number,
	placements: Map<string, Card>, // userId -> Card
	entrenchBonuses: Record<string, boolean> = {}
): MPTileResult {
	const userIds = [...placements.keys()];

	// Roll for everyone
	let rolls: Record<string, number> = {};
	for (const uid of userIds) rolls[uid] = rollD6();

	let scores: Record<string, MPPlayerScore> = {};
	const computeScores = () => {
		scores = {};
		for (const uid of userIds) {
			const card = placements.get(uid)!;
			const bonus = entrenchBonuses[uid] ? 2 : 0;
			scores[uid] = { card, roll: rolls[uid], score: card.charisma * rolls[uid] + bonus };
		}
	};
	computeScores();

	// Re-roll tied top scorers until a unique winner emerges
	const getWinner = (): string | null => {
		const max = Math.max(...Object.values(scores).map((s) => s.score));
		const tied = userIds.filter((uid) => scores[uid].score === max);
		return tied.length === 1 ? tied[0] : null;
	};

	while (getWinner() === null) {
		const max = Math.max(...Object.values(scores).map((s) => s.score));
		const tied = userIds.filter((uid) => scores[uid].score === max);
		for (const uid of tied) rolls[uid] = rollD6();
		computeScores();
	}

	return { tileId, scores, winner: getWinner()! };
}

function detectEntrenchmentMP(
	tileId: number,
	userId: string,
	card: Card,
	prev: MPRoundSnapshot | null
): boolean {
	if (!prev) return false;
	const prevCard = prev.allPlacements[userId]?.[tileId];
	return prevCard?.id === card.id;
}

function resolveGroupMP(
	group: TileGroup,
	allPlacements: Map<string, Record<number, Card>>,
	prev: MPRoundSnapshot | null
): MPGroupResult {
	const userIds = [...allPlacements.keys()];

	const perTile: MPTileResult[] = group.tileIds.map((tileId) => {
		const tilePlacements = new Map<string, Card>();
		for (const uid of userIds) {
			const card = allPlacements.get(uid)![tileId];
			if (card) tilePlacements.set(uid, card);
		}
		return resolveTileMP(tileId, tilePlacements);
	});

	const computeTotals = (tiles: MPTileResult[]): Record<string, number> => {
		const totals: Record<string, number> = {};
		for (const uid of userIds) totals[uid] = 0;
		for (const tile of tiles) {
			for (const uid of userIds) {
				totals[uid] = (totals[uid] ?? 0) + (tile.scores[uid]?.score ?? 0);
			}
		}
		// Entrenchment: +2 for first entrenched card per player per group
		for (const uid of userIds) {
			const entrenched = group.tileIds.some((id) =>
				detectEntrenchmentMP(id, uid, allPlacements.get(uid)![id], prev)
			);
			if (entrenched) totals[uid] += 2;
		}
		return totals;
	};

	let totals = computeTotals(perTile);

	const getWinner = (t: Record<string, number>): string | null => {
		const max = Math.max(...Object.values(t));
		const tied = userIds.filter((uid) => t[uid] === max);
		return tied.length === 1 ? tied[0] : null;
	};

	// Re-roll all tiles on group tie
	let finalPerTile = perTile;
	while (getWinner(totals) === null) {
		finalPerTile = group.tileIds.map((tileId) => {
			const tilePlacements = new Map<string, Card>();
			for (const uid of userIds) {
				const card = allPlacements.get(uid)![tileId];
				if (card) tilePlacements.set(uid, card);
			}
			return resolveTileMP(tileId, tilePlacements);
		});
		totals = computeTotals(finalPerTile);
	}

	return { groupId: group.id, tileIds: group.tileIds, totals, perTile: finalPerTile, winner: getWinner(totals)! };
}

export function resolveRoundMP(
	allPlacements: Map<string, Record<number, Card>>, // userId -> tileId -> Card
	groups: TileGroup[],
	prev: MPRoundSnapshot | null
): { tileResults: MPTileResult[]; groupResults: MPGroupResult[] } {
	const groupedTileIds = new Set(groups.flatMap((g) => g.tileIds));
	const userIds = [...allPlacements.keys()];

	// Find tile IDs from the first player's placements (all players place on all tiles)
	const firstPlayerPlacements = allPlacements.get(userIds[0]) ?? {};
	const allTileIds = Object.keys(firstPlayerPlacements).map(Number);

	const tileResults: MPTileResult[] = [];
	for (const tileId of allTileIds) {
		if (groupedTileIds.has(tileId)) continue;
		const tilePlacements = new Map<string, Card>();
		const entrenchBonuses: Record<string, boolean> = {};
		for (const uid of userIds) {
			const card = allPlacements.get(uid)![tileId];
			if (card) {
				tilePlacements.set(uid, card);
				entrenchBonuses[uid] = detectEntrenchmentMP(tileId, uid, card, prev);
			}
		}
		tileResults.push(resolveTileMP(tileId, tilePlacements, entrenchBonuses));
	}

	const groupResults: MPGroupResult[] = groups.map((group) =>
		resolveGroupMP(group, allPlacements, prev)
	);

	return { tileResults, groupResults };
}
