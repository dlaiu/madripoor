<script lang="ts">
	import { TILES, axialToPixel, getNeighbors } from './hex.js';
	import type { TileColor } from './hex.js';
	import type { Card, TileGroup, TileResult, MPTileResult, MPGroupResult } from '$lib/game/types.js';
	import { groupContaining } from '$lib/game/groups.js';
	import Hex from './Hex.svelte';

	const GROUP_COLORS = ['#7c3aed', '#ea580c', '#0284c7', '#059669', '#d97706', '#db2777'];

	interface Props {
		coloredTiles?: Record<number, TileColor>;
		size?: number;
		placements?: Record<number, Card>;
		results?: TileResult[];
		mpResults?: MPTileResult[];
		mpGroupResults?: MPGroupResult[];
		myUserId?: string;
		hasSelectedCard?: boolean;
		groups?: TileGroup[];
		gerrySelectedTileId?: number | null;
		isGerrymandering?: boolean;
		onTileClick?: (tileId: number) => void;
	}

	let {
		coloredTiles = {},
		size = 50,
		placements,
		results,
		mpResults,
		mpGroupResults,
		myUserId,
		hasSelectedCard = false,
		groups = [],
		gerrySelectedTileId = null,
		isGerrymandering = false,
		onTileClick
	}: Props = $props();

	const mpResultInfo = $derived.by(() => {
		const map = new Map<number, { winColor: string }>();
		// Solo tiles
		if (mpResults) {
			for (const r of mpResults) {
				map.set(r.tileId, { winColor: r.winner === myUserId ? '#16a34a' : '#dc2626' });
			}
		}
		// Grouped tiles — all tiles in a group share the group winner's color
		if (mpGroupResults) {
			for (const gr of mpGroupResults) {
				const winColor = gr.winner === myUserId ? '#16a34a' : '#dc2626';
				for (const r of gr.perTile) {
					map.set(r.tileId, { winColor });
				}
			}
		}
		return map;
	});

	const positions = $derived(
		TILES.map(tile => {
			const [x, y] = axialToPixel(tile.q, tile.r, size);
			return { ...tile, x, y };
		})
	);

	const viewBox = $derived.by(() => {
		const pad = size * 1.5;
		const xs = positions.map(p => p.x);
		const ys = positions.map(p => p.y);
		const minX = Math.min(...xs) - pad;
		const minY = Math.min(...ys) - pad;
		const width  = Math.max(...xs) - Math.min(...xs) + pad * 2;
		const height = Math.max(...ys) - Math.min(...ys) + pad * 2;
		return `${minX} ${minY} ${width} ${height}`;
	});

	const tileGroupMap = $derived.by(() => {
		const map = new Map<number, { groupIndex: number; groupColor: string }>();
		groups.forEach((g, i) =>
			g.tileIds.forEach(id => map.set(id, { groupIndex: i, groupColor: GROUP_COLORS[i % GROUP_COLORS.length] }))
		);
		return map;
	});

	const gerryAdjacentIds = $derived.by(() => {
		if (!gerrySelectedTileId) return new Set<number>();
		const anchorGroup = groupContaining(groups, gerrySelectedTileId);
		const neighborIds = new Set(getNeighbors(gerrySelectedTileId).map(n => n.id));
		// Exclude tiles already in the same group as the anchor
		if (anchorGroup) {
			for (const id of anchorGroup.tileIds) neighborIds.delete(id);
		}
		neighborIds.delete(gerrySelectedTileId);
		return neighborIds;
	});
</script>

<svg {viewBox} xmlns="http://www.w3.org/2000/svg" class="board">
	{#each positions as tile (tile.id)}
		{@const groupMeta = tileGroupMap.get(tile.id)}
		<Hex
			id={tile.id}
			cx={tile.x}
			cy={tile.y}
			{size}
			color={coloredTiles[tile.id]}
			placedCardColor={placements?.[tile.id]?.color}
			placedCardCharisma={placements?.[tile.id]?.charisma}
			placedCardIsLeader={placements?.[tile.id]?.type === 'party_leader'}
			isSelectable={hasSelectedCard && !(tile.id in (placements ?? {}))}
			isSwappable={hasSelectedCard && tile.id in (placements ?? {})}
			result={results?.find(r => r.tileId === tile.id)}
			mpResultWinColor={mpResultInfo.get(tile.id)?.winColor}
			groupIndex={groupMeta?.groupIndex ?? -1}
			groupColor={groupMeta?.groupColor}
			isGerrySelected={gerrySelectedTileId === tile.id}
			isGerryAdjacent={gerryAdjacentIds.has(tile.id)}
			{isGerrymandering}
			onTileClick={onTileClick ? () => onTileClick!(tile.id) : undefined}
		/>
	{/each}
</svg>

<style>
	.board {
		width: 100%;
		max-width: 600px;
		display: block;
	}
</style>
