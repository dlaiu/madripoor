export type TileColor = 'red' | 'blue' | 'green';

export interface TileDefinition {
	id: number;
	q: number;
	r: number;
}

// 2·3·4·3·3 oval layout in axial (q, r) coordinates, pointy-top hexes
export const TILES: TileDefinition[] = [
	{ id: 1,  q: 2, r: 0 }, { id: 2,  q: 3, r: 0 },
	{ id: 3,  q: 1, r: 1 }, { id: 4,  q: 2, r: 1 }, { id: 5,  q: 3, r: 1 },
	{ id: 6,  q: 0, r: 2 }, { id: 7,  q: 1, r: 2 }, { id: 8,  q: 2, r: 2 }, { id: 9,  q: 3, r: 2 },
	{ id: 10, q: 0, r: 3 }, { id: 11, q: 1, r: 3 }, { id: 12, q: 2, r: 3 },
	{ id: 13, q: 0, r: 4 }, { id: 14, q: 1, r: 4 }, { id: 15, q: 0, r: 5 },
];

const TILE_BY_ID = new Map(TILES.map(t => [t.id, t]));
const TILE_BY_COORD = new Map(TILES.map(t => [`${t.q},${t.r}`, t]));

// Flat-top hex: pixel center from axial coords
export function axialToPixel(q: number, r: number, size: number): [number, number] {
	const x = size * 1.5 * r;
	const y = size * Math.sqrt(3) * (q + r / 2);
	return [x, y];
}

// Flat-top hex: 6 vertices around a center point
export function hexVertices(cx: number, cy: number, size: number): string {
	const points: string[] = [];
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 180) * (60 * i);
		const x = cx + size * Math.cos(angle);
		const y = cy + size * Math.sin(angle);
		points.push(`${x},${y}`);
	}
	return points.join(' ');
}

// The 6 axial direction offsets for hex neighbors
const NEIGHBOR_OFFSETS: [number, number][] = [
	[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

export function getNeighbors(tileId: number): TileDefinition[] {
	const tile = TILE_BY_ID.get(tileId);
	if (!tile) return [];
	return NEIGHBOR_OFFSETS
		.map(([dq, dr]) => TILE_BY_COORD.get(`${tile.q + dq},${tile.r + dr}`))
		.filter((t): t is TileDefinition => t !== undefined);
}

// Which board tiles have a fixed color (used by Hometown ability)
export const COLORED_TILE_COLORS: Record<number, TileColor> = {
	4: 'red',   11: 'red',
	7: 'blue',  12: 'blue',
	2: 'green',  9: 'green',
};

function buildColoredTiles(shuffledIds: number[]): Record<number, TileColor> {
	const colors: TileColor[] = ['red', 'red', 'blue', 'blue', 'green', 'green'];
	return Object.fromEntries(shuffledIds.slice(0, 6).map((id, i) => [id, colors[i]]));
}

export function randomColoredTiles(): Record<number, TileColor> {
	const ids = TILES.map(t => t.id);
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	return buildColoredTiles(ids);
}

export function seededColoredTiles(seed: string): Record<number, TileColor> {
	let n = 0;
	for (let i = 0; i < seed.length; i++) n = Math.imul(31, n) + seed.charCodeAt(i) | 0;
	const rand = () => { n = Math.imul(1664525, n) + 1013904223 | 0; return (n >>> 0) / 0xFFFFFFFF; };
	const ids = TILES.map(t => t.id);
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	return buildColoredTiles(ids);
}

export const TILE_COLORS: Record<TileColor, string> = {
	red:   '#f87171',
	blue:  '#60a5fa',
	green: '#4ade80',
};

export const DEFAULT_FILL = '#e8e8e8';
export const STROKE = '#999';
