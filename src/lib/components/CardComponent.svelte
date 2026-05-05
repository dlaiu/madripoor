<script lang="ts">
	import type { Card } from '$lib/game/types.js';

	interface Props {
		card: Card;
		isSelected: boolean;
		onClick: () => void;
		displayChaOverride?: number | null;
		isEntrenchable?: boolean;
	}

	const { card, isSelected, onClick, displayChaOverride = null, isEntrenchable = false }: Props = $props();

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

	const ABILITY_LABELS: Record<string, string> = {
		scout: 'Scout',
		hometown: 'Hometown',
		pollster: 'Pollster',
		hard_worker: 'Hard Wkr',
		independent: 'Indep.',
		mr_popular: 'Mr. Pop.',
		disadvantage: 'Disadv.',
		coalition: 'Coalition',
		underdog: 'Underdog'
	};

	const ABILITY_EMOJIS: Record<string, string> = {
		scout: '🔍',
		hometown: '🏠',
		pollster: '🎲',
		hard_worker: '💪',
		independent: '⚡',
		mr_popular: '⭐',
		disadvantage: '⬇️',
		coalition: '🤝',
		underdog: '🐾'
	};

	const displayCha = $derived(displayChaOverride !== null ? displayChaOverride : card.charisma);
	const abilityLabel = $derived(card.ability !== 'none' ? (ABILITY_LABELS[card.ability] ?? card.ability) : null);
	const abilityEmoji = $derived(card.ability !== 'none' ? (ABILITY_EMOJIS[card.ability] ?? null) : null);
</script>

<button
	class="card"
	class:selected={isSelected}
	style:background={COLOR_BG[card.color]}
	style:border-color={isSelected ? '#1d4ed8' : COLOR_BORDER[card.color]}
	onclick={onClick}
	aria-pressed={isSelected}
>
	{#if isEntrenchable}
		<span class="entrench-badge">+2</span>
	{/if}
	<span class="cha">{displayCha}</span>
	{#if card.type === 'party_leader'}
		<span class="label label-text leader">★ Leader</span>
		<span class="label label-emoji leader">★</span>
	{:else if abilityLabel}
		<span class="label label-text ability">{abilityLabel}</span>
		{#if abilityEmoji}<span class="label label-emoji ability">{abilityEmoji}</span>{/if}
	{:else}
		<span class="label label-text">{card.color}</span>
	{/if}
</button>

<style>
	.card {
		position: relative;
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

	.entrench-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		font-size: 0.45rem;
		font-weight: 700;
		color: white;
		background: #d97706;
		border-radius: 3px;
		padding: 0 2px;
		line-height: 1.5;
		pointer-events: none;
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
		text-align: center;
		padding: 0 2px;
	}

	.label.ability {
		color: #7c3aed;
		font-weight: 600;
	}

	.label.leader {
		color: #7c3aed;
		font-weight: 600;
	}

	.label-emoji {
		display: none;
		font-style: normal;
	}

	@media (max-width: 640px) {
		.card {
			width: 46px;
			height: 66px;
		}
		.cha {
			font-size: 1.25rem;
		}
		.label-text {
			display: none;
		}
		.label-emoji {
			display: block;
			font-size: 0.85rem;
			letter-spacing: 0;
			text-transform: none;
			margin-top: 1px;
		}
	}
</style>
