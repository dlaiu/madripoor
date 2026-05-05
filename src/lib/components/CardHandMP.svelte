<script lang="ts">
	import { mp, selectCard, myPartyLeaderPenalty, hardWorkerEarnedCha } from '$lib/game/multiplayerStore.svelte.js';
	import CardComponent from './CardComponent.svelte';

	const entrenchableCardIds = $derived.by((): Set<string> => {
		const prev = mp.history.at(-1);
		if (!prev || !mp.myUserId) return new Set();
		const myPrev = prev.allPlacements[mp.myUserId] ?? {};
		return new Set(Object.values(myPrev).map(c => c.id));
	});
</script>

<div class="hand-panel">
	<div class="hand-inner">
		{#each mp.myHand as card (card.id)}
			<CardComponent
				{card}
				isSelected={mp.selectedCard?.id === card.id}
				onClick={() => selectCard(card)}
				isEntrenchable={entrenchableCardIds.has(card.id)}
				displayChaOverride={
				myPartyLeaderPenalty() && card.type === 'party_leader' ? 1 :
				card.ability === 'hard_worker' ? hardWorkerEarnedCha(card.id) :
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
