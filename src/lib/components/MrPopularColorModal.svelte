<script lang="ts">
	import type { CardColor } from '$lib/game/types.js';

	interface Props {
		onConfirm: (color: CardColor) => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	const colors: { value: CardColor; label: string; bg: string; border: string; text: string }[] = [
		{ value: 'red',   label: 'Red',   bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
		{ value: 'blue',  label: 'Blue',  bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
		{ value: 'green', label: 'Green', bg: '#f0fdf4', border: '#86efac', text: '#16a34a' }
	];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" role="presentation" onclick={onCancel}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mr-popular-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
		<h2 id="mr-popular-title">Declare Mr. Popular's Color</h2>
		<p class="sub">Choose which color this CHA4 card counts as for scoring.</p>

		<div class="color-buttons">
			{#each colors as c (c.value)}
				<button
					class="color-btn"
					style:background={c.bg}
					style:border-color={c.border}
					style:color={c.text}
					onclick={() => onConfirm(c.value)}
				>
					{c.label}
				</button>
			{/each}
		</div>

		<button class="cancel-link" onclick={onCancel}>Cancel — return to hand</button>
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
		z-index: 200;
	}

	.modal {
		background: white;
		border-radius: 12px;
		padding: 28px 32px;
		width: 320px;
		max-width: 90vw;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		text-align: center;
		color: #111827;
		font-family: sans-serif;
	}

	.sub {
		margin: 0;
		font-size: 0.8rem;
		color: #6b7280;
		text-align: center;
		font-family: sans-serif;
	}

	.color-buttons {
		display: flex;
		gap: 12px;
		width: 100%;
	}

	.color-btn {
		flex: 1;
		padding: 14px 8px;
		border: 2px solid;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		font-family: sans-serif;
		transition: filter 0.1s, transform 0.1s;
	}

	.color-btn:hover {
		filter: brightness(0.95);
		transform: translateY(-1px);
	}

	.color-btn:active {
		transform: translateY(0);
	}

	.cancel-link {
		background: none;
		border: none;
		color: #9ca3af;
		font-size: 0.78rem;
		cursor: pointer;
		font-family: sans-serif;
		text-decoration: underline;
		padding: 0;
	}

	.cancel-link:hover {
		color: #6b7280;
	}
</style>
