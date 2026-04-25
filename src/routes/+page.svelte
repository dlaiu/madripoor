<script lang="ts">
	import Board from '$lib/board/Board.svelte';
	import type { TileColor } from '$lib/board/hex.js';

	// Placeholder colored tile positions — exact spots TBD via playtesting
	const coloredTiles: Record<number, TileColor> = {
		4: 'red',   11: 'red',
		7: 'blue',  12: 'blue',
		2: 'green',  9: 'green',
	};
</script>

<main>
	<h1>Madripoor</h1>
	<Board {coloredTiles} />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		font-family: sans-serif;
	}

	h1 {
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
		letter-spacing: 0.05em;
	}
</style>
