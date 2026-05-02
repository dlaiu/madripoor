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
	cpuEntrenched = false,
	humanAbilityBonus = 0,
	cpuAbilityBonus = 0,
	humanAbilityLabel?: string,
	cpuAbilityLabel?: string
): TileResult {
	const hEntrench = humanEntrenched ? 2 : 0;
	const cEntrench = cpuEntrenched ? 2 : 0;

	// Pollster: roll 2d6 keep higher (negated if opponent has Disadvantage)
	// Disadvantage: opponent rerolls their die and takes the lower value
	const hPollster = humanCard.ability === 'pollster';
	const cPollster = cpuCard.ability === 'pollster';
	const humanDisadvantaged = cpuCard.ability === 'disadvantage';
	const cpuDisadvantaged = humanCard.ability === 'disadvantage';

	const hRollType: 'pollster' | 'disadvantage' | 'normal' =
		humanDisadvantaged ? 'disadvantage' : (hPollster && !cpuDisadvantaged ? 'pollster' : 'normal');
	const cRollType: 'pollster' | 'disadvantage' | 'normal' =
		cpuDisadvantaged ? 'disadvantage' : (cPollster && !humanDisadvantaged ? 'pollster' : 'normal');

	function rollFor(rollType: 'pollster' | 'disadvantage' | 'normal'): number {
		const r = rollType === 'pollster' ? Math.max(rollD6(), rollD6()) : rollD6();
		return rollType === 'disadvantage' ? Math.min(r, rollD6()) : r;
	}

	let humanRoll = rollFor(hRollType);
	let cpuRoll = rollFor(cRollType);
	let humanScore = humanCard.charisma * humanRoll + hEntrench + humanAbilityBonus;
	let cpuScore = cpuCard.charisma * cpuRoll + cEntrench + cpuAbilityBonus;

	if (humanScore === cpuScore) {
		humanRoll = rollFor(hRollType);
		cpuRoll = rollFor(cRollType);
		humanScore = humanCard.charisma * humanRoll + hEntrench + humanAbilityBonus;
		cpuScore = cpuCard.charisma * cpuRoll + cEntrench + cpuAbilityBonus;
	}

	let winner: PlayerKey | 'tie';
	if (humanScore > cpuScore) winner = 'human';
	else if (cpuScore > humanScore) winner = 'cpu';
	else winner = 'tie';

	const humanBonuses = { ability: humanAbilityBonus, entrench: hEntrench, rollType: hRollType, abilityLabel: humanAbilityLabel };
	const cpuBonuses = { ability: cpuAbilityBonus, entrench: cEntrench, rollType: cRollType, abilityLabel: cpuAbilityLabel };

	return { tileId, humanCard, cpuCard, humanRoll, humanScore, cpuRoll, cpuScore, winner, humanBonuses, cpuBonuses };
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
	prev: RoundState | null,
	ctx: ResolverContext = { coloredTileColors: {}, hardWorkerLevels: {}, playerHands: {} }
): GroupResult {
	// Collect all cards in this group for Coalition check
	const allGroupCards: Card[] = [];
	for (const tileId of group.tileIds) {
		if (humanPlacements[tileId]) allGroupCards.push(humanPlacements[tileId]);
		const cpuCard = cpuPlacements.get(tileId);
		if (cpuCard) allGroupCards.push(cpuCard);
	}

	const underdogActive = checkSoloUnderdogActive(group.tileIds, humanPlacements, cpuPlacements, prev, false);

	const perTile = group.tileIds.map((tileId) => {
		const humanCard = humanPlacements[tileId];
		const cpuCard = cpuPlacements.get(tileId)!;
		const tileColor = ctx.coloredTileColors[tileId] ?? null;
		const hAbility = computeAbilityScoreBonus(humanCard, tileId, tileColor, false, allGroupCards, false);
		const cAbility = computeAbilityScoreBonus(cpuCard, tileId, tileColor, false, allGroupCards, false);
		const hLabel = hAbility > 0 ? (ABILITY_BONUS_LABELS[humanCard.type === 'party_leader' ? 'party_leader' : humanCard.ability] ?? humanCard.ability) : undefined;
		const cLabel = cAbility > 0 ? (ABILITY_BONUS_LABELS[cpuCard.type === 'party_leader' ? 'party_leader' : cpuCard.ability] ?? cpuCard.ability) : undefined;
		return resolveTile(tileId, humanCard, cpuCard, false, false, hAbility, cAbility, hLabel, cLabel);
	});

	let { human: humanBase, cpu: cpuBase } = sumGroupScores(perTile);

	// Entrenchment: +2 for the first entrenched card per player per group
	const humanEntrenched = group.tileIds.some((id) =>
		detectEntrenchment(id, 'human', humanPlacements[id], prev)
	);
	const cpuEntrenched = group.tileIds.some((id) =>
		detectEntrenchment(id, 'cpu', cpuPlacements.get(id)!, prev)
	);

	const hEntrenchBonus = humanEntrenched && !underdogActive ? 2 : 0;
	const cEntrenchBonus = cpuEntrenched && !underdogActive ? 2 : 0;
	const humanTotal = humanBase + hEntrenchBonus;
	const cpuTotal = cpuBase + cEntrenchBonus;

	let winner: PlayerKey | 'tie';
	if (humanTotal > cpuTotal) {
		winner = 'human';
	} else if (cpuTotal > humanTotal) {
		winner = 'cpu';
	} else {
		// Tie-break: re-roll all tiles in the group
		const rerollPerTile = group.tileIds.map((tileId) => {
			const humanCard = humanPlacements[tileId];
			const cpuCard = cpuPlacements.get(tileId)!;
			const tileColor = ctx.coloredTileColors[tileId] ?? null;
			const hAbility = computeAbilityScoreBonus(humanCard, tileId, tileColor, false, allGroupCards, false);
			const cAbility = computeAbilityScoreBonus(cpuCard, tileId, tileColor, false, allGroupCards, false);
			return resolveTile(tileId, humanCard, cpuCard, false, false, hAbility, cAbility);
		});
		const reroll = sumGroupScores(rerollPerTile);
		const humanReroll = reroll.human + hEntrenchBonus;
		const cpuReroll = reroll.cpu + cEntrenchBonus;
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
		winner,
		humanEntrenchBonus: hEntrenchBonus,
		cpuEntrenchBonus: cEntrenchBonus
	};
}

