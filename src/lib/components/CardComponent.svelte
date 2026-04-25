<script lang="ts">
	import type { Card } from '$lib/game/types.js';

	interface Props {
		card: Card;
		isSelected: boolean;
		onClick: () => void;
	}

	const { card, isSelected, onClick }: Props = $props();

	const COLOR_BG: Record<string, string> = {
		red: '#fee2e2',
		blue: '#dbeafe',
		green: '#dcfce7'
	};

	const COLOR_BORDER: Record<string, string> = {
		red: '#ef4444',
		blue: '#3b82f6',
		green: '#22c55e'
	};
</script>

<button
	class="card"
	class:selected={isSelected}
	style:background={COLOR_BG[card.color]}
	style:border-color={isSelected ? '#1d4ed8' : COLOR_BORDER[card.color]}
	onclick={onClick}
	aria-pressed={isSelected}
>
	<span class="cha">{card.charisma}</span>
	<span class="label">{card.type === 'party_leader' ? 'Leader' : card.color}</span>
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 80px;
		border: 2px solid;
		border-radius: 6px;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.1s, box-shadow 0.1s;
		padding: 0;
	}

	.card:hover {
		transform: translateY(-4px);
	}

	.card.selected {
		transform: translateY(-8px);
		box-shadow: 0 0 0 3px #1d4ed8;
	}

	.cha {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	.label {
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #444;
		margin-top: 2px;
	}
</style>
