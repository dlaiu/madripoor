<script lang="ts">
	import Board from '$lib/board/Board.svelte';
	import CardHand from '$lib/components/CardHand.svelte';
	import PhaseOverlay from '$lib/components/PhaseOverlay.svelte';
	import GerrymanderingPanel from '$lib/components/GerrymanderingPanel.svelte';
	import RoundSummary from '$lib/components/RoundSummary.svelte';
	import MrPopularColorModal from '$lib/components/MrPopularColorModal.svelte';
	import SoloBuyingPanel from '$lib/components/SoloBuyingPanel.svelte';
	import { game, placeCard, unplaceCard, startScouting, soloScoutChooseSwapTarget, gerryClickTile, confirmMrPopularColorSolo, cancelMrPopularPlacementSolo, soloPartyLeaderPenalty } from '$lib/game/gameState.svelte.js';
	import SoloScoutPanel from '$lib/components/SoloScoutPanel.svelte';
	import { COLORED_TILE_COLORS } from '$lib/board/hex.js';

	const coloredTiles = COLORED_TILE_COLORS;

	function handleTileClick(tileId: number) {
		if (game.selectedCard) {
			placeCard(tileId);
		} else if (tileId in game.currentRound.humanPlacements) {
			unplaceCard(tileId);
		}
	}

	function handleGerryTileClick(tileId: number) {
		gerryClickTile(tileId);
	}

	const allPlaced = $derived(game.phase === 'placement' && game.humanHand.length === 0);
	const showHand = $derived(game.phase === 'placement');
	const showResults = $derived(
		game.phase === 'resolution' ||
		game.phase === 'round_end' ||
		game.phase === 'game_over'
	);
	const hasOverlay = $derived(game.phase !== 'placement' && game.phase !== 'card_buying');

	const hintText = $derived(() => {
		if (game.selectedCard) return 'Click a tile to place — or click a placed tile to swap';
		if (allPlaced) return 'All cards placed — confirm when ready';
		return 'Select a card from your hand';
	});

	const gerryHintText = $derived(() => {
		if (game.gerrySelectedTileId !== null) {
			return `Tile ${game.gerrySelectedTileId} selected — click an adjacent tile to group`;
		}
		return 'Click a tile to start grouping, or click a grouped tile to ungroup it';
	});

	const tileClickHandler = $derived(
		game.phase === 'placement' ? handleTileClick :
		game.phase === 'scouting' ? (tileId: number) => soloScoutChooseSwapTarget(tileId) :
		game.phase === 'gerrymandering' ? handleGerryTileClick :
		undefined
	);

	// Override displayed CHA for placed cards (Party Leader penalty, Hard Worker escalation) across all phases
	const boardCharismaOverrides = $derived.by(() => {
		const overrides: Record<number, number> = {};
		const plPenalty = soloPartyLeaderPenalty();
		for (const [tileIdStr, card] of Object.entries(game.currentRound.humanPlacements)) {
			const tileId = Number(tileIdStr);
			if (card.type === 'party_leader' && plPenalty) {
				overrides[tileId] = 1;
			} else if (card.ability === 'hard_worker') {
				const cha = game.hardWorkerLevels[`${card.id}:${tileId}`];
				if (cha !== undefined) overrides[tileId] = cha;
			}
		}
		return overrides;
	});
</script>

<main class:has-overlay={hasOverlay}>
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
					onclick={startScouting}
				>
					Reveal Cards →
				</button>
			</div>
		{:else if game.phase === 'gerrymandering'}
			<div class="placement-bar">
				<span class="phase-hint">{gerryHintText()}</span>
			</div>
		{/if}
	</header>

	<Board
		{coloredTiles}
		placements={game.currentRound.humanPlacements}
		placedCardCharismaOverrides={boardCharismaOverrides}
		results={showResults ? game.currentRound.results : undefined}
		hasSelectedCard={game.phase === 'placement' && game.selectedCard !== null}
		groups={game.currentRound.groups}
		gerrySelectedTileId={game.phase === 'gerrymandering' ? game.gerrySelectedTileId : null}
		isGerrymandering={game.phase === 'gerrymandering'}
		onTileClick={tileClickHandler}
	/>

	{#if showHand}
		<CardHand />
	{/if}

	<PhaseOverlay />
	{#if game.phase === 'gerrymandering'}
		<GerrymanderingPanel />
	{/if}
	{#if game.phase === 'card_buying'}
		<SoloBuyingPanel />
	{/if}
	{#if game.phase === 'scouting'}
		<SoloScoutPanel />
	{/if}
	<RoundSummary />
</main>

{#if game.mrPopularPending !== null}
	<MrPopularColorModal
		onConfirm={confirmMrPopularColorSolo}
		onCancel={cancelMrPopularPlacementSolo}
	/>
{/if}

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
