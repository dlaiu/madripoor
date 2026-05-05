<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Board from '$lib/board/Board.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import CardHandMP from '$lib/components/CardHandMP.svelte';
	import PhaseOverlayMP from '$lib/components/PhaseOverlayMP.svelte';
	import GerrymanderingPanelMP from '$lib/components/GerrymanderingPanelMP.svelte';
	import CardBuyingPanel from '$lib/components/CardBuyingPanel.svelte';
	import MrPopularColorModal from '$lib/components/MrPopularColorModal.svelte';
	import ScoutingPanel from '$lib/components/ScoutingPanel.svelte';
	import ScoutSwapToast from '$lib/components/ScoutSwapToast.svelte';
	import RulesModal from '$lib/components/RulesModal.svelte';
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
	import type { MPTileResult } from '$lib/game/types.js';

	type TileAbilityBadge = { label: string; color: string };

	let { data }: { data: PageData } = $props();

	const coloredTiles = $derived(mp.coloredTileColors);

	let initialized = $state(false);
	let showRules = $state(false);

	$effect(() => {
		if (!mp.error) return;
		const t = setTimeout(() => { mp.error = null; }, 4000);
		return () => clearTimeout(t);
	});

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

	// True if this player has a Scout card placed — determines scouting panel visibility
	const iAmScout = $derived(Object.values(mp.myPlacements).some((c) => c.ability === 'scout'));

	const iAmBuying = $derived(mp.buyingTurnUserId === mp.myUserId);
	const buyerName = $derived(mp.players.find(p => p.userId === mp.buyingTurnUserId)?.displayName ?? 'Someone');

	const entrenchHints = $derived.by((): Record<number, string> => {
		if (mp.phase !== 'placement') return {};
		const prev = mp.history.at(-1);
		if (!prev || !mp.myUserId) return {};
		const myPrev = prev.allPlacements[mp.myUserId] ?? {};
		return Object.fromEntries(
			Object.entries(myPrev).map(([tid, c]) => [Number(tid), c.id])
		);
	});

	const entrenchTargetTiles = $derived.by((): Set<number> => {
		if (!mp.selectedCard || Object.keys(entrenchHints).length === 0) return new Set();
		return new Set(
			Object.entries(entrenchHints)
				.filter(([, cardId]) => cardId === mp.selectedCard!.id)
				.map(([tid]) => Number(tid))
		);
	});

	const BADGE_COLORS: Record<string, string> = {
		hometown: '#15803d', independent: '#15803d',
		pollster: '#1d4ed8', disadvantage: '#dc2626',
		coalition: '#7c3aed', party_leader: '#7c3aed',
		underdog: '#d97706', entrench: '#0d9488',
		mr_popular: '#6b7280',
	};

	const tileAbilityBadges = $derived.by((): Record<number, TileAbilityBadge[]> => {
		if (!showResults) return {};
		const out: Record<number, TileAbilityBadge[]> = {};

		const addBadges = (tr: MPTileResult) => {
			const badges: TileAbilityBadge[] = [];
			if (tr.underdogActive) badges.push({ label: '⚡Und', color: BADGE_COLORS.underdog });
			for (const s of Object.values(tr.scores)) {
				if (s.bonuses?.rollType === 'pollster') badges.push({ label: '★Pol', color: BADGE_COLORS.pollster });
				if (s.bonuses?.rollType === 'disadvantage') badges.push({ label: '↓Dis', color: BADGE_COLORS.disadvantage });
				if (s.bonuses?.ability) badges.push({ label: `+2 ${s.bonuses.abilityLabel ?? ''}`, color: BADGE_COLORS[s.card.ability] ?? '#6b7280' });
				if (s.bonuses?.entrench) badges.push({ label: '+2 Ent', color: BADGE_COLORS.entrench });
			}
			if (badges.length) out[tr.tileId] = badges;
		};

		for (const tr of mp.tileResults) addBadges(tr);
		for (const gr of mp.groupResults) {
			// Group entrenchment: annotate all tiles in the group (deduplicated to one badge)
			const hasGroupEntrench = Object.values(gr.groupEntrenchBonuses ?? {}).some((b) => b > 0);
			for (const tr of gr.perTile) addBadges(tr);
			if (hasGroupEntrench) {
				for (const tid of gr.tileIds) {
					out[tid] = [...(out[tid] ?? []), { label: '+2 Ent', color: BADGE_COLORS.entrench }];
				}
			}
		}
		return out;
	});

	// During placement, override displayed CHA for Party Leader penalty and Hard Worker escalation
	const boardCharismaOverrides = $derived.by(() => {
		const overrides: Record<number, number> = {};
		for (const [tileId, card] of Object.entries(mp.myPlacements)) {
			const tid = Number(tileId);
			// Party Leader penalty: show CHA1 when player owns ≥2 PLs
			if (card.type === 'party_leader' && mp.phase === 'placement' && myPartyLeaderPenalty()) {
				overrides[tid] = 1;
			}
			// Hard Worker escalation: show earned CHA level when placed on the same tile as last round
			if (card.ability === 'hard_worker') {
				const level = mp.hardWorkerLevels[`${card.id}:${tid}`];
				if (level !== undefined) overrides[tid] = level;
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
	<main class:has-overlay={hasOverlay} class:has-hand={mp.phase === 'placement'}>
		<header>
			<div class="header-row">
				<h1>Madripoor</h1>
				<button class="rules-btn" onclick={() => showRules = true} aria-label="Rules">☰</button>
			</div>
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
					{#if iAmScout}
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
			{:else if mp.phase === 'card_buying'}
				<div class="placement-bar">
					{#if iAmBuying}
						<span class="phase-hint">Your turn to buy</span>
					{:else}
						<span class="phase-hint">{buyerName} is buying…</span>
					{/if}
				</div>
			{:else if mp.phase === 'resolution'}
				<div class="placement-bar">
					<span class="phase-hint">Round results →</span>
				</div>
			{:else if mp.phase === 'round_end'}
				<div class="placement-bar">
					<span class="phase-hint">Round complete — see results →</span>
				</div>
			{:else if mp.phase === 'game_over'}
				<div class="placement-bar">
					<span class="phase-hint">Game over</span>
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
			tileAbilityBadges={showResults ? tileAbilityBadges : undefined}
			{entrenchHints}
			{entrenchTargetTiles}
		/>

		{#if mp.phase === 'placement'}
			<CardHandMP />
		{/if}

		{#if mp.phase === 'scouting'}
			{#if iAmScout}
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

{#if showRules}
	<RulesModal onClose={() => showRules = false} />
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
		padding: 1.5rem 2rem;
		font-family: sans-serif;
	}

	main.has-hand {
		padding-bottom: 120px;
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

	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		max-width: 600px;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: 0.05em;
	}

	.rules-btn {
		background: none;
		border: none;
		font-size: 1.3rem;
		cursor: pointer;
		color: #9ca3af;
		padding: 4px 8px;
		line-height: 1;
	}

	.rules-btn:hover {
		color: #374151;
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

	@media (max-width: 640px) {
		main {
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}
		main.has-overlay {
			padding-right: 0.75rem;
		}
		.round-info {
			text-align: center;
			line-height: 1.5;
		}
		.placement-bar {
			flex-direction: column;
		}
	}
</style>
