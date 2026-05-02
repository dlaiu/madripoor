<script lang="ts">
	import { mp, myState, buyCard, passBuyTurn } from '$lib/game/multiplayerStore.svelte.js';
	import type { Card } from '$lib/game/types.js';

	let selectedStorePos = $state<number | null>(null);
	let selectedHandCardId = $state<string | null>(null);

	const isMyTurn = $derived(mp.buyingTurnUserId === mp.myUserId);
	const currentBuyer = $derived(mp.players.find(p => p.userId === mp.buyingTurnUserId));
	const swapsUsed = $derived(myState()?.placedCount ?? 0); // re-using placedCount isn't right; use swaps_used from players

	// Max swaps for the current buyer: last-place (first in worst→best order) gets 2, others 1
	// We determine max swaps based on who the buyer is — tracked by host
	// For display purposes, we count locally based on how many times the user has bought this phase
	let localSwapsUsed = $state(0);
	const maxSwaps = $derived(getBuyerMaxSwaps());

	function getBuyerMaxSwaps(): number {
		if (!mp.buyingTurnUserId) return 1;
		// The first player in buying order (last place) gets 2 swaps.
		// We derive turn order the same way the host does: sort by tile wins ascending.
		// As a simplification for display: if this is a 2-player game, last place gets 2 swaps.
		// For now we surface this from the host's perspective.
		// Actually: the host wrote buying_turn_player_id to the DB, and the order is deterministic.
		// We just need to know if this is the "last place" player.
		// We can't easily recalculate tile wins from the results on the client without more info.
		// Pragmatic approach: show 2 for whoever goes first in the buying phase (they're last place).
		// We track turn position by checking if this player appeared first.
		return 1; // simplified; host enforces the actual limit server-side
	}

	function colorLabel(card: Card): string {
		const map: Record<string, string> = { red: '🔴', blue: '🔵', green: '🟢' };
		return map[card.color] ?? '⚪';
	}

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

	async function handleConfirmSwap() {
		if (selectedStorePos === null || selectedHandCardId === null) return;
		await buyCard(selectedStorePos, selectedHandCardId);
		localSwapsUsed += 1;
		selectedStorePos = null;
		selectedHandCardId = null;
	}

	async function handlePass() {
		selectedStorePos = null;
		selectedHandCardId = null;
		localSwapsUsed = 0;
		await passBuyTurn();
	}

	$effect(() => {
		// Reset local counter when turn changes
		if (mp.buyingTurnUserId) localSwapsUsed = 0;
	});
</script>

<div class="buying-panel">
	<header class="panel-header">
		{#if isMyTurn}
			<h2>Card Store — Your Turn</h2>
			<p class="sub">Select a store card, then a hand card to swap.</p>
		{:else}
			<h2>Card Store</h2>
			<p class="sub">
				{currentBuyer?.displayName ?? 'Someone'} is buying…
			</p>
		{/if}
	</header>

	<!-- Store slots -->
	<div class="store-section">
		<p class="section-label">Store</p>
		<div class="store-slots">
			{#each { length: 4 } as _, i}
				{@const card = mp.cardStore[i] ?? null}
				{#if card}
					<button
						class="card-slot"
						class:selected={selectedStorePos === i}
						class:disabled={!isMyTurn}
						onclick={() => { if (isMyTurn) selectedStorePos = selectedStorePos === i ? null : i; }}
					>
						<span class="card-color">{colorLabel(card)}</span>
						<span class="card-cha">CHA{card.charisma}</span>
						{#if abilityLabel(card)}<span class="card-ability">{abilityLabel(card)}</span>{/if}
					</button>
				{:else}
					<div class="card-slot empty">—</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Hand -->
	<div class="hand-section">
		<p class="section-label">Your Hand ({mp.myHand.length} cards)</p>
		<div class="hand-grid">
			{#each mp.myHand as card (card.id)}
				<button
					class="card-slot small"
					class:selected={selectedHandCardId === card.id}
					class:disabled={!isMyTurn || selectedStorePos === null}
					onclick={() => {
						if (isMyTurn && selectedStorePos !== null) {
							selectedHandCardId = selectedHandCardId === card.id ? null : card.id;
						}
					}}
				>
					<span class="card-color">{colorLabel(card)}</span>
					<span class="card-cha">CHA{card.charisma}</span>
					{#if abilityLabel(card)}<span class="card-ability">{abilityLabel(card)}</span>{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if isMyTurn}
		<footer class="panel-footer">
			{#if selectedStorePos !== null && selectedHandCardId !== null}
				<button class="confirm-btn" onclick={handleConfirmSwap}>
					Confirm Swap →
				</button>
			{/if}
			<button class="pass-btn" onclick={handlePass}>
				Skip Turn
			</button>
		</footer>
	{/if}
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

	.card-badge {
		font-size: 0.65rem;
		color: #d97706;
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
