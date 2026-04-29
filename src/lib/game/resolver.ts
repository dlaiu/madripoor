import type {
	Card,
	CardColor,
	GroupResult,
	MPGroupResult,
	MPPlayerScore,
	MPRoundSnapshot,
	MPTileResult,
	PlayerKey,
	ResolverContext,
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

// Phase 5: compute flat ability score bonuses (passive abilities)
export function computeAbilityScoreBonus(
	card: Card,
	tileId: number,
	tileColor: CardColor | null,
	isSolo: boolean,
	allCardsInGroup: Card[], // all cards in this tile's group from all players
	hasPartyLeaderPenalty: boolean
): number {
	let bonus = 0;

	// Party Leader: always +2 flat (regardless of CHA penalty)
	if (card.type === 'party_leader') {
		bonus += 2;
	}

	// Mr. Popular has NO Hometown or Independent bonus
	if (card.ability === 'mr_popular') {
		return bonus;
	}

	// Hometown: +2 if card.color === tile's fixed color
	if (card.ability === 'hometown' && tileColor !== null && card.color === tileColor) {
		bonus += 2;
	}

	// Independent: +2 if tile is solo (not in any group)
	if (card.ability === 'independent' && isSolo) {
		bonus += 2;
	}

	// Coalition: +2 if in a group AND there is at least 1 card of a different color in the group
	if (card.ability === 'coalition' && !isSolo) {
		const hasDifferentColor = allCardsInGroup.some((c) => c.color !== card.color);
		if (hasDifferentColor) {
			bonus += 2;
		}
	}

	return bonus;
}

// Phase 4 dice logic: roll 1d6 or apply Pollster (2d6 keep higher)
// Returns the final die value for a player, given dice modifiers.
function rollWithModifiers(
	hasPollster: boolean,
	hasDisadvantage: boolean // opponent has Disadvantage on this tile
): number {
	if (hasPollster && !hasDisadvantage) {
		// Pollster: 2d6 keep higher
		const r1 = rollD6();
		const r2 = rollD6();
		return Math.max(r1, r2);
	}
	// Normal 1d6 (Pollster negated by Disadvantage, or no Pollster)
	return rollD6();
}

// For a player subjected to Disadvantage: reroll their 1d6 and take the lower value
function applyDisadvantage(currentRoll: number): number {
	const reroll = rollD6();
	return Math.min(currentRoll, reroll);
}

function resolveTileMP(
	tileId: number,
	placements: Map<string, Card>, // userId -> Card
	entrenchBonuses: Record<string, boolean> = {},
	options: {
		tileColor?: CardColor | null;
		abilityBonuses?: Record<string, number>; // precomputed per-player bonuses from caller
		underdogActive?: boolean;
	} = {}
): MPTileResult {
	const userIds = [...placements.keys()];
	const { tileColor = null, abilityBonuses = {}, underdogActive = false } = options;

	// Phase 4: detect Pollster and Disadvantage on this tile
	const hasPollster: Record<string, boolean> = {};
	const playerHasDisadvantageOpponent: Record<string, boolean> = {};

	for (const uid of userIds) {
		const card = placements.get(uid)!;
		hasPollster[uid] = card.ability === 'pollster';
		// A player's Pollster is negated if ANY opponent on same tile has Disadvantage
		// A player is disadvantaged if ANY opponent (not themselves) has Disadvantage on this tile
		const opponentHasDisadvantage = userIds
			.filter((other) => other !== uid)
			.some((other) => placements.get(other)!.ability === 'disadvantage');
		playerHasDisadvantageOpponent[uid] = opponentHasDisadvantage;
	}

	// Roll for everyone (Phase 4)
	let rolls: Record<string, number> = {};
	for (const uid of userIds) {
		rolls[uid] = rollWithModifiers(hasPollster[uid], playerHasDisadvantageOpponent[uid]);
	}

	// Apply Disadvantage reroll: players who have an opponent with Disadvantage reroll and take lower
	// (but only if they are NOT themselves the Disadvantage holder)
	for (const uid of userIds) {
		if (playerHasDisadvantageOpponent[uid]) {
			// They must reroll and take lower
			rolls[uid] = applyDisadvantage(rolls[uid]);
		}
	}

	// Build compute scores closure (Phase 5)
	let scores: Record<string, MPPlayerScore> = {};
	const computeScores = () => {
		scores = {};
		for (const uid of userIds) {
			const card = placements.get(uid)!;
			const entrenchBonus = (!underdogActive && entrenchBonuses[uid]) ? 2 : 0;
			const abilityBonus = abilityBonuses[uid] ?? 0;
			scores[uid] = {
				card,
				roll: rolls[uid],
				score: card.charisma * rolls[uid] + entrenchBonus + abilityBonus
			};
		}
	};
	computeScores();

	// Re-roll tied top scorers until a unique winner emerges (Phase 6 tie reroll — Phase 4 re-applies)
	const getWinner = (): string | null => {
		const max = Math.max(...Object.values(scores).map((s) => s.score));
		const tied = userIds.filter((uid) => scores[uid].score === max);
		return tied.length === 1 ? tied[0] : null;
	};

	while (getWinner() === null) {
		const max = Math.max(...Object.values(scores).map((s) => s.score));
		const tied = userIds.filter((uid) => scores[uid].score === max);
		// Phase 4 re-applies on tie reroll
		for (const uid of tied) {
			rolls[uid] = rollWithModifiers(hasPollster[uid], playerHasDisadvantageOpponent[uid]);
		}
		// Apply Disadvantage reroll for tied players
		for (const uid of tied) {
			if (playerHasDisadvantageOpponent[uid]) {
				rolls[uid] = applyDisadvantage(rolls[uid]);
			}
		}
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

// Phase 3: Underdog check — returns true if underdogActive for this tile/group
// underdogActive means: any Underdog player on this tile did NOT win it in prev round
function checkUnderdogActive(
	tileIds: number[],
	allPlacements: Map<string, Record<number, Card>>,
	prev: MPRoundSnapshot | null,
	isTileLevel: boolean, // true = solo tile, false = group
	tileIdForSolo?: number
): boolean {
	if (!prev) return false;

	const userIds = [...allPlacements.keys()];

	for (const uid of userIds) {
		const userPlacementsMap = allPlacements.get(uid)!;
		// Check if this user has an Underdog card on any of the relevant tiles
		const hasUnderdogOnTile = tileIds.some((tid) => {
			const card = userPlacementsMap[tid];
			return card?.ability === 'underdog';
		});

		if (!hasUnderdogOnTile) continue;

		// Did this user win in prev round?
		let prevWinner: string | null = null;
		if (isTileLevel && tileIdForSolo !== undefined) {
			const prevTileResult = prev.tileResults.find((tr) => tr.tileId === tileIdForSolo);
			prevWinner = prevTileResult?.winner ?? null;
		} else {
			// Group level: find the group result in prev that contains these tile IDs
			const prevGroupResult = prev.groupResults.find((gr) =>
				tileIds.every((tid) => gr.tileIds.includes(tid))
			);
			prevWinner = prevGroupResult?.winner ?? null;
		}

		// If underdog player did NOT win in prev → underdogActive
		if (prevWinner !== uid) {
			return true;
		}
	}

	return false;
}

function resolveGroupMP(
	group: TileGroup,
	allPlacements: Map<string, Record<number, Card>>,
	prev: MPRoundSnapshot | null,
	ctx: ResolverContext = { coloredTileColors: {}, hardWorkerLevels: {}, playerHands: {} }
): MPGroupResult {
	const userIds = [...allPlacements.keys()];

	// Phase 3: Underdog check for this group
	const underdogActive = checkUnderdogActive(group.tileIds, allPlacements, prev, false);

	// Collect all cards in this group (all players, all tiles) for Coalition check
	const allCardsInGroup: Card[] = [];
	for (const uid of userIds) {
		for (const tid of group.tileIds) {
			const card = allPlacements.get(uid)![tid];
			if (card) allCardsInGroup.push(card);
		}
	}

	const perTile: MPTileResult[] = group.tileIds.map((tileId) => {
		const tilePlacements = new Map<string, Card>();
		const tileEntrenchBonuses: Record<string, boolean> = {};
		const tileAbilityBonuses: Record<string, number> = {};

		for (const uid of userIds) {
			const card = allPlacements.get(uid)![tileId];
			if (card) {
				tilePlacements.set(uid, card);
				tileEntrenchBonuses[uid] = detectEntrenchmentMP(tileId, uid, card, prev);
				const tileColor = ctx.coloredTileColors[tileId] ?? null;
				// hasPartyLeaderPenalty is computed at resolveRoundMP level; pass false here
				// (penalty is applied via CHA override before this point in Phase 2)
				tileAbilityBonuses[uid] = computeAbilityScoreBonus(
					card,
					tileId,
					tileColor,
					false, // isSolo = false (in a group)
					allCardsInGroup,
					false // hasPartyLeaderPenalty — already applied via CHA override
				);
			}
		}

		return resolveTileMP(tileId, tilePlacements, tileEntrenchBonuses, {
			tileColor: ctx.coloredTileColors[tileId] ?? null,
			abilityBonuses: tileAbilityBonuses,
			underdogActive
		});
	});

	const computeTotals = (tiles: MPTileResult[]): Record<string, number> => {
		const totals: Record<string, number> = {};
		for (const uid of userIds) totals[uid] = 0;
		for (const tile of tiles) {
			for (const uid of userIds) {
				totals[uid] = (totals[uid] ?? 0) + (tile.scores[uid]?.score ?? 0);
			}
		}
		// Entrenchment: +2 for first entrenched card per player per group (negated by Underdog)
		if (!underdogActive) {
			for (const uid of userIds) {
				const entrenched = group.tileIds.some((id) =>
					detectEntrenchmentMP(id, uid, allPlacements.get(uid)![id], prev)
				);
				if (entrenched) totals[uid] += 2;
			}
		}
		return totals;
	};

	let totals = computeTotals(perTile);

	const getWinner = (t: Record<string, number>): string | null => {
		const max = Math.max(...Object.values(t));
		const tied = userIds.filter((uid) => t[uid] === max);
		return tied.length === 1 ? tied[0] : null;
	};

	// Re-roll all tiles on group tie (Phase 4 re-applies inside resolveTileMP)
	let finalPerTile = perTile;
	while (getWinner(totals) === null) {
		finalPerTile = group.tileIds.map((tileId) => {
			const tilePlacements = new Map<string, Card>();
			const tileEntrenchBonuses: Record<string, boolean> = {};
			const tileAbilityBonuses: Record<string, number> = {};

			for (const uid of userIds) {
				const card = allPlacements.get(uid)![tileId];
				if (card) {
					tilePlacements.set(uid, card);
					tileEntrenchBonuses[uid] = detectEntrenchmentMP(tileId, uid, card, prev);
					const tileColor = ctx.coloredTileColors[tileId] ?? null;
					tileAbilityBonuses[uid] = computeAbilityScoreBonus(
						card,
						tileId,
						tileColor,
						false,
						allCardsInGroup,
						false
					);
				}
			}

			return resolveTileMP(tileId, tilePlacements, tileEntrenchBonuses, {
				tileColor: ctx.coloredTileColors[tileId] ?? null,
				abilityBonuses: tileAbilityBonuses,
				underdogActive
			});
		});
		totals = computeTotals(finalPerTile);
	}

	return { groupId: group.id, tileIds: group.tileIds, totals, perTile: finalPerTile, winner: getWinner(totals)! };
}

export function resolveRoundMP(
	allPlacements: Map<string, Record<number, Card>>, // userId -> tileId -> Card
	groups: TileGroup[],
	prev: MPRoundSnapshot | null,
	ctx: ResolverContext = { coloredTileColors: {}, hardWorkerLevels: {}, playerHands: {} }
): { tileResults: MPTileResult[]; groupResults: MPGroupResult[]; hardWorkerEscalations: Record<string, number> } {
	const groupedTileIds = new Set(groups.flatMap((g) => g.tileIds));
	const userIds = [...allPlacements.keys()];

	// Phase 2: Compute Party Leader penalty set
	// A player has the PL penalty if they own ≥2 Party Leaders (hand + placed cards)
	const partyLeaderPenaltyUsers = new Set<string>();
	for (const uid of userIds) {
		const hand = ctx.playerHands[uid] ?? [];
		const placed = Object.values(allPlacements.get(uid) ?? {});
		const plCount = [...hand, ...placed].filter((c) => c.type === 'party_leader').length;
		if (plCount >= 2) partyLeaderPenaltyUsers.add(uid);
	}

	// Phase 2: Apply Hard Worker CHA override and Party Leader CHA penalty
	// We work on copies so original placements map is not mutated
	const effectivePlacements = new Map<string, Record<number, Card>>();
	for (const uid of userIds) {
		const originalTiles = allPlacements.get(uid)!;
		const effectiveTiles: Record<number, Card> = {};
		for (const [tidStr, card] of Object.entries(originalTiles)) {
			const tileId = Number(tidStr);
			let effectiveCard = { ...card };

			// Hard Worker CHA override
			if (card.ability === 'hard_worker') {
				const key = `${card.id}:${tileId}`;
				if (ctx.hardWorkerLevels[key] !== undefined) {
					effectiveCard = { ...effectiveCard, charisma: ctx.hardWorkerLevels[key] as 1 | 2 | 3 };
				}
			}

			// Party Leader CHA penalty: override to CHA1 if player has ≥2 PLs
			if (card.type === 'party_leader' && partyLeaderPenaltyUsers.has(uid)) {
				effectiveCard = { ...effectiveCard, charisma: 1 };
			}

			effectiveTiles[tileId] = effectiveCard;
		}
		effectivePlacements.set(uid, effectiveTiles);
	}

	// Find tile IDs from the first player's placements (all players place on all tiles)
	const firstPlayerPlacements = effectivePlacements.get(userIds[0]) ?? {};
	const allTileIds = Object.keys(firstPlayerPlacements).map(Number);

	const tileResults: MPTileResult[] = [];
	for (const tileId of allTileIds) {
		if (groupedTileIds.has(tileId)) continue;

		// Phase 3: Underdog check for this solo tile
		const tilePlacementsForUnderdog = new Map<string, Record<number, Card>>();
		for (const uid of userIds) {
			tilePlacementsForUnderdog.set(uid, effectivePlacements.get(uid)!);
		}
		const underdogActive = checkUnderdogActive([tileId], tilePlacementsForUnderdog, prev, true, tileId);

		const tilePlacements = new Map<string, Card>();
		const entrenchBonuses: Record<string, boolean> = {};
		const abilityBonuses: Record<string, number> = {};

		for (const uid of userIds) {
			const card = effectivePlacements.get(uid)![tileId];
			if (card) {
				tilePlacements.set(uid, card);
				entrenchBonuses[uid] = detectEntrenchmentMP(tileId, uid, card, prev);
				const tileColor = ctx.coloredTileColors[tileId] ?? null;
				const hasPartyLeaderPenalty = partyLeaderPenaltyUsers.has(uid);
				// isSolo = true since this tile is not in a group
				abilityBonuses[uid] = computeAbilityScoreBonus(
					card,
					tileId,
					tileColor,
					true, // isSolo
					[], // no group cards for solo tile
					hasPartyLeaderPenalty
				);
			}
		}

		tileResults.push(resolveTileMP(tileId, tilePlacements, entrenchBonuses, {
			tileColor: ctx.coloredTileColors[tileId] ?? null,
			abilityBonuses,
			underdogActive
		}));
	}

	const groupResults: MPGroupResult[] = groups.map((group) =>
		resolveGroupMP(group, effectivePlacements, prev, ctx)
	);

	// Phase 7: Compute Hard Worker escalations
	// For each Hard Worker card: if it was on the SAME tile as in prev AND the tile/group was LOST
	// by the HW owner → CHA++ (max 3). If HW moved tiles → reset (key not present = start fresh).
	const hardWorkerEscalations: Record<string, number> = { ...ctx.hardWorkerLevels };

	for (const uid of userIds) {
		const tiles = allPlacements.get(uid)!;
		for (const [tidStr, card] of Object.entries(tiles)) {
			if (card.ability !== 'hard_worker') continue;
			const tileId = Number(tidStr);
			const key = `${card.id}:${tileId}`;

			// Check if the card was on the same tile in prev round (same card id on same tile)
			const prevCard = prev?.allPlacements[uid]?.[tileId];
			const wasOnSameTile = prevCard?.id === card.id;

			if (!wasOnSameTile) {
				// Hard Worker moved tiles or is new — reset to CHA1 (remove key)
				delete hardWorkerEscalations[key];
				continue;
			}

			// Determine if HW owner won this tile/group
			const inGroup = groupedTileIds.has(tileId);
			let ownerWon = false;

			if (inGroup) {
				const groupResult = groupResults.find((gr) => gr.tileIds.includes(tileId));
				ownerWon = groupResult?.winner === uid;
			} else {
				const tileResult = tileResults.find((tr) => tr.tileId === tileId);
				ownerWon = tileResult?.winner === uid;
			}

			if (!ownerWon) {
				// Lost tile: escalate CHA (max 3)
				const currentCha = hardWorkerEscalations[key] ?? (card.charisma as number);
				hardWorkerEscalations[key] = Math.min(3, currentCha + 1);
			}
			// If won: no change to escalation level
		}
	}

	return { tileResults, groupResults, hardWorkerEscalations };
}
