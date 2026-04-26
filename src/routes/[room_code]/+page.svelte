<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import type { TileColor } from '$lib/board/hex.js';
	import Board from '$lib/board/Board.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import CardHandMP from '$lib/components/CardHandMP.svelte';
	import PhaseOverlayMP from '$lib/components/PhaseOverlayMP.svelte';
	import GerrymanderingPanelMP from '$lib/components/GerrymanderingPanelMP.svelte';
	import {
		mp,
		initMultiplayer,
		placeCard,
		unplaceCard,
		setReady,
		isGerrymanderer,
		gerryClickTile,
		cleanup
	} from '$lib/game/multiplayerStore.svelte.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const coloredTiles: Record<number, TileColor> = {
		4: 'red',   11: 'red',
		7: 'blue',  12: 'blue',
		2: 'green',  9: 'green'
	};

	let initialized = $state(false);

	onMount(async () => {
		const raw = localStorage.getItem('madripoor_session');
		if (!raw) { goto('/'); return; }
		let session: { gameId: string; roomCode: string; myUserId: string; myPlayerIndex: 0 | 1 };
		try {
			session = JSON.parse(raw);
		} catch {
			goto('/');
			return;
		}
		if (session.roomCode !== data.roomCode) { goto('/'); return; }
		await initMultiplayer(session.gameId, session.myUserId, session.myPlayerIndex);
		initialized = true;
	});

	onDestroy(cleanup);

	function handleTileClick(tileId: number) {
		if (mp.phase === 'placement') {
			if (mp.selectedCard) {
				placeCard(tileId);
			} else if (tileId in mp.myPlacements) {
				unplaceCard(tileId);
			}
		} else if (mp.phase === 'gerrymandering') {
			gerryClickTile(tileId);
		}
	}

	const showResults = $derived(
		mp.phase === 'resolution' ||
		mp.phase === 'round_end' ||
		mp.phase === 'game_over'
	);

	const hasOverlay = $derived(
		mp.phase !== 'placement' &&
		mp.phase !== 'lobby'
	);

	const tileClickHandler = $derived(
		mp.phase === 'placement' || mp.phase === 'gerrymandering'
			? handleTileClick
			: undefined
	);
</script>

{#if !initialized}
	<div class="loading">Connecting…</div>
{:else if mp.phase === 'lobby'}
	<Lobby />
{:else}
	<main class:has-overlay={hasOverlay}>
		<header>
			<h1>Madripoor</h1>
			<div class="round-info">
				Round {mp.roundNumber}
				&nbsp;·&nbsp;
				{mp.myDisplayName} <strong>{mp.roundWins.my}</strong>
				— <strong>{mp.roundWins.opponent}</strong> {mp.opponentDisplayName || 'Opponent'}
			</div>

			{#if mp.phase === 'placement'}
				<div class="placement-bar">
					{#if mp.opponentDisplayName}
						<span class="opponent-counter">
							{mp.opponentDisplayName}: {mp.opponentPlacedCount}/15
							{#if mp.opponentIsReady}<span class="ready-badge">Ready</span>{/if}
						</span>
					{/if}
					<span class="placement-count">{mp.myPlacedCount}/15 placed</span>
					<button
						class="ready-btn"
						disabled={mp.myPlacedCount !== 15 || mp.myIsReady}
						onclick={setReady}
					>
						{mp.myIsReady ? 'Waiting…' : 'Ready →'}
					</button>
				</div>
			{:else if mp.phase === 'revealing'}
				<div class="placement-bar">
					<span class="phase-hint">Flipping cards…</span>
				</div>
			{:else if mp.phase === 'gerrymandering'}
				<div class="placement-bar">
					{#if isGerrymanderer()}
						<span class="phase-hint">
							{mp.gerrySelectedTileId !== null
								? `Tile ${mp.gerrySelectedTileId} selected — click an adjacent tile`
								: 'Click a tile to start grouping'}
						</span>
					{:else}
						<span class="phase-hint">{mp.opponentDisplayName || 'Opponent'} is redistricting…</span>
					{/if}
				</div>
			{/if}
		</header>

		<Board
			{coloredTiles}
			placements={mp.myPlacements}
			results={showResults ? mp.tileResults : undefined}
			hasSelectedCard={mp.phase === 'placement' && mp.selectedCard !== null}
			groups={mp.groups}
			gerrySelectedTileId={mp.phase === 'gerrymandering' ? mp.gerrySelectedTileId : null}
			isGerrymandering={mp.phase === 'gerrymandering'}
			onTileClick={tileClickHandler}
		/>

		{#if mp.phase === 'placement'}
			<CardHandMP />
		{/if}

		{#if mp.phase === 'resolution' || mp.phase === 'round_end' || mp.phase === 'game_over' || mp.phase === 'revealing'}
			<PhaseOverlayMP />
		{/if}

		{#if mp.phase === 'gerrymandering'}
			<GerrymanderingPanelMP />
		{/if}
	</main>
{/if}

{#if mp.error}
	<div class="error-toast">{mp.error}</div>
{/if}

<style>
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		font-family: sans-serif;
		color: #9ca3af;
		font-size: 1rem;
	}

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

	.placement-count {
		font-size: 0.8rem;
		color: #4b5563;
	}

	.opponent-counter {
		font-size: 0.8rem;
		color: #6b7280;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ready-badge {
		background: #dcfce7;
		color: #16a34a;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 10px;
	}

	.phase-hint {
		font-size: 0.8rem;
		color: #4b5563;
	}

	.ready-btn {
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

	.ready-btn:disabled {
		background: #d1d5db;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.ready-btn:not(:disabled):hover {
		background: #15803d;
	}

	.error-toast {
		position: fixed;
		bottom: 130px;
		left: 50%;
		transform: translateX(-50%);
		background: #fef2f2;
		border: 1px solid #fca5a5;
		color: #dc2626;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.85rem;
		font-family: sans-serif;
	}
</style>
