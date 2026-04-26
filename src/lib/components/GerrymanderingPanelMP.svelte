<script lang="ts">
	import {
		mp,
		isGerrymanderer,
		confirmGerrymandering,
		clearGroups
	} from '$lib/game/multiplayerStore.svelte.js';
	import { validateGroups, maxGroupSize } from '$lib/game/groups.js';
	import { TILES } from '$lib/board/hex.js';

	const roundNumber = $derived(mp.roundNumber);
	// Groups set during gerrymandering apply to the NEXT round
	const nextRound = $derived(roundNumber + 1);
	const groups = $derived(mp.groups);
	const maxSize = $derived(maxGroupSize(nextRound));
	const grouped = $derived(groups.reduce((sum, g) => sum + g.tileIds.length, 0));
	const soloCount = $derived(TILES.length - grouped);
	const validation = $derived(validateGroups(groups, nextRound));
</script>

<aside class="panel">
	{#if isGerrymanderer()}
		<h2>Redraw Districts — Round {roundNumber}</h2>

		<p class="instructions">
			Click a tile to select it, then click an adjacent tile to group them.
			Click a grouped tile (with nothing selected) to remove it from its group.
		</p>

		<div class="constraints">
			<div class="constraint" class:ok={soloCount >= 3} class:bad={soloCount < 3}>
				<span class="dot"></span>
				Solo tiles: <strong>{soloCount}</strong> / {TILES.length}
				<span class="note">(min 3)</span>
			</div>
			<div class="constraint ok">
				<span class="dot"></span>
				Max group size: <strong>{maxSize}</strong> tiles
			</div>
			{#if groups.length > 0}
				<div class="group-list">
					{#each groups as group, i (group.id)}
						<div class="group-item">
							<span class="group-label">Group {i + 1}:</span>
							<span class="group-tiles">tiles {group.tileIds.join(', ')}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="no-groups">No groups defined — all tiles are solo.</p>
			{/if}
		</div>

		{#if !validation.valid}
			<ul class="errors">
				{#each validation.errors as err}
					<li>{err}</li>
				{/each}
			</ul>
		{/if}

		<footer class="actions">
			<button class="clear-btn" onclick={clearGroups} disabled={groups.length === 0}>
				Clear All Groups
			</button>
			<button class="confirm-btn" onclick={confirmGerrymandering} disabled={!validation.valid}>
				Confirm →
			</button>
		</footer>
	{:else}
		<h2>Redistricting in Progress</h2>
		<div class="spectator">
			<p class="spectator-msg">
				{mp.opponentDisplayName || 'Opponent'} is redistricting…
			</p>
			{#if groups.length > 0}
				<div class="group-list">
					<p class="group-list-label">Current groups:</p>
					{#each groups as group, i (group.id)}
						<div class="group-item">
							<span class="group-label">Group {i + 1}:</span>
							<span class="group-tiles">tiles {group.tileIds.join(', ')}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 270px;
		background: rgba(255, 255, 255, 0.97);
		border-left: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		backdrop-filter: blur(4px);
		overflow: hidden;
	}

	h2 {
		margin: 0;
		padding: 16px 16px 10px;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #374151;
		border-bottom: 1px solid #f3f4f6;
	}

	.instructions {
		margin: 0;
		padding: 12px 14px 8px;
		font-size: 0.78rem;
		color: #6b7280;
		line-height: 1.5;
		border-bottom: 1px solid #f3f4f6;
	}

	.constraints {
		flex: 1;
		overflow-y: auto;
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.constraint {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		color: #374151;
	}

	.constraint .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: #d1d5db;
	}

	.constraint.ok .dot { background: #16a34a; }
	.constraint.bad .dot { background: #dc2626; }
	.constraint.bad { color: #dc2626; }

	.note {
		font-size: 0.7rem;
		color: #9ca3af;
	}

	.group-list {
		margin-top: 6px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.group-item {
		font-size: 0.75rem;
		color: #6b7280;
		padding: 2px 0;
	}

	.group-label {
		font-weight: 600;
		margin-right: 4px;
	}

	.no-groups {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: #9ca3af;
		font-style: italic;
	}

	.errors {
		margin: 0;
		padding: 8px 14px 8px 28px;
		background: #fef2f2;
		border-top: 1px solid #fee2e2;
		font-size: 0.75rem;
		color: #dc2626;
		list-style: disc;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.actions {
		border-top: 1px solid #e5e7eb;
		padding: 12px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.clear-btn {
		width: 100%;
		padding: 8px;
		background: white;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
	}

	.clear-btn:not(:disabled):hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.clear-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.confirm-btn {
		width: 100%;
		padding: 10px;
		background: #7c3aed;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.confirm-btn:not(:disabled):hover {
		background: #6d28d9;
	}

	.confirm-btn:disabled {
		background: #d1d5db;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.spectator {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 16px 14px;
		gap: 12px;
	}

	.spectator-msg {
		margin: 0;
		font-size: 0.85rem;
		color: #6b7280;
		font-style: italic;
	}

	.group-list-label {
		margin: 0 0 4px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}
</style>
