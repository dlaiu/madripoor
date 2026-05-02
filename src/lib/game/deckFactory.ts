import type { Card, CardAbility, CardColor, PlayerKey } from './types.js';

export function shuffleCards<T>(cards: T[]): T[] {
	const arr = [...cards];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// Coerce a card read from DB JSONB (may be missing the `ability` field from pre-M6 rows)
export function coerceCard(c: Record<string, unknown>): Card {
	return { ...c, ability: (c.ability as CardAbility) ?? 'none' } as Card;
}

// ── Shim hand (solo mode + tests) ─────────────────────────────────────────────
// Fixed 15-card template used by buildHand() for solo/CPU play.
// Real multiplayer games use buildStartingPool() + dealHands() instead.
//
// Hand composition: 5 per color, CHA1×5 + CHA2×7 + CHA3×3, 1 Party Leader (CHA3, green)
// red:   CHA1(scout), CHA1(hometown), CHA2(pollster), CHA2(hometown), CHA3
// blue:  CHA1(hard_worker), CHA1, CHA1, CHA2, CHA3
// green: CHA2, CHA2, CHA2, CHA2, CHA3(party_leader)
const TEMPLATE: Array<{ color: CardColor; charisma: 1 | 2 | 3; type: Card['type']; ability: CardAbility }> = [
	{ color: 'red', charisma: 1, type: 'generic', ability: 'scout' },
	{ color: 'red', charisma: 1, type: 'generic', ability: 'hometown' },
	{ color: 'red', charisma: 2, type: 'generic', ability: 'pollster' },
	{ color: 'red', charisma: 2, type: 'generic', ability: 'hometown' },
	{ color: 'red', charisma: 3, type: 'generic', ability: 'none' },
	{ color: 'blue', charisma: 1, type: 'generic', ability: 'hard_worker' },
	{ color: 'blue', charisma: 1, type: 'generic', ability: 'none' },
	{ color: 'blue', charisma: 1, type: 'generic', ability: 'none' },
	{ color: 'blue', charisma: 2, type: 'generic', ability: 'none' },
	{ color: 'blue', charisma: 3, type: 'generic', ability: 'none' },
	{ color: 'green', charisma: 2, type: 'generic', ability: 'none' },
	{ color: 'green', charisma: 2, type: 'generic', ability: 'none' },
	{ color: 'green', charisma: 2, type: 'generic', ability: 'none' },
	{ color: 'green', charisma: 2, type: 'generic', ability: 'none' },
	{ color: 'green', charisma: 3, type: 'party_leader', ability: 'none' },
];

export function buildHand(owner: PlayerKey, idPrefix?: string): Card[] {
	const prefix = idPrefix ?? (owner === 'human' ? 'h' : 'c');
	return TEMPLATE.map((t, i) => ({
		id: `${prefix}-${t.color}-cha${t.charisma}-${i}`,
		owner,
		color: t.color,
		charisma: t.charisma,
		type: t.type,
		ability: t.ability
	}));
}

// ── Draw pile ─────────────────────────────────────────────────────────────────
// 16 non-PL draw pile cards + (6 - playerCount) leftover Party Leaders.
// playerCount defaults to 4 (2 PLs remain in pile, matching pre-M6 behaviour).
const DRAW_PILE_TEMPLATE: Array<{
	color: CardColor | null;
	charisma: 1 | 2 | 3 | 4;
	label: string;
	type: Card['type'];
	ability: CardAbility;
}> = [
	// 3 Hometown CHA3 (draw pile only)
	{ color: 'red', charisma: 3, label: 'dp-hometown-red', type: 'generic', ability: 'hometown' },
	{ color: 'blue', charisma: 3, label: 'dp-hometown-blue', type: 'generic', ability: 'hometown' },
	{ color: 'green', charisma: 3, label: 'dp-hometown-green', type: 'generic', ability: 'hometown' },
	// 3 Independent (draw pile only)
	{ color: 'red', charisma: 3, label: 'dp-independent-red', type: 'generic', ability: 'independent' },
	{ color: 'blue', charisma: 3, label: 'dp-independent-blue', type: 'generic', ability: 'independent' },
	{ color: 'green', charisma: 3, label: 'dp-independent-green', type: 'generic', ability: 'independent' },
	// 1 Mr. Popular (CHA4, colorless — color declared at placement via declared_color)
	{ color: null, charisma: 4, label: 'dp-mrpopular', type: 'generic', ability: 'mr_popular' },
	// 3 Disadvantage (draw pile only)
	{ color: 'red', charisma: 1, label: 'dp-disadvantage-red', type: 'generic', ability: 'disadvantage' },
	{ color: 'blue', charisma: 1, label: 'dp-disadvantage-blue', type: 'generic', ability: 'disadvantage' },
	{ color: 'green', charisma: 1, label: 'dp-disadvantage-green', type: 'generic', ability: 'disadvantage' },
	// 3 Coalition (draw pile only)
	{ color: 'red', charisma: 2, label: 'dp-coalition-red', type: 'generic', ability: 'coalition' },
	{ color: 'blue', charisma: 2, label: 'dp-coalition-blue', type: 'generic', ability: 'coalition' },
	{ color: 'green', charisma: 2, label: 'dp-coalition-green', type: 'generic', ability: 'coalition' },
	// 3 Underdog (draw pile only)
	{ color: 'red', charisma: 2, label: 'dp-underdog-red', type: 'generic', ability: 'underdog' },
	{ color: 'blue', charisma: 2, label: 'dp-underdog-blue', type: 'generic', ability: 'underdog' },
	{ color: 'green', charisma: 2, label: 'dp-underdog-green', type: 'generic', ability: 'underdog' },
];

// All 6 Party Leader cards (2 per color). playerCount PLs go to starting hands,
// the remaining 6 - playerCount are shuffled into the draw pile.
const ALL_PARTY_LEADERS: Array<{ color: CardColor; label: string }> = [
	{ color: 'red', label: 'dp-leader-red-0' },
	{ color: 'red', label: 'dp-leader-red-1' },
	{ color: 'blue', label: 'dp-leader-blue-0' },
	{ color: 'blue', label: 'dp-leader-blue-1' },
	{ color: 'green', label: 'dp-leader-green-0' },
	{ color: 'green', label: 'dp-leader-green-1' },
];

function makePL(label: string, color: CardColor): Card {
	return { id: label, owner: 'human', color, charisma: 3, type: 'party_leader', ability: 'none' };
}

export function buildDrawPile(playerCount: 2 | 3 | 4 = 4): Card[] {
	const nonPL: Card[] = DRAW_PILE_TEMPLATE.map((t) => ({
		id: t.label,
		owner: 'human' as PlayerKey,
		color: (t.color ?? 'red') as CardColor, // Mr. Popular placeholder; real color set via declared_color
		charisma: t.charisma as 1 | 2 | 3 | 4,
		type: t.type,
		ability: t.ability
	}));

	// Leftover PLs (those not dealt to players' starting hands)
	const leftoverPLs = ALL_PARTY_LEADERS.slice(playerCount).map((pl) => makePL(pl.label, pl.color));

	return [...nonPL, ...leftoverPLs];
}

// ── Shared-pool dealing (multiplayer) ─────────────────────────────────────────
// 15 ability cards (1 of each type per color) form the fixed non-PL ability pool.
// Generic filler cards fill the remaining slots to reach playerCount × 14 non-PL cards.

const ABILITY_CARDS_TEMPLATE: Array<{
	color: CardColor;
	charisma: 1 | 2;
	ability: CardAbility;
}> = [];
for (const color of ['red', 'blue', 'green'] as CardColor[]) {
	ABILITY_CARDS_TEMPLATE.push(
		{ color, charisma: 1, ability: 'scout' },
		{ color, charisma: 1, ability: 'hard_worker' },
		{ color, charisma: 1, ability: 'hometown' },
		{ color, charisma: 2, ability: 'hometown' },
		{ color, charisma: 2, ability: 'pollster' }
	);
}

export function buildStartingPool(playerCount: 2 | 3 | 4): { nonPLPool: Card[]; partyLeaders: Card[] } {
	const partyLeaders = ALL_PARTY_LEADERS.map((pl) => makePL(pl.label, pl.color));

	const abilityCards: Card[] = ABILITY_CARDS_TEMPLATE.map((t, i) => ({
		id: `sp-${t.ability}-${t.color}-${i}`,
		owner: 'human' as PlayerKey,
		color: t.color,
		charisma: t.charisma,
		type: 'generic' as const,
		ability: t.ability
	}));

	// Generic filler: playerCount × 14 - 15 cards
	// CHA distribution: total CHA1 = 5N, ability CHA1 = 9 → generic CHA1 = 5N-9
	//                   total CHA2 = 7N, ability CHA2 = 6 → generic CHA2 = 7N-6
	//                   total CHA3 (non-PL) = 2N, ability CHA3 = 0 → generic CHA3 = 2N
	const generics: Card[] = [];
	const cha1Count = 5 * playerCount - 9;
	const cha2Count = 7 * playerCount - 6;
	const cha3Count = 2 * playerCount;
	const colors: CardColor[] = ['red', 'blue', 'green'];
	let idx = 0;
	for (let i = 0; i < cha1Count; i++) {
		generics.push({ id: `sp-gen-cha1-${idx++}`, owner: 'human', color: colors[i % 3], charisma: 1, type: 'generic', ability: 'none' });
	}
	for (let i = 0; i < cha2Count; i++) {
		generics.push({ id: `sp-gen-cha2-${idx++}`, owner: 'human', color: colors[i % 3], charisma: 2, type: 'generic', ability: 'none' });
	}
	for (let i = 0; i < cha3Count; i++) {
		generics.push({ id: `sp-gen-cha3-${idx++}`, owner: 'human', color: colors[i % 3], charisma: 3, type: 'generic', ability: 'none' });
	}

	return { nonPLPool: [...abilityCards, ...generics], partyLeaders };
}

// Build hands + draw pile for a multiplayer game start.
// Hands: 5 CHA1 + 7 CHA2 + 2 CHA3 + 1 PL per player, owner = 'human', IDs prefixed p{i}-.
// Draw pile: DRAW_PILE_TEMPLATE non-PL cards + leftover PLs (not dealt), then shuffled.
export function buildGameStart(playerCount: 2 | 3 | 4): { hands: Card[][]; drawPile: Card[] } {
	const { nonPLPool, partyLeaders } = buildStartingPool(playerCount);

	const shuffledPLs = shuffleCards(partyLeaders);
	const playerPLs = shuffledPLs.slice(0, playerCount);
	const leftoverPLs = shuffledPLs.slice(playerCount);

	const cha1 = shuffleCards(nonPLPool.filter((c) => c.charisma === 1));
	const cha2 = shuffleCards(nonPLPool.filter((c) => c.charisma === 2));
	const cha3 = shuffleCards(nonPLPool.filter((c) => c.charisma === 3));

	const hands: Card[][] = Array.from({ length: playerCount }, () => []);
	for (let p = 0; p < playerCount; p++) {
		const nonPLCards: Card[] = [
			...cha1.splice(0, 5),
			...cha2.splice(0, 7),
			...cha3.splice(0, 2)
		];
		const pl: Card = { ...playerPLs[p], owner: 'human' as PlayerKey, id: `p${p}-${playerPLs[p].id}` };
		hands[p] = [
			...nonPLCards.map((c) => ({
				...c,
				owner: 'human' as PlayerKey,
				id: c.id.replace(/^sp-/, `p${p}-`)
			})),
			pl
		];
	}

	const nonPLDrawCards: Card[] = DRAW_PILE_TEMPLATE.map((t) => ({
		id: t.label,
		owner: 'human' as PlayerKey,
		color: (t.color ?? 'red') as CardColor,
		charisma: t.charisma as 1 | 2 | 3 | 4,
		type: t.type,
		ability: t.ability
	}));

	const drawPile = shuffleCards([...nonPLDrawCards, ...leftoverPLs]);

	return { hands, drawPile };
}

// Deal playerCount hands of 15 cards each from the starting pool.
// Each player is guaranteed 1 Party Leader. CHA distribution (5/7/3) is maintained
// by dealing from separate CHA buckets. Color distribution is approximate.
export function dealHands(playerCount: 2 | 3 | 4): Card[][] {
	const { nonPLPool, partyLeaders } = buildStartingPool(playerCount);

	const shuffledPLs = shuffleCards(partyLeaders);
	const playerPLs = shuffledPLs.slice(0, playerCount);

	// Split non-PL pool by CHA and shuffle each bucket
	const cha1 = shuffleCards(nonPLPool.filter((c) => c.charisma === 1));
	const cha2 = shuffleCards(nonPLPool.filter((c) => c.charisma === 2));
	const cha3 = shuffleCards(nonPLPool.filter((c) => c.charisma === 3));

	// Deal 5 CHA1, 7 CHA2, 2 CHA3 per player (14 non-PL), then add 1 PL (CHA3)
	const hands: Card[][] = Array.from({ length: playerCount }, () => []);
	for (let p = 0; p < playerCount; p++) {
		hands[p].push(
			...cha1.splice(0, 5),
			...cha2.splice(0, 7),
			...cha3.splice(0, 2),
			{ ...playerPLs[p], owner: 'human' as PlayerKey }
		);
	}
	return hands;
}
