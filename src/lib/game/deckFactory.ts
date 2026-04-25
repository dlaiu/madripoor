import type { Card, CardColor, PlayerKey } from './types.js';

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
