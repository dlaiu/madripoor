<script lang="ts">
	import { TILES, axialToPixel } from './hex.js';
	import type { TileColor } from './hex.js';
	import type { Card, TileResult } from '$lib/game/types.js';
	import Hex from './Hex.svelte';

	interface Props {
		coloredTiles?: Record<number, TileColor>;
		size?: number;
		placements?: Record<number, Card>;
		results?: TileResult[];
		hasSelectedCard?: boolean;
		onTileClick?: (tileId: number) => void;
	}

	let { coloredTiles = {}, size = 50, placements, results, hasSelectedCard = false, onTileClick }: Props = $props();

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
</script>

<svg {viewBox} xmlns="http://www.w3.org/2000/svg" class="board">
	{#each positions as tile (tile.id)}
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
