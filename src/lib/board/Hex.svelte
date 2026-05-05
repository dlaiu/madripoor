<script lang="ts">
	import { hexVertices, TILE_COLORS, DEFAULT_FILL, STROKE } from './hex.js';
	import type { TileColor } from './hex.js';
	import type { TileResult } from '$lib/game/types.js';

	interface Props {
		id: number;
		cx: number;
		cy: number;
		size: number;
		color?: TileColor;
		placedCardColor?: TileColor;
		placedCardCharisma?: 1 | 2 | 3 | 4;
		placedCardCharismaOverride?: number | null;
		placedCardIsLeader?: boolean;
		isSelectable?: boolean;
		isSwappable?: boolean;
		result?: TileResult;
		mpResultWinColor?: string;
		groupIndex?: number;
		groupColor?: string;
		isGerrySelected?: boolean;
		isGerryAdjacent?: boolean;
		isGerrymandering?: boolean;
		onTileClick?: () => void;
		abilityBadges?: { label: string; color: string }[];
		isEntrenched?: boolean;
		isEntrenchTarget?: boolean;
		resultAnimIndex?: number;
	}

	let {
		id, cx, cy, size, color,
		placedCardColor, placedCardCharisma, placedCardCharismaOverride = null, placedCardIsLeader = false,
		isSelectable = false, isSwappable = false,
		result,
		groupIndex = -1, groupColor,
		isGerrySelected = false, isGerryAdjacent = false, isGerrymandering = false,
		onTileClick,
		mpResultWinColor,
		abilityBadges,
		isEntrenched = false,
		isEntrenchTarget = false,
		resultAnimIndex = 0
	}: Props = $props();

	const displayCharisma = $derived(
		placedCardCharismaOverride !== null ? placedCardCharismaOverride : placedCardCharisma
	);

	const fill = $derived(color ? TILE_COLORS[color] : DEFAULT_FILL);
	const points = $derived(hexVertices(cx, cy, size));
	const isPlaced = $derived(placedCardColor !== undefined);
	const isClickable = $derived(onTileClick !== undefined);

	const WINNER_COLOR: Record<string, string> = { human: '#16a34a', cpu: '#dc2626', tie: '#9ca3af' };

	const cardW = $derived(size * 0.46);
	const cardH = $derived(size * 0.68);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<g
	class="hex"
	class:selectable={isClickable}
	role={isClickable ? 'button' : 'img'}
	aria-label="Tile {id}"
	onclick={isClickable ? onTileClick : undefined}
