import { getNeighbors, TILES } from '../board/hex.js';
import type { TileGroup } from './types.js';

export function isConnected(tileIds: number[]): boolean {
	if (tileIds.length <= 1) return true;
	const set = new Set(tileIds);
	const visited = new Set<number>();
	const queue = [tileIds[0]];
	visited.add(tileIds[0]);
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const neighbor of getNeighbors(current)) {
			if (set.has(neighbor.id) && !visited.has(neighbor.id)) {
				visited.add(neighbor.id);
				queue.push(neighbor.id);
			}
		}
	}
	return visited.size === tileIds.length;
}

export function maxGroupSize(roundNumber: number): number {
	if (roundNumber <= 1) return 1;
	if (roundNumber === 2) return 3;
	return 4;
}

export function validateGroups(
	groups: TileGroup[],
	roundNumber: number
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const seen = new Set<number>();

	for (const group of groups) {
		if (group.tileIds.length < 2) {
			errors.push(`Group ${group.id} has fewer than 2 tiles.`);
		}
		if (group.tileIds.length > maxGroupSize(roundNumber)) {
			errors.push(`Group ${group.id} exceeds max size of ${maxGroupSize(roundNumber)}.`);
		}
		if (!isConnected(group.tileIds)) {
			errors.push(`Group ${group.id} tiles are not all adjacent (disconnected).`);
		}
		for (const id of group.tileIds) {
			if (seen.has(id)) {
				errors.push(`Tile ${id} appears in more than one group.`);
			}
			seen.add(id);
		}
	}

	const grouped = groups.reduce((sum, g) => sum + g.tileIds.length, 0);
	const solo = TILES.length - grouped;
	if (solo < 3) {
		errors.push(`At least 3 tiles must remain solo (currently ${solo}).`);
	}

	return { valid: errors.length === 0, errors };
}

export function groupContaining(groups: TileGroup[], tileId: number): TileGroup | null {
	return groups.find((g) => g.tileIds.includes(tileId)) ?? null;
}

let groupCounter = 0;
function nextGroupId(): string {
	return `g${++groupCounter}`;
}

export function addTileToGroup(
	groups: TileGroup[],
	clickedId: number,
	anchorId: number
): TileGroup[] {
	const anchorGroup = groupContaining(groups, anchorId);
	const clickedGroup = groupContaining(groups, clickedId);

	if (anchorGroup && clickedGroup) {
		if (anchorGroup.id === clickedGroup.id) return groups;
		// merge clickedGroup into anchorGroup
		return groups
			.filter((g) => g.id !== clickedGroup.id)
			.map((g) =>
				g.id === anchorGroup.id
					? { ...g, tileIds: [...g.tileIds, ...clickedGroup.tileIds] }
					: g
			);
	}

	if (anchorGroup) {
		return groups.map((g) =>
			g.id === anchorGroup.id ? { ...g, tileIds: [...g.tileIds, clickedId] } : g
		);
	}

	if (clickedGroup) {
		return groups.map((g) =>
			g.id === clickedGroup.id ? { ...g, tileIds: [...g.tileIds, anchorId] } : g
		);
	}

	return [...groups, { id: nextGroupId(), tileIds: [anchorId, clickedId] }];
}

export function removeTileFromGroup(groups: TileGroup[], tileId: number): TileGroup[] {
	return groups
		.map((g) => ({ ...g, tileIds: g.tileIds.filter((id) => id !== tileId) }))
		.filter((g) => g.tileIds.length >= 2);
}

export function cpuAutoGerrymander(roundNumber: number): TileGroup[] {
	const maxSize = maxGroupSize(roundNumber);
	const allIds = TILES.map((t) => t.id);

	// Fisher-Yates shuffle
	const shuffled = [...allIds];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	const groups: TileGroup[] = [];
	const used = new Set<number>();

	for (const seed of shuffled) {
		if (used.has(seed)) continue;

		// BFS-grow a group from this seed
		const group: number[] = [seed];
		const frontier = [...getNeighbors(seed).map((n) => n.id)];

		while (group.length < maxSize && frontier.length > 0) {
			const idx = Math.floor(Math.random() * frontier.length);
			const candidate = frontier.splice(idx, 1)[0];
			if (used.has(candidate) || group.includes(candidate)) continue;
			group.push(candidate);
			for (const n of getNeighbors(candidate)) {
				if (!used.has(n.id) && !group.includes(n.id) && !frontier.includes(n.id)) {
					frontier.push(n.id);
				}
			}
		}

		if (group.length < 2) continue;

		// Check that adding this group still leaves ≥3 solo tiles
		const wouldBeGrouped = groups.reduce((sum, g) => sum + g.tileIds.length, 0) + group.length;
		if (TILES.length - wouldBeGrouped < 3) break;

		for (const id of group) used.add(id);
		groups.push({ id: nextGroupId(), tileIds: group });
	}

	return groups;
}
