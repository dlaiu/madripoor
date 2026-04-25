<script lang="ts">
	import { hexVertices, TILE_COLORS, DEFAULT_FILL, STROKE } from './hex.js';
	import type { TileColor } from './hex.js';

	interface Props {
		id: number;
		cx: number;
		cy: number;
		size: number;
		color?: TileColor;
	}

	let { id, cx, cy, size, color }: Props = $props();

	const fill = $derived(color ? TILE_COLORS[color] : DEFAULT_FILL);
	const points = $derived(hexVertices(cx, cy, size));
</script>

<g class="hex" role="img" aria-label="Tile {id}">
	<polygon {points} fill={fill} stroke={STROKE} stroke-width="1.5" />
	<text
		x={cx}
		y={cy}
		text-anchor="middle"
		dominant-baseline="central"
		font-size={size * 0.4}
		font-family="sans-serif"
		fill="#333"
		pointer-events="none"
	>{id}</text>
</g>
