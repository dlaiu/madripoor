<script lang="ts">
	import Board from '$lib/board/Board.svelte';
	import CardHand from '$lib/components/CardHand.svelte';
	import PhaseOverlay from '$lib/components/PhaseOverlay.svelte';
	import RoundSummary from '$lib/components/RoundSummary.svelte';
	import { game, placeCard, unplaceCard, startReveal } from '$lib/game/gameState.svelte.js';
	import type { TileColor } from '$lib/board/hex.js';

	const coloredTiles: Record<number, TileColor> = {
		4: 'red',   11: 'red',
		7: 'blue',  12: 'blue',
		2: 'green',  9: 'green',
	};

	function handleTileClick(tileId: number) {
		if (game.selectedCard) {
			placeCard(tileId); // place, or swap if occupied
		} else if (tileId in game.currentRound.humanPlacements) {
			unplaceCard(tileId); // return card to hand
		}
	}

	const allPlaced = $derived(game.phase === 'placement' && game.humanHand.length === 0);
	const showHand = $derived(game.phase === 'placement');
	const showResults = $derived(
		game.phase === 'resolution' ||
		game.phase === 'round_end' ||
		game.phase === 'game_over'
	);

	const hintText = $derived(() => {
		if (game.selectedCard) return 'Click a tile to place — or click a placed tile to swap';
		if (allPlaced) return 'All cards placed — confirm when ready';
		return 'Select a card from your hand';
	});
</script>

<main class:has-overlay={game.phase !== 'placement'}>
	<header>
		<h1>Madripoor</h1>
		<div class="round-info">
			Round {game.currentRound.roundNumber}
			&nbsp;·&nbsp;
			You <strong>{game.roundWins.human}</strong> — <strong>{game.roundWins.cpu}</strong> CPU
		</div>
		{#if game.phase === 'placement'}
			<div class="placement-bar">
				<span class="phase-hint">{hintText()}</span>
				<button
					class="confirm-btn"
					disabled={!allPlaced}
					onclick={startReveal}
				>
					Reveal Cards →
				</button>
			</div>
		{/if}
	</header>

	<Board
		{coloredTiles}
		placements={game.currentRound.humanPlacements}
		results={showResults ? game.currentRound.results : undefined}
		hasSelectedCard={game.phase === 'placement' && game.selectedCard !== null}
		onTileClick={game.phase === 'placement' ? handleTileClick : undefined}
	/>

	{#if showHand}
		<CardHand />
	{/if}

	<PhaseOverlay />
	<RoundSummary />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.5rem 2rem 120px;
		font-family: sans-serif;
		min-height: 100vh;
	}

	main.has-overlay {
		padding-right: 280px;
	}

	header {
		width: 100%;
		max-width: 600px;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: 0.05em;
	}

	.round-info {
		font-size: 0.85rem;
		color: #6b7280;
	}

	.placement-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.phase-hint {
		font-size: 0.8rem;
		color: #4b5563;
	}

	.confirm-btn {
		padding: 6px 16px;
		background: #16a34a;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.confirm-btn:disabled {
		background: #d1d5db;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.confirm-btn:not(:disabled):hover {
		background: #15803d;
	}
</style>