>
	<!-- Base hex -->
	<polygon {points} fill={fill} stroke={STROKE} stroke-width="1.5" />

	<!-- Group border + badge -->
	{#if groupIndex >= 0 && groupColor}
		<polygon {points} fill="none" stroke={groupColor} stroke-width="3.5" opacity="0.85" />
		<circle
			cx={cx + size * 0.55}
			cy={cy - size * 0.55}
			r={size * 0.18}
			fill={groupColor}
		/>
		<text
			x={cx + size * 0.55}
			y={cy - size * 0.55}
			text-anchor="middle"
			dominant-baseline="central"
			font-size={size * 0.16}
			font-family="sans-serif"
			font-weight="700"
			fill="white"
			pointer-events="none"
		>{groupIndex + 1}</text>
	{/if}

	<!-- Gerrymandering: anchor tile (purple fill + ring) -->
	{#if isGerrySelected}
		<polygon {points} fill="#7c3aed" opacity="0.12" />
		<polygon {points} fill="none" stroke="#7c3aed" stroke-width="3" opacity="0.95" />
	{/if}

	<!-- Gerrymandering: valid adjacent targets (teal dashed ring) -->
	{#if isGerryAdjacent && !isGerrySelected}
		<polygon {points} fill="#0d9488" opacity="0.08" />
		<polygon {points} fill="none" stroke="#0d9488" stroke-width="2.5" stroke-dasharray="5 3" opacity="0.85" />
	{/if}

	{#if isSelectable && !isEntrenchTarget}
		<!-- Empty tile + card selected: dashed blue ring -->
		<polygon {points} fill="#1d4ed8" opacity="0.08" />
		<polygon {points} fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-dasharray="5 3" opacity="0.8" />
	{/if}

	<!-- Entrench target: solid gold ring + fill, overrides the blue selectable ring -->
	{#if isEntrenchTarget && !isPlaced}
		<polygon {points} fill="#d97706" opacity="0.18" />
		<polygon {points} fill="none" stroke="#d97706" stroke-width="3.5" opacity="0.9" />
	{/if}

	{#if isPlaced && !result && !mpResultWinColor}
		<!-- Card shape -->
		<rect
			x={cx - cardW / 2}
			y={cy - cardH / 2}
			width={cardW}
			height={cardH}
			rx={size * 0.06}
			fill={TILE_COLORS[placedCardColor!]}
			stroke="rgba(0,0,0,0.2)"
			stroke-width="1.5"
		/>

		{#if isSwappable}
			<!-- Amber ring: occupied tile + card selected = click to swap -->
			<polygon {points} fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="5 3" opacity="0.9" />
		{/if}

		<!-- CHA value -->
		{#if placedCardCharisma !== undefined}
			<text
				x={cx}
				y={cy + (placedCardIsLeader ? -size * 0.08 : size * 0.04)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.44}
				font-family="sans-serif"
				font-weight="700"
				fill="#1a1a1a"
				pointer-events="none"
			>{displayCharisma}</text>
		{/if}

		<!-- Party Leader badge -->
		{#if placedCardIsLeader}
			<text
				x={cx}
				y={cy + size * 0.26}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.17}
				font-family="sans-serif"
				font-weight="600"
				fill="#7c3aed"
				pointer-events="none"
			>★ Leader</text>
		{/if}

		<!-- Tile ID — small, top of card -->
		<text
			x={cx}
			y={cy - cardH / 2 + size * 0.15}
			text-anchor="middle"
			dominant-baseline="central"
			font-size={size * 0.17}
			font-family="sans-serif"
			fill="rgba(0,0,0,0.4)"
			pointer-events="none"
		>{id}</text>

		<!-- Entrenchment confirmation badge: bottom-right of card -->
		{#if isEntrenched}
			<rect
				x={cx + cardW / 2 - size * 0.22}
				y={cy + cardH / 2 - size * 0.21}
				width={size * 0.21}
				height={size * 0.17}
				rx={size * 0.04}
				fill="#d97706"
				opacity="0.95"
				pointer-events="none"
			/>
			<text
				x={cx + cardW / 2 - size * 0.115}
				y={cy + cardH / 2 - size * 0.125}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.12}
				font-family="sans-serif"
				font-weight="700"
				fill="white"
				pointer-events="none"
			>+2</text>
		{/if}
	{:else if result}
		<g class="result-group" style:--anim-index={resultAnimIndex}>
		<text class="die-roll" x={cx} y={cy} text-anchor="middle" dominant-baseline="central"
			font-size={size * 0.55} font-family="sans-serif" pointer-events="none">🎲</text>
		<g class="score-reveal">
			<!-- Solo resolution: winner dot + vote scores -->
			<circle cx={cx} cy={cy - size * 0.2} r={size * 0.17} fill={WINNER_COLOR[result.winner]} />
			<text
				x={cx}
				y={cy + size * 0.1}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.21}
				font-family="sans-serif"
				font-weight="600"
				fill="#111"
				pointer-events="none"
			>{result.humanScore}v{result.cpuScore}</text>
			<text
				x={cx}
				y={cy + size * 0.4}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.17}
				font-family="sans-serif"
				fill="#666"
				pointer-events="none"
			>{id}</text>
		</g>
		</g>
	{:else if mpResultWinColor}
		<g class="result-group" style:--anim-index={resultAnimIndex}>
		<text class="die-roll" x={cx} y={cy} text-anchor="middle" dominant-baseline="central"
			font-size={size * 0.55} font-family="sans-serif" pointer-events="none">🎲</text>
		<g class="score-reveal">
			<!-- Multiplayer resolution: winner dot + tile id + ability badges -->
			<circle cx={cx} cy={cy - size * 0.25} r={size * 0.2} fill={mpResultWinColor} opacity="0.9" />
			<text
				x={cx}
				y={cy + size * 0.1}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={size * 0.17}
				font-family="sans-serif"
				fill="#666"
				pointer-events="none"
			>{id}</text>
			{#if abilityBadges?.length}
				{#each abilityBadges.slice(0, 3) as badge, i}
					<rect
						x={cx - size * 0.38}
						y={cy + size * 0.28 + i * size * 0.27}
						width={size * 0.76}
						height={size * 0.22}
						rx={size * 0.06}
						fill={badge.color}
						opacity="0.9"
						pointer-events="none"
					/>
					<text
						x={cx}
						y={cy + size * 0.39 + i * size * 0.27}
						text-anchor="middle"
						dominant-baseline="central"
						font-size={size * 0.15}
						font-family="sans-serif"
						font-weight="700"
						fill="white"
						pointer-events="none"
					>{badge.label}</text>
				{/each}
			{/if}
		</g>
		</g>
	{:else}
		<!-- Default: tile number -->
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
	{/if}
</g>

<style>
	.hex.selectable {
		cursor: pointer;
	}

	@keyframes tileIn {
		from { opacity: 0; transform: scale(0.75); }
		to   { opacity: 1; transform: scale(1); }
	}

	@keyframes dieOut {
		0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
		25%  { opacity: 1; transform: scale(1.25) rotate(10deg); }
		65%  { opacity: 1; transform: scale(1) rotate(0deg); }
		100% { opacity: 0; transform: scale(0.7) rotate(5deg); }
	}

	@keyframes scoreIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.result-group {
		animation: tileIn 0.22s ease-out both;
		animation-delay: calc(var(--anim-index, 0) * 70ms);
		transform-box: fill-box;
		transform-origin: center;
	}

	.die-roll {
		animation: dieOut 0.75s ease-out both;
		transform-box: fill-box;
		transform-origin: center;
	}

	.score-reveal {
		animation: scoreIn 0.2s ease-out both;
		animation-delay: 0.6s;
	}
</style>
