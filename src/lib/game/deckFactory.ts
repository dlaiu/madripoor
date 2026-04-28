import type { Card, CardColor, PlayerKey } from './types.js';

export function shuffleCards<T>(cards: T[]): T[] {
	const arr = [...cards];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// Hand composition: 5 per color, CHA1×5 + CHA2×7 + CHA3×3, 1 Party Leader (CHA3, green)
// red:   CHA1, CHA1, CHA2, CHA2, CHA3
// blue:  CHA1, CHA1, CHA1, CHA2, CHA3
// green: CHA2, CHA2, CHA2, CHA2, CHA3 (Party Leader takes the CHA3 slot)
const TEMPLATE: Array<{ color: CardColor; charisma: 1 | 2 | 3; type: Card['type'] }> = [
	{ color: 'red', charisma: 1, type: 'generic' },
	{ color: 'red', charisma: 1, type: 'generic' },
	{ color: 'red', charisma: 2, type: 'generic' },
	{ color: 'red', charisma: 2, type: 'generic' },
	{ color: 'red', charisma: 3, type: 'generic' },
	{ color: 'blue', charisma: 1, type: 'generic' },
	{ color: 'blue', charisma: 1, type: 'generic' },
	{ color: 'blue', charisma: 1, type: 'generic' },
	{ color: 'blue', charisma: 2, type: 'generic' },
	{ color: 'blue', charisma: 3, type: 'generic' },
	{ color: 'green', charisma: 2, type: 'generic' },
	{ color: 'green', charisma: 2, type: 'generic' },
	{ color: 'green', charisma: 2, type: 'generic' },
	{ color: 'green', charisma: 2, type: 'generic' },
	{ color: 'green', charisma: 3, type: 'party_leader' },
];

// Draw pile: ~18 cards available in the card store between rounds.
// Abilities for these cards are implemented in M6; for now they act as generic cards.
const DRAW_PILE_TEMPLATE: Array<{ color: CardColor | null; charisma: 1 | 2 | 3 | 4; label: string }> = [
	// 2 extra Party Leaders (red + blue — green is already in starting hands)
	{ color: 'red', charisma: 3, label: 'dp-leader-red' },
	{ color: 'blue', charisma: 3, label: 'dp-leader-blue' },
	// 3 Hometown CHA3 (one per color, draw pile only)
	{ color: 'red', charisma: 3, label: 'dp-hometown-red' },
	{ color: 'blue', charisma: 3, label: 'dp-hometown-blue' },
	{ color: 'green', charisma: 3, label: 'dp-hometown-green' },
	// 3 Independent (draw pile only)
	{ color: 'red', charisma: 3, label: 'dp-independent-red' },
	{ color: 'blue', charisma: 3, label: 'dp-independent-blue' },
	{ color: 'green', charisma: 3, label: 'dp-independent-green' },
	// 1 Mr. Popular (CHA4, colorless — color declared at reveal, M6)
	{ color: null, charisma: 4, label: 'dp-mrpopular' },
	// 3 Disadvantage (draw pile only)
	{ color: 'red', charisma: 1, label: 'dp-disadvantage-red' },
	{ color: 'blue', charisma: 1, label: 'dp-disadvantage-blue' },
	{ color: 'green', charisma: 1, label: 'dp-disadvantage-green' },
	// 3 Coalition (draw pile only)
	{ color: 'red', charisma: 2, label: 'dp-coalition-red' },
	{ color: 'blue', charisma: 2, label: 'dp-coalition-blue' },
	{ color: 'green', charisma: 2, label: 'dp-coalition-green' },
	// 3 Underdog (draw pile only)
	{ color: 'red', charisma: 2, label: 'dp-underdog-red' },
	{ color: 'blue', charisma: 2, label: 'dp-underdog-blue' },
	{ color: 'green', charisma: 2, label: 'dp-underdog-green' },
];

export function buildDrawPile(): Card[] {
	return DRAW_PILE_TEMPLATE.map((t) => ({
		id: t.label,
		owner: 'human' as PlayerKey, // owner not meaningful for store cards
		color: (t.color ?? 'red') as CardColor, // Mr. Popular colorless until M6
		charisma: t.charisma as 1 | 2 | 3 | 4,
		type: 'generic' as const
	}));
}

export function buildHand(owner: PlayerKey): Card[] {
	const prefix = owner === 'human' ? 'h' : 'c';
	return TEMPLATE.map((t, i) => ({
		id: `${prefix}-${t.color}-cha${t.charisma}-${i}`,
		owner,
		color: t.color,
		charisma: t.charisma,
		type: t.type
	}));
}