export function resolveRound(
	humanPlacements: Record<number, Card>,
	cpuPlacements: Map<number, Card>,
	groups: TileGroup[],
	prev: RoundState | null,
	ctx: ResolverContext = { coloredTileColors: {}, hardWorkerLevels: {}, playerHands: {} }
): { tileResults: TileResult[]; groupResults: GroupResult[]; hardWorkerEscalations: Record<string, number> } {
	const groupedTileIds = new Set(groups.flatMap((g) => g.tileIds));

	// Apply Hard Worker CHA override to human placements
	const effectiveHumanPlacements: Record<number, Card> = {};
	for (const [key, card] of Object.entries(humanPlacements)) {
		const tileId = Number(key);
		let effectiveCard = card as Card;
		if (effectiveCard.ability === 'hard_worker') {
			const hwKey = `${effectiveCard.id}:${tileId}`;
			if (ctx.hardWorkerLevels[hwKey] !== undefined) {
				effectiveCard = { ...effectiveCard, charisma: ctx.hardWorkerLevels[hwKey] as 1 | 2 | 3 };
			}
		}
		effectiveHumanPlacements[tileId] = effectiveCard;
	}

	// Apply Hard Worker CHA override to cpu placements
	const effectiveCpuPlacements = new Map<number, Card>();
	for (const [tileId, card] of cpuPlacements) {
		let effectiveCard = card;
		if (effectiveCard.ability === 'hard_worker') {
			const hwKey = `${effectiveCard.id}:${tileId}`;
			if (ctx.hardWorkerLevels[hwKey] !== undefined) {
				effectiveCard = { ...effectiveCard, charisma: ctx.hardWorkerLevels[hwKey] as 1 | 2 | 3 };
			}
		}
		effectiveCpuPlacements.set(tileId, effectiveCard);
	}

	const tileResults: TileResult[] = [];
	for (const [key, humanCard] of Object.entries(effectiveHumanPlacements)) {
		const tileId = Number(key);
		if (groupedTileIds.has(tileId)) continue;
		const cpuCard = effectiveCpuPlacements.get(tileId)!;
		const hE = detectEntrenchment(tileId, 'human', humanCard as Card, prev);
		const cE = detectEntrenchment(tileId, 'cpu', cpuCard, prev);
		const underdogActive = checkSoloUnderdogActive([tileId], effectiveHumanPlacements, effectiveCpuPlacements, prev, true, tileId);
		const tileColor = ctx.coloredTileColors[tileId] ?? null;
		const hAbility = computeAbilityScoreBonus(humanCard as Card, tileId, tileColor, true, [], false);
		const cAbility = computeAbilityScoreBonus(cpuCard, tileId, tileColor, true, [], false);
		const hLabel = hAbility > 0 ? (ABILITY_BONUS_LABELS[(humanCard as Card).type === 'party_leader' ? 'party_leader' : (humanCard as Card).ability] ?? (humanCard as Card).ability) : undefined;
		const cLabel = cAbility > 0 ? (ABILITY_BONUS_LABELS[cpuCard.type === 'party_leader' ? 'party_leader' : cpuCard.ability] ?? cpuCard.ability) : undefined;
		tileResults.push(resolveTile(tileId, humanCard as Card, cpuCard, hE && !underdogActive, cE && !underdogActive, hAbility, cAbility, hLabel, cLabel));
	}

	const groupResults: GroupResult[] = groups.map((group) =>
		resolveGroup(group, effectiveHumanPlacements, effectiveCpuPlacements, prev, ctx)
	);

	// Compute Hard Worker escalations (mirrors resolveRoundMP Phase 7)
	const hardWorkerEscalations: Record<string, number> = { ...ctx.hardWorkerLevels };

	// Process human placements
	for (const [key, card] of Object.entries(humanPlacements)) {
		if (card.ability !== 'hard_worker') continue;
		const tileId = Number(key);
		const hwKey = `${card.id}:${tileId}`;

		const prevCard = prev?.humanPlacements[tileId];
		const wasOnSameTile = !prev || prevCard?.id === card.id;

		if (!wasOnSameTile) {
			delete hardWorkerEscalations[hwKey];
			continue;
		}

		const inGroup = groupedTileIds.has(tileId);
		let ownerWon = false;
		if (inGroup) {
			const gr = groupResults.find((r) => r.tileIds.includes(tileId));
			ownerWon = gr?.winner === 'human';
		} else {
			const tr = tileResults.find((r) => r.tileId === tileId);
			ownerWon = tr?.winner === 'human';
		}

		if (!ownerWon) {
			const currentCha = hardWorkerEscalations[hwKey] ?? (card.charisma as number);
			hardWorkerEscalations[hwKey] = Math.min(3, currentCha + 1);
		}
	}

	// Process cpu placements
	for (const [tileId, card] of cpuPlacements) {
		if (card.ability !== 'hard_worker') continue;
		const hwKey = `${card.id}:${tileId}`;

		const prevCard = prev?.cpuPlacements[tileId];
		const wasOnSameTile = !prev || prevCard?.id === card.id;

		if (!wasOnSameTile) {
			delete hardWorkerEscalations[hwKey];
			continue;
		}

		const inGroup = groupedTileIds.has(tileId);
		let ownerWon = false;
		if (inGroup) {
			const gr = groupResults.find((r) => r.tileIds.includes(tileId));
			ownerWon = gr?.winner === 'cpu';
		} else {
			const tr = tileResults.find((r) => r.tileId === tileId);
			ownerWon = tr?.winner === 'cpu';
		}

		if (!ownerWon) {
			const currentCha = hardWorkerEscalations[hwKey] ?? (card.charisma as number);
			hardWorkerEscalations[hwKey] = Math.min(3, currentCha + 1);
		}
	}

	return { tileResults, groupResults, hardWorkerEscalations };
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

const ABILITY_BONUS_LABELS: Record<string, string> = {
	hometown: 'Hometown', independent: 'Indep', coalition: 'Coalition',
	mr_popular: 'MrPop', party_leader: 'Leader'
};

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
			const rollType: 'pollster' | 'disadvantage' | 'normal' =
				playerHasDisadvantageOpponent[uid] ? 'disadvantage' :
				(hasPollster[uid] ? 'pollster' : 'normal');
			// ability label: check card itself and also party_leader bonus
			const abilityKey = card.type === 'party_leader' ? 'party_leader' : card.ability;
			const abilityLabel = abilityBonus > 0 ? (ABILITY_BONUS_LABELS[abilityKey] ?? card.ability) : undefined;
			scores[uid] = {
				card,
				roll: rolls[uid],
				score: card.charisma * rolls[uid] + entrenchBonus + abilityBonus,
				bonuses: { ability: abilityBonus, entrench: entrenchBonus, rollType, abilityLabel }
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

	return { tileId, scores, winner: getWinner()!, underdogActive };
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

function checkSoloUnderdogActive(
	tileIds: number[],
	humanPlacements: Record<number, Card>,
	cpuPlacements: Map<number, Card>,
	prev: RoundState | null,
	isTileLevel: boolean,
	tileIdForSolo?: number
): boolean {
	if (!prev) return false;

	const getPrevWinner = (): PlayerKey | 'tie' | null => {
		if (isTileLevel && tileIdForSolo !== undefined) {
			return prev.results.find((r) => r.tileId === tileIdForSolo)?.winner ?? null;
		}
		return prev.groupResults.find((gr) => tileIds.every((id) => gr.tileIds.includes(id)))?.winner ?? null;
	};

	for (const tid of tileIds) {
		if (humanPlacements[tid]?.ability === 'underdog') {
			if (getPrevWinner() !== 'human') return true;
		}
	}
	for (const tid of tileIds) {
		if (cpuPlacements.get(tid)?.ability === 'underdog') {
			if (getPrevWinner() !== 'cpu') return true;
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
		// NOTE: Entrenchment for group tiles is a GROUP-level bonus added in computeTotals,
		// not a per-tile bonus. Do NOT pass entrenchBonuses to resolveTileMP here.
		const tileAbilityBonuses: Record<string, number> = {};

		for (const uid of userIds) {
			const card = allPlacements.get(uid)![tileId];
			if (card) {
				tilePlacements.set(uid, card);
				const tileColor = ctx.coloredTileColors[tileId] ?? null;
				// hasPartyLeaderPenalty — already applied via CHA override in resolveRoundMP Phase 2
				tileAbilityBonuses[uid] = computeAbilityScoreBonus(
					card,
					tileId,
					tileColor,
					false, // isSolo = false (in a group)
					allCardsInGroup,
					false
				);
			}
		}

		return resolveTileMP(tileId, tilePlacements, {}, {
			tileColor: ctx.coloredTileColors[tileId] ?? null,
			abilityBonuses: tileAbilityBonuses,
			underdogActive
		});
	});

	// Compute group-level entrenchment bonuses (negated by Underdog)
	const groupEntrenchBonuses: Record<string, number> = {};
	for (const uid of userIds) {
		const entrenched = !underdogActive && group.tileIds.some((id) =>
			detectEntrenchmentMP(id, uid, allPlacements.get(uid)![id], prev)
		);
		groupEntrenchBonuses[uid] = entrenched ? 2 : 0;
	}

	const computeTotals = (tiles: MPTileResult[]): Record<string, number> => {
		const totals: Record<string, number> = {};
		for (const uid of userIds) totals[uid] = 0;
		for (const tile of tiles) {
			for (const uid of userIds) {
				totals[uid] = (totals[uid] ?? 0) + (tile.scores[uid]?.score ?? 0);
			}
		}
		for (const uid of userIds) {
			if (groupEntrenchBonuses[uid]) totals[uid] += groupEntrenchBonuses[uid];
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
			// No entrenchment bonuses at tile level — group entrenchment is in computeTotals
			const tileAbilityBonuses: Record<string, number> = {};

			for (const uid of userIds) {
				const card = allPlacements.get(uid)![tileId];
				if (card) {
					tilePlacements.set(uid, card);
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

			return resolveTileMP(tileId, tilePlacements, {}, {
				tileColor: ctx.coloredTileColors[tileId] ?? null,
				abilityBonuses: tileAbilityBonuses,
				underdogActive
			});
		});
		totals = computeTotals(finalPerTile);
	}

	return { groupId: group.id, tileIds: group.tileIds, totals, perTile: finalPerTile, winner: getWinner(totals)!, groupEntrenchBonuses, underdogActive };
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
			// No prev round = first placement; treat as same tile so round-1 losses earn escalation.
			const wasOnSameTile = !prev || prevCard?.id === card.id;

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
