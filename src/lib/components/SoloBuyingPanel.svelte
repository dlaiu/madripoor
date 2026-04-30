<script lang="ts">
  import {
    game,
    buyCardSolo,
    confirmSoloBuying
  } from '$lib/game/gameState.svelte.js';
  import type { Card } from '$lib/game/types.js';

  let selectedHandCardId = $state<string | null>(null);

  const swapsLeft = $derived(game.humanMaxSwaps - game.humanSwapsUsed);
  const canBuy = $derived(swapsLeft > 0);

  function handleStoreClick(storePos: number) {
    if (!canBuy || !selectedHandCardId) return;
    const storeCard = game.cardStore[storePos];
    if (!storeCard) return;
    buyCardSolo(storePos, selectedHandCardId);
    selectedHandCardId = null;
  }

  function handleConfirm() {
    confirmSoloBuying();
  }

  function cardLabel(card: Card): string {
    const abilityPart = card.ability !== 'none' ? ` (${card.ability.replace('_', ' ')})` : '';
    return `CHA${card.charisma} ${card.color}${abilityPart}`;
  }
</script>

<div class="buying-panel">
  <h3>Card Buying</h3>
  <p class="swaps-info">
    {#if canBuy}
      Swaps remaining: <strong>{swapsLeft}</strong> — select a card from your hand, then click a store card to swap.
    {:else}
      No swaps remaining.
    {/if}
  </p>

  <div class="store-section">
    <h4>Store</h4>
    <div class="store-slots">
      {#each game.cardStore as card, i}
        <button
          class="store-slot"
          class:empty={!card}
          class:clickable={canBuy && !!card && !!selectedHandCardId}
          onclick={() => handleStoreClick(i)}
          disabled={!canBuy || !card || !selectedHandCardId}
        >
          {#if card}
            {cardLabel(card)}
          {:else}
            <span class="empty-label">Empty</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <div class="hand-section">
    <h4>Your Hand</h4>
    <div class="hand-cards">
      {#each game.humanHand as card (card.id)}
        <button
          class="hand-card"
          class:selected={selectedHandCardId === card.id}
          onclick={() => {
            if (!canBuy) return;
            selectedHandCardId = selectedHandCardId === card.id ? null : card.id;
          }}
          disabled={!canBuy}
        >
          {cardLabel(card)}
        </button>
      {/each}
    </div>
  </div>

  <div class="actions">
    <button class="confirm-btn" onclick={handleConfirm}>
      Done Buying →
    </button>
  </div>
</div>

<style>
  .buying-panel {
    background: white;
    border: 2px solid #6366f1;
    border-radius: 12px;
    padding: 20px 24px;
    max-width: 480px;
    margin: 1rem auto;
    font-family: sans-serif;
  }

  h3 { margin: 0 0 8px; color: #6366f1; }
  h4 { margin: 12px 0 6px; font-size: 0.9rem; color: #374151; }

  .swaps-info {
    font-size: 0.85rem;
    color: #4b5563;
    margin-bottom: 12px;
  }

  .store-slots, .hand-cards {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .store-slot, .hand-card {
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid #e5e7eb;
    background: #f9fafb;
    cursor: pointer;
    font-size: 0.8rem;
    transition: border-color 0.15s, background 0.15s;
  }

  .store-slot.clickable {
    border-color: #6366f1;
    background: #eef2ff;
    cursor: pointer;
  }

  .store-slot.clickable:hover { background: #e0e7ff; }
  .store-slot.empty { opacity: 0.4; cursor: default; }

  .hand-card.selected {
    border-color: #6366f1;
    background: #eef2ff;
  }

  .hand-card:disabled { opacity: 0.5; cursor: default; }

  .actions { margin-top: 16px; text-align: center; }

  .confirm-btn {
    padding: 10px 24px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .confirm-btn:hover { background: #4f46e5; }

  .empty-label { color: #9ca3af; font-style: italic; }
</style>
