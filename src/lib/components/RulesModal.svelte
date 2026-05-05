<script lang="ts">
	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" role="presentation" onclick={onClose}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal" role="dialog" aria-modal="true" aria-label="Rules" tabindex="-1" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h2>How to Play</h2>
			<button class="close-btn" onclick={onClose} aria-label="Close">×</button>
		</div>

		<section>
			<ul class="rules-list">
				<li>Place all 15 cards face-down on tiles, one per tile</li>
				<li>Each tile scores: <strong>charisma × 1d6</strong>; grouped tiles score as a combined total</li>
				<li><strong>Entrenchment:</strong> same card on same tile as last round → <strong>+2 bonus</strong> (max 1 per group per player)</li>
				<li><strong>Round winner:</strong> most tiles/groups won; first to 3 round wins wins the game</li>
				<li><strong>Gerrymandering:</strong> round winner redraws tile groups before the next placement phase</li>
				<li><strong>Card buying:</strong> turn order worst → best; last place gets 2 swaps, all others get 1</li>
			</ul>
		</section>

		<div class="divider"></div>

		<section>
			<h3>Card Abilities</h3>
			<div class="ability-list">
				<div class="ability-row">
					<span class="ability-name">★ Party Leader</span>
					<span class="ability-desc">CHA3, but CHA1 if you own ≥2 (hand + placed)</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">🏠 Hometown</span>
					<span class="ability-desc">+2 if placed on a colored tile matching the card's color</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">🎲 Pollster</span>
					<span class="ability-desc">Roll 2d6, keep the higher result</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">💪 Hard Worker</span>
					<span class="ability-desc">+1 CHA each round you win the same tile (stacks)</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">⚡ Independent</span>
					<span class="ability-desc">+2 if placed on an ungrouped (solo) tile</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">⭐ Mr. Popular</span>
					<span class="ability-desc">CHA4 — declare its color when placing</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">🔍 Scout</span>
					<span class="ability-desc">Before reveal: peek at one opponent tile, then optionally swap with your own card</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">⬇️ Disadvantage</span>
					<span class="ability-desc">Roll 2d6, keep the lower result</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">🤝 Coalition</span>
					<span class="ability-desc">+2 if placed in a group with another card of the same color</span>
				</div>
				<div class="ability-row">
					<span class="ability-name">🐾 Underdog</span>
					<span class="ability-desc">Negates all entrenchment bonuses on its tile or group</span>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}

	.modal {
		background: white;
		border-radius: 12px;
		padding: 24px 28px 28px;
		width: 480px;
		max-width: 92vw;
		max-height: 80vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
		font-family: sans-serif;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: #111827;
	}

	h3 {
		margin: 0 0 10px;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #374151;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.4rem;
		line-height: 1;
		color: #9ca3af;
		cursor: pointer;
		padding: 0 4px;
	}

	.close-btn:hover {
		color: #374151;
	}

	.rules-list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rules-list li {
		font-size: 0.83rem;
		color: #374151;
		line-height: 1.45;
	}

	.divider {
		border-top: 1px solid #e5e7eb;
	}

	.ability-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.ability-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid #f3f4f6;
		font-size: 0.82rem;
	}

	.ability-row:last-child {
		border-bottom: none;
	}

	.ability-name {
		font-weight: 700;
		color: #111827;
		white-space: nowrap;
		min-width: 120px;
		flex-shrink: 0;
	}

	.ability-desc {
		color: #6b7280;
		line-height: 1.4;
	}

	@media (max-width: 640px) {
		.overlay {
			align-items: flex-end;
		}

		.modal {
			width: 100%;
			max-width: 100%;
			max-height: 82vh;
			border-radius: 12px 12px 0 0;
			padding: 20px 20px 32px;
		}

		.ability-name {
			min-width: 100px;
		}
	}
</style>
