<script lang="ts">
	import { mp } from '$lib/game/multiplayerStore.svelte.js';

	let visible = $state(false);
	let message = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (mp.latestScoutSwap) {
			const { actorName, scoutTileId, targetTileId } = mp.latestScoutSwap;
			message = `${actorName} swapped Scout (tile ${scoutTileId} ↔ tile ${targetTileId})`;
			visible = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => { visible = false; }, 4000);
		}
	});
</script>

{#if visible}
	<div class="toast">{message}</div>
{/if}

<style>
	.toast {
		position: fixed;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: white;
		padding: 10px 20px;
		border-radius: 8px;
		font-size: 14px;
		z-index: 999;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
	}
</style>
