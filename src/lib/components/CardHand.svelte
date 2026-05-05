<script lang="ts">
	import { game, selectCard, soloPartyLeaderPenalty, soloHardWorkerEarnedCha } from '$lib/game/gameState.svelte.js';
	import CardComponent from './CardComponent.svelte';

	const entrenchableCardIds = $derived.by((): Set<string> => {
		const prev = game.history.at(-1);
		if (!prev) return new Set();
		return new Set(Object.values(prev.humanPlacements).map(c => c.id));
	});
</script>

<div class="hand-panel">
	<div class="hand-inner">
		{#each game.humanHand as card (card.id)}
			<CardComponent
				{card}
				isSelected={game.selectedCard?.id === card.id}
				onClick={() => selectCard(card)}
				isEntrenchable={entrenchableCardIds.has(card.id)}
				displayChaOverride={
				soloPartyLeaderPenalty() && card.type === 'party_leader' ? 1 :
				card.ability === 'hard_worker' ? soloHardWorkerEarnedCha(card.id) :
				null
			}
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

	@media (max-width: 640px) {
		.hand-panel {
			padding: 8px 8px 10px;
		}
		.hand-inner {
			justify-content: flex-start;
		}
	}
</style>
