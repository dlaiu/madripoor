<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import type { TileColor } from '$lib/board/hex.js';
	import Board from '$lib/board/Board.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import CardHandMP from '$lib/components/CardHandMP.svelte';
	import PhaseOverlayMP from '$lib/components/PhaseOverlayMP.svelte';
	import GerrymanderingPanelMP from '$lib/components/GerrymanderingPanelMP.svelte';
	import CardBuyingPanel from '$lib/components/CardBuyingPanel.svelte';
	import MrPopularColorModal from '$lib/components/MrPopularColorModal.svelte';
	import ScoutingPanel from '$lib/components/ScoutingPanel.svelte';
	import ScoutSwapToast from '$lib/components/ScoutSwapToast.svelte';
	import {
		mp,
		initMultiplayer,
		placeCard,
		unplaceCard,
		setReady,
		isGerrymanderer,
		gerryClickTile,
		otherPlayers,
		myState,
		cleanup,
		confirmMrPopularColor,
		cancelMrPopularPlacement,
		myPartyLeaderPenalty
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
		let session: { gameId: string; roomCode: string; myUserId: string; myPlayerIndex: number };
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
		mp.phase !== 'lobby' &&
		mp.phase !== 'card_buying' &&
		mp.phase !== 'scouting'
	);

	const tileClickHandler = $derived(
		mp.phase === 'placement' || mp.phase === 'gerrymandering'
			? handleTileClick
			: undefined
	);

	// During placement, override displayed CHA to 1 for placed Party Leaders if penalty applies
	const boardCharismaOverrides = $derived.by(() => {
		if (mp.phase !== 'placement' || !myPartyLeaderPenalty()) return {};
		const overrides: Record<number, number> = {};
		for (const [tileId, card] of Object.entries(mp.myPlacements)) {
			if (card.type === 'party_leader') {
				overrides[Number(tileId)] = 1;
			}
		}
		return overrides;
	});
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
				{#each mp.players as player, i}
					{player.displayName} <strong>{player.roundWins}</strong>{#if i < mp.players.length - 1} — {/if}
				{/each}
			</div>

			{#if mp.phase === 'placement'}
				<div class="placement-bar">
					{#each otherPlayers() as opp}
						<span class="opponent-counter">
							{opp.displayName}: {opp.placedCount}/15
							{#if opp.isReady}<span class="ready-badge">Ready</span>{/if}
						</span>
					{/each}
					<span class="placement-count">{myState()?.placedCount ?? 0}/15 placed</span>
					<button
						class="ready-btn"
						disabled={(myState()?.placedCount ?? 0) !== 15 || (myState()?.isReady ?? false)}
						onclick={setReady}
					>
						{myState()?.isReady ? 'Waiting…' : 'Ready →'}
					</button>
				</div>
			{:else if mp.phase === 'scouting'}
				<div class="placement-bar">
					{#if mp.scoutingPlayerIds.includes(mp.myUserId ?? '')}
						<span class="phase-hint">Scout phase — make your decision below</span>
					{:else}
						<span class="phase-hint">Scouting in progress…</span>
					{/if}
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
						{@const gerryName = mp.players.find(p => p.userId === mp.gerryPlayerId)?.displayName ?? 'Opponent'}
						<span class="phase-hint">{gerryName} is redistricting…</span>
					{/if}
				</div>
			{/if}
		</header>

		<Board
			{coloredTiles}
			placements={mp.myPlacements}
			placedCardCharismaOverrides={boardCharismaOverrides}
			mpResults={showResults ? mp.tileResults : undefined}
			mpGroupResults={showResults ? mp.groupResults : undefined}
			myUserId={mp.myUserId ?? undefined}
			hasSelectedCard={mp.phase === 'placement' && mp.selectedCard !== null}
			groups={mp.groups}
			gerrySelectedTileId={mp.phase === 'gerrymandering' ? mp.gerrySelectedTileId : null}
			isGerrymandering={mp.phase === 'gerrymandering'}
			onTileClick={tileClickHandler}
		/>

		{#if mp.phase === 'placement'}
			<CardHandMP />
		{/if}

		{#if mp.phase === 'scouting'}
			{#if mp.scoutingPlayerIds.includes(mp.myUserId ?? '')}
				<ScoutingPanel />
			{:else}
				<div class="waiting-overlay">
					<p>Scouting in progress…</p>
				</div>
			{/if}
		{/if}

		{#if mp.phase === 'resolution' || mp.phase === 'round_end' || mp.phase === 'game_over' || mp.phase === 'revealing'}
			<PhaseOverlayMP />
		{/if}

		{#if mp.phase === 'gerrymandering'}
			<GerrymanderingPanelMP />
		{/if}

		{#if mp.phase === 'card_buying'}
			<CardBuyingPanel />
		{/if}
	</main>
{/if}

<!-- Always render toast (self-hides when no swap) -->
<ScoutSwapToast />

{#if mp.mrPopularPending !== null}
	<MrPopularColorModal
		onConfirm={confirmMrPopularColor}
		onCancel={cancelMrPopularPlacement}
	/>
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

	.waiting-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		font-family: sans-serif;
	}

	.waiting-overlay p {
		background: white;
		padding: 20px 32px;
		border-radius: 10px;
		font-size: 1.1rem;
		color: #374151;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}
</style>
