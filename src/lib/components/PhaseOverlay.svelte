<script lang="ts">
	import { game, startNextRound, resetGame } from '$lib/game/gameState.svelte.js';

	const show = $derived(
		game.phase === 'revealing' ||
		game.phase === 'resolution' ||
		game.phase === 'round_end' ||
		game.phase === 'game_over'
	);

	const showResults = $derived(
		game.phase === 'resolution' ||
		game.phase === 'round_end' ||
		game.phase === 'game_over'
	);

	const WINNER_DOT: Record<string, string> = { human: '#16a34a', cpu: '#dc2626', tie: '#9ca3af' };
	const WINNER_LABEL: Record<string, string> = { human: 'You', cpu: 'CPU', tie: 'Tie' };

	const roundWinner = $derived(game.currentRound.winner);
	const isGameOver = $derived(game.phase === 'game_over');
</script>

{#if show}
	<aside class="panel">
		{#if !showResults}
			<p class="revealing-msg">Flipping cards…</p>
		{:else}
			<h2>Round {game.currentRound.roundNumber} — Vote Tally</h2>

			<div class="tile-list">
				{#each game.currentRound.results as r (r.tileId)}
					<div class="tile-row" class:human-win={r.winner === 'human'} class:cpu-win={r.winner === 'cpu'} class:tied={r.winner === 'tie'}>
						<span class="tile-num">#{r.tileId}</span>
						<div class="votes-col">
							<span class="votes-you" title="CHA{r.humanCard.charisma} × {r.humanRoll} = {r.humanScore}">
								{r.humanScore}<span class="votes-detail"> ({r.humanCard.charisma}×{r.humanRoll})</span>
							</span>
							<span class="vs">vs</span>
							<span class="votes-cpu" title="CHA{r.cpuCard.charisma} × {r.cpuRoll} = {r.cpuScore}">
								{r.cpuScore}<span class="votes-detail"> ({r.cpuCard.charisma}×{r.cpuRoll})</span>
							</span>
						</div>
						<span class="winner-dot" style:background={WINNER_DOT[r.winner]}></span>
					</div>
				{/each}
			</div>

			<footer class="summary">
				<div class="tile-counts">
					<span class="count-you">You: <strong>{game.currentRound.humanTilesWon} tiles</strong></span>
					<span class="count-cpu">CPU: <strong>{game.currentRound.cpuTilesWon} tiles</strong></span>
				</div>

				{#if game.phase === 'round_end' || game.phase === 'game_over'}
					<div class="round-winner-msg">
						{#if roundWinner === 'human'}
							<span class="msg-win">You won the round!</span>
						{:else if roundWinner === 'cpu'}
							<span class="msg-lose">CPU won the round.</span>
						{:else}
							<span class="msg-tie">Round tied.</span>
						{/if}
					</div>

					<div class="win-tally">
						<div class="tally-item tally-you">
							<strong>{game.roundWins.human}</strong>
							<span>You</span>
						</div>
						<span class="tally-sep">wins</span>
						<div class="tally-item tally-cpu">
							<strong>{game.roundWins.cpu}</strong>
							<span>CPU</span>
						</div>
					</div>

					{#if isGameOver}
						<p class="game-over-msg">{game.roundWins.human >= 3 ? '🏆 You win the game!' : 'CPU wins the game.'}</p>
						<button class="action-btn" onclick={resetGame}>New Game</button>
					{:else}
						<button class="action-btn" onclick={startNextRound}>Next Round →</button>
					{/if}
				{/if}
			</footer>
		{/if}
	</aside>
{/if}

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

	.revealing-msg {
		margin: auto;
		font-size: 1rem;
		color: #6b7280;
		text-align: center;
		padding: 24px;
	}

	.tile-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.tile-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 14px;
		border-bottom: 1px solid #f9fafb;
		font-size: 0.78rem;
	}

	.tile-row.human-win { background: #f0fdf4; }
	.tile-row.cpu-win   { background: #fef2f2; }
	.tile-row.tied      { background: #f9fafb; }

	.tile-num {
		width: 28px;
		font-weight: 600;
		color: #6b7280;
		flex-shrink: 0;
	}

	.votes-col {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.votes-you {
		color: #16a34a;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.votes-cpu {
		color: #dc2626;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.votes-detail {
		font-weight: 400;
		font-size: 0.7rem;
		color: #9ca3af;
	}

	.vs {
		color: #d1d5db;
		font-size: 0.7rem;
	}

	.winner-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.summary {
		border-top: 1px solid #e5e7eb;
		padding: 12px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tile-counts {
		display: flex;
		justify-content: space-between;
		font-size: 0.82rem;
		color: #374151;
	}

	.count-you strong { color: #16a34a; }
	.count-cpu strong { color: #dc2626; }

	.round-winner-msg {
		text-align: center;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.msg-win  { color: #16a34a; }
	.msg-lose { color: #dc2626; }
	.msg-tie  { color: #9ca3af; }

	.win-tally {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 0;
	}

	.tally-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.tally-item strong {
		font-size: 1.6rem;
		line-height: 1;
	}

	.tally-item span {
		font-size: 0.7rem;
		color: #9ca3af;
	}

	.tally-you strong { color: #16a34a; }
	.tally-cpu strong { color: #dc2626; }

	.tally-sep {
		font-size: 0.7rem;
		color: #d1d5db;
		align-self: flex-end;
		padding-bottom: 6px;
	}

	.game-over-msg {
		text-align: center;
		font-size: 0.95rem;
		font-weight: 700;
		margin: 0;
	}

	.action-btn {
		width: 100%;
		padding: 10px;
		background: #1d4ed8;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.action-btn:hover {
		background: #1e40af;
	}
</style>
