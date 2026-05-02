<script lang="ts">
	import { game, soloScoutSwap, soloScoutKeep } from '$lib/game/gameState.svelte.js';

	const s = $derived(game.soloScoutState);

	const COLOR_LABELS: Record<string, string> = { red: '🔴', blue: '🔵', green: '🟢' };
	const ABILITY_LABELS: Record<string, string> = {
		scout: 'Scout', hometown: 'Hometown', pollster: 'Pollster',
		hard_worker: 'Hard Worker', independent: 'Independent', mr_popular: 'Mr. Popular',
		disadvantage: 'Disadvantage', coalition: 'Coalition', underdog: 'Underdog'
	};
</script>

{#if s}
	<div class="scout-panel">
		<div class="peek-info">
			<span class="peek-label">Scout on tile <strong>{s.humanScoutTileId}</strong> sees:</span>
			<span class="peeked-card card-color-{s.peekedCard.color}">
				{COLOR_LABELS[s.peekedCard.color]} CHA{s.peekedCard.charisma}
				{#if s.peekedCard.ability !== 'none'}
					<span class="ability-tag">({ABILITY_LABELS[s.peekedCard.ability] ?? s.peekedCard.ability})</span>
				{/if}
			</span>
		</div>

		{#if s.swapTargetTileId === null}
			<div class="scout-actions">
				<span class="action-hint">Click one of your other tiles to move your Scout there, or keep it.</span>
				<button class="keep-btn" onclick={soloScoutKeep}>Keep Scout Here</button>
			</div>
		{:else}
			<div class="scout-actions">
				<span class="action-hint">Move Scout to tile <strong>{s.swapTargetTileId}</strong>?</span>
				<button class="swap-btn" onclick={soloScoutSwap}>Confirm Swap →</button>
				<button class="keep-btn" onclick={soloScoutKeep}>Cancel / Keep</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.scout-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(255, 255, 255, 0.97);
		border-top: 2px solid #7c3aed;
		padding: 12px 16px 16px;
		backdrop-filter: blur(4px);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.peek-info {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.88rem;
	}

	.peek-label { color: #6b7280; }

	.peeked-card {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.card-color-red   { color: #dc2626; }
	.card-color-blue  { color: #1d4ed8; }
	.card-color-green { color: #15803d; }

	.ability-tag {
		font-size: 0.8rem;
		font-weight: 400;
		color: #7c3aed;
	}

	.scout-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.action-hint {
		flex: 1;
		font-size: 0.85rem;
		color: #374151;
	}

	.swap-btn {
		padding: 8px 16px;
		background: #7c3aed;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.swap-btn:hover { background: #6d28d9; }

	.keep-btn {
		padding: 8px 16px;
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.keep-btn:hover { background: #e5e7eb; }
</style>
