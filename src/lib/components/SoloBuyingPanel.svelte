<script lang="ts">
	import {
		game,
		buyCardSolo,
		confirmSoloBuying,
		soloHardWorkerEarnedCha,
		soloPartyLeaderPenalty
	} from '$lib/game/gameState.svelte.js';
	import type { Card } from '$lib/game/types.js';

	let selectedStorePos = $state<number | null>(null);
	let selectedHandCardId = $state<string | null>(null);

	const swapsLeft = $derived(game.humanMaxSwaps - game.humanSwapsUsed);
	const canBuy = $derived(swapsLeft > 0);

	const COLOR_EMOJI: Record<string, string> = { red: '🔴', blue: '🔵', green: '🟢' };
	const ABILITY_LABELS: Record<string, string> = {
		scout: 'Scout', hometown: 'Hometown', pollster: 'Pollster',
		hard_worker: 'Hard Wkr', independent: 'Indep.', mr_popular: 'Mr. Pop.',
		disadvantage: 'Disadv.', coalition: 'Coalition', underdog: 'Underdog'
	};

	function abilityLabel(card: Card): string | null {
		if (card.type === 'party_leader') return '★ Leader';
		if (card.ability !== 'none') return ABILITY_LABELS[card.ability] ?? card.ability;
		return null;
	}

	function displayCha(card: Card): number {
		if (card.type === 'party_leader' && soloPartyLeaderPenalty()) return 1;
		if (card.ability === 'hard_worker') return soloHardWorkerEarnedCha(card.id) ?? card.charisma;
		return card.charisma;
	}

	function handleStoreClick(pos: number) {
		if (!canBuy) return;
		if (!game.cardStore[pos]) return;
		selectedStorePos = selectedStorePos === pos ? null : pos;
		selectedHandCardId = null;
	}

	function handleHandClick(cardId: string) {
		if (!canBuy || selectedStorePos === null) return;
		selectedHandCardId = selectedHandCardId === cardId ? null : cardId;
	}

	function handleConfirmSwap() {
		if (selectedStorePos === null || selectedHandCardId === null) return;
		buyCardSolo(selectedStorePos, selectedHandCardId);
		selectedStorePos = null;
		selectedHandCardId = null;
	}
</script>

<div class="buying-panel">
	<header class="panel-header">
		<h2>Card Store</h2>
		<p class="sub">
			{#if canBuy}
				{swapsLeft} swap{swapsLeft === 1 ? '' : 's'} remaining — select a store card, then a hand card to swap.
			{:else}
				No swaps remaining.
			{/if}
		</p>
	</header>

	<div class="store-section">
		<p class="section-label">Store</p>
		<div class="store-slots">
			{#each { length: 4 } as _, i}
				{@const card = game.cardStore[i] ?? null}
				{#if card}
					<button
						class="card-slot"
						class:selected={selectedStorePos === i}
						class:disabled={!canBuy}
						onclick={() => handleStoreClick(i)}
					>
						<span class="card-color">{COLOR_EMOJI[card.color]}</span>
						<span class="card-cha">CHA{card.charisma}</span>
						{#if abilityLabel(card)}<span class="card-ability">{abilityLabel(card)}</span>{/if}
					</button>
				{:else}
					<div class="card-slot empty">—</div>
				{/if}
			{/each}
		</div>
	</div>

	<div class="hand-section">
		<p class="section-label">Your Hand ({game.humanHand.length} cards)</p>
		<div class="hand-grid">
			{#each game.humanHand as card (card.id)}
				<button
					class="card-slot small"
					class:selected={selectedHandCardId === card.id}
					class:disabled={!canBuy || selectedStorePos === null}
					onclick={() => handleHandClick(card.id)}
				>
					<span class="card-color">{COLOR_EMOJI[card.color]}</span>
					<span class="card-cha">CHA{displayCha(card)}</span>
					{#if abilityLabel(card)}<span class="card-ability">{abilityLabel(card)}</span>{/if}
				</button>
			{/each}
		</div>
	</div>

	<footer class="panel-footer">
		{#if selectedStorePos !== null && selectedHandCardId !== null}
			<button class="confirm-btn" onclick={handleConfirmSwap}>
				Confirm Swap →
			</button>
		{/if}
		<button class="pass-btn" onclick={confirmSoloBuying}>
			Done Buying →
		</button>
	</footer>
</div>

<style>
	.buying-panel {
		position: fixed;
		inset: 0;
		background: rgba(255, 255, 255, 0.98);
		display: flex;
		flex-direction: column;
		font-family: sans-serif;
		z-index: 100;
		overflow-y: auto;
	}

	.panel-header {
		padding: 1.5rem 1.5rem 0.75rem;
		border-bottom: 1px solid #e5e7eb;
	}

	h2 {
		margin: 0 0 4px;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.sub {
		margin: 0;
		font-size: 0.82rem;
		color: #6b7280;
	}

	.section-label {
		margin: 0 0 8px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #9ca3af;
	}

	.store-section {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.store-slots {
		display: flex;
		gap: 10px;
	}

	.hand-section {
		padding: 1rem 1.5rem;
		flex: 1;
	}

	.hand-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.card-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 10px 14px;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		background: white;
		cursor: pointer;
		min-width: 64px;
		transition: border-color 0.1s, background 0.1s;
		font-family: inherit;
	}

	.card-slot.small {
		min-width: 52px;
		padding: 7px 10px;
	}

	.card-slot:not(.disabled):hover {
		border-color: #1d4ed8;
	}

	.card-slot.selected {
		border-color: #1d4ed8;
		background: #eff6ff;
	}

	.card-slot.disabled {
		cursor: default;
		opacity: 0.6;
	}

	.card-slot.empty {
		border-style: dashed;
		color: #d1d5db;
		font-size: 1.2rem;
		cursor: default;
	}

	.card-color {
		font-size: 1.1rem;
	}

	.card-slot.small .card-color {
		font-size: 0.9rem;
	}

	.card-cha {
		font-size: 0.72rem;
		font-weight: 700;
		color: #374151;
	}

	.card-ability {
		font-size: 0.6rem;
		color: #7c3aed;
		font-weight: 600;
		text-align: center;
	}

	.panel-footer {
		padding: 1rem 1.5rem 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		gap: 10px;
	}

	.confirm-btn {
		flex: 1;
		padding: 10px;
		background: #1d4ed8;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.confirm-btn:hover {
		background: #1e40af;
	}

	.pass-btn {
		padding: 10px 20px;
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.pass-btn:hover {
		background: #e5e7eb;
	}
</style>
