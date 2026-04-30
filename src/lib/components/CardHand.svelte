<script lang="ts">
	import { game, selectCard, soloPartyLeaderPenalty } from '$lib/game/gameState.svelte.js';
	import CardComponent from './CardComponent.svelte';
</script>

<div class="hand-panel">
	<div class="hand-inner">
		{#each game.humanHand as card (card.id)}
			<CardComponent
				{card}
				isSelected={game.selectedCard?.id === card.id}
				onClick={() => selectCard(card)}
				displayChaOverride={soloPartyLeaderPenalty() && card.type === 'party_leader' ? 1 : null}
			/>
		{/each}
	</div>
</div>

<style>
	.hand-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(255, 255, 255, 0.95);
		border-top: 1px solid #e5e7eb;
		padding: 10px 16px 14px;
		backdrop-filter: blur(4px);
	}

	.hand-inner {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 2px;
		justify-content: center;
	}
</style>
