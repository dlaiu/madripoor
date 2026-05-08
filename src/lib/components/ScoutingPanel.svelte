<script lang="ts">
	import { mp, peekScout, swapScout, swapScoutOnly, keepScout } from '$lib/game/multiplayerStore.svelte.js';
	import type { Card } from '$lib/game/types.js';

	// Find all scout tiles for this player
	const myScoutTileIds = $derived(
		Object.entries(mp.myPlacements)
			.filter(([, card]) => card.ability === 'scout')
			.map(([tileId]) => Number(tileId))
	);

	let currentScoutIndex = $state(0);
	const scoutTileId = $derived(myScoutTileIds[currentScoutIndex] ?? null);
	const isLastScout = $derived(currentScoutIndex >= myScoutTileIds.length - 1);
	const scoutCount = $derived(myScoutTileIds.length);

	let peekedCards = $state<{ userId: string; card: Card; tileId: number }[]>([]);
	let swapTargetTileId = $state<number | null>(null);
	let loading = $state(false);
	let done = $state(false);

	async function loadPeek() {
		if (!scoutTileId) return;
		loading = true;
		peekedCards = [];
		try {
			const rows = await peekScout(scoutTileId);
			peekedCards = rows
				.filter((r) => r.user_id !== mp.myUserId)
				.map((r) => ({ userId: r.user_id, card: r.card_json, tileId: r.tile_id }));
		} catch {
			peekedCards = [];
		} finally {
			loading = false;
		}
	}

	// Load peek on mount and whenever the active scout tile changes
	$effect(() => {
		if (scoutTileId) loadPeek();
	});

	function advanceToNextScout() {
		currentScoutIndex += 1;
		swapTargetTileId = null;
	}

	async function handleSwap() {
		if (swapTargetTileId === null || !scoutTileId) return;
		if (isLastScout) {
			done = true;
			await swapScout(scoutTileId, swapTargetTileId);
		} else {
			await swapScoutOnly(scoutTileId, swapTargetTileId);
			advanceToNextScout();
		}
	}

	async function handleKeep() {
		if (isLastScout) {
			done = true;
			await keepScout();
		} else {
			advanceToNextScout();
		}
	}

	// Tiles available for swap (own placements excluding the current scout tile)
	const swapOptions = $derived(
		Object.entries(mp.myPlacements)
			.filter(([tileId]) => Number(tileId) !== scoutTileId)
			.map(([tileId, card]) => ({ tileId: Number(tileId), card }))
	);
</script>

<div class="scouting-panel">
	<h3>Scout Phase{scoutCount > 1 ? ` (${currentScoutIndex + 1} / ${scoutCount})` : ''}</h3>
	{#if done}
		<p>Waiting for other scouts…</p>
	{:else if loading}
		<p>Peeking at tile {scoutTileId}…</p>
	{:else if scoutTileId}
		<p>Your Scout is on tile <strong>{scoutTileId}</strong>. Opponents' cards there:</p>
		{#if peekedCards.length === 0}
			<p><em>No opponents on this tile.</em></p>
		{:else}
			<ul>
				{#each peekedCards as { card }}
					<li>{card.ability !== 'none' ? card.ability : ''} CHA{card.charisma} {card.color}</li>
				{/each}
			</ul>
		{/if}

		<div class="swap-section">
			<p>Swap Scout with one of your cards (optional):</p>
			<select bind:value={swapTargetTileId}>
				<option value={null}>— keep Scout here —</option>
				{#each swapOptions as { tileId, card }}
					<option value={tileId}>Tile {tileId}: {card.ability !== 'none' ? card.ability : 'generic'} CHA{card.charisma}</option>
				{/each}
			</select>
		</div>

		<div class="actions">
			{#if swapTargetTileId !== null}
				<button onclick={handleSwap}>Swap</button>
			{:else}
				<button onclick={handleKeep}>Keep Scout Here</button>
			{/if}
		</div>
	{:else}
		<p>No Scout found.</p>
	{/if}
</div>

<style>
	.scouting-panel {
		background: #fff;
		border: 2px solid #6366f1;
		border-radius: 10px;
		padding: 16px 20px;
		max-width: 340px;
		margin: 0 auto;
	}
	h3 { margin: 0 0 10px; color: #6366f1; }
	.swap-section { margin: 12px 0; }
	select { width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #d1d5db; }
	.actions { margin-top: 12px; }
	button {
		padding: 8px 18px;
		background: #6366f1;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
	}
	button:hover { background: #4f46e5; }
</style>
