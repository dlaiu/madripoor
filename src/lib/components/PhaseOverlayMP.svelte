<script lang="ts">
	import { goto } from '$app/navigation';
	import { mp, isHost, advanceToNextRound, clearSession } from '$lib/game/multiplayerStore.svelte.js';

	const show = $derived(
		mp.phase === 'revealing' ||
		mp.phase === 'resolution' ||
		mp.phase === 'round_end' ||
		mp.phase === 'game_over'
	);

	const showResults = $derived(
		mp.phase === 'resolution' ||
		mp.phase === 'round_end' ||
		mp.phase === 'game_over'
	);

	// Host is always 'human' in tileResults; guest is always 'cpu'
	const mySide = $derived(mp.myPlayerIndex === 0 ? 'human' : 'cpu');
	const oppSide = $derived(mp.myPlayerIndex === 0 ? 'cpu' : 'human');

	function winnerColor(winner: string): string {
		if (winner === mySide) return '#16a34a';
		if (winner === oppSide) return '#dc2626';
		return '#9ca3af';
	}

	const myTilesWon = $derived(
		mp.tileResults.filter((r) => r.winner === mySide).length +
		mp.groupResults.filter((r) => r.winner === mySide).reduce((s, r) => s + r.tileIds.length, 0)
	);
	const oppTilesWon = $derived(
		mp.tileResults.filter((r) => r.winner === oppSide).length +
		mp.groupResults.filter((r) => r.winner === oppSide).reduce((s, r) => s + r.tileIds.length, 0)
	);
	const roundWinner = $derived(myTilesWon >= oppTilesWon ? 'you' : 'opponent');
	const isGameOver = $derived(mp.phase === 'game_over');

	async function handleNextRound() {
		await advanceToNextRound();
	}

	function handleNewGame() {
		clearSession();
		goto('/');
	}
</script>

{#if show}
	<aside class="panel">
		{#if !showResults}
			<p class="revealing-msg">Flipping cards…</p>
		{:else}
			<h2>Round {mp.roundNumber} — Vote Tally</h2>

			<div class="tile-list">
				{#each mp.tileResults as r (r.tileId)}
					<div class="tile-row" class:my-win={r.winner === mySide} class:opp-win={r.winner === oppSide} class:tied={r.winner === 'tie'}>
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
						<span class="winner-dot" style:background={winnerColor(r.winner)}></span>
					</div>
				{/each}

				{#each mp.groupResults as gr, i (gr.groupId)}
					<div class="group-header" class:my-win={gr.winner === mySide} class:opp-win={gr.winner === oppSide} class:tied={gr.winner === 'tie'}>
						<span class="tile-num">G{i + 1}</span>
						<div class="votes-col">
							<span class="votes-you">{gr.humanTotalScore}</span>
							<span class="vs">vs</span>
							<span class="votes-cpu">{gr.cpuTotalScore}</span>
							<span class="group-tiles-label">tiles {gr.tileIds.join(',')}</span>
						</div>
						<span class="winner-dot" style:background={winnerColor(gr.winner)}></span>
					</div>
					{#each gr.perTile as r (r.tileId)}
						<div class="tile-row tile-row--indent" class:my-win={gr.winner === mySide} class:opp-win={gr.winner === oppSide} class:tied={gr.winner === 'tie'}>
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
						</div>
					{/each}
				{/each}
			</div>

			<footer class="summary">
				<div class="tile-counts">
					<span class="count-you">
						{mp.myDisplayName || 'You'}: <strong>{myTilesWon} tiles</strong>
					</span>
					<span class="count-opp">
						{mp.opponentDisplayName || 'Opp'}: <strong>{oppTilesWon} tiles</strong>
					</span>
				</div>

				{#if mp.phase === 'resolution' || mp.phase === 'round_end' || mp.phase === 'game_over'}
					<div class="round-winner-msg">
						{#if roundWinner === 'you'}
							<span class="msg-win">You won the round!</span>
						{:else}
							<span class="msg-lose">{mp.opponentDisplayName || 'Opponent'} won the round.</span>
						{/if}
					</div>

					<div class="win-tally">
						<div class="tally-item tally-you">
							<strong>{mp.roundWins.my}</strong>
							<span>{mp.myDisplayName || 'You'}</span>
						</div>
						<span class="tally-sep">wins</span>
						<div class="tally-item tally-opp">
							<strong>{mp.roundWins.opponent}</strong>
							<span>{mp.opponentDisplayName || 'Opp'}</span>
						</div>
					</div>

					{#if isGameOver}
						<p class="game-over-msg">
							{mp.roundWins.my >= 3
								? `${mp.myDisplayName || 'You'} win!`
								: `${mp.opponentDisplayName || 'Opponent'} wins!`}
						</p>
						<button class="action-btn" onclick={handleNewGame}>New Game</button>
					{:else if isHost()}
						<button class="action-btn" onclick={handleNextRound}>Next Round →</button>
					{:else}
						<p class="waiting-msg">Waiting for host…</p>
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

	.tile-row.my-win  { background: #f0fdf4; }
	.tile-row.opp-win { background: #fef2f2; }
	.tile-row.tied    { background: #f9fafb; }

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

	.group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px 3px;
		font-size: 0.78rem;
		font-weight: 700;
		border-top: 2px solid #e5e7eb;
		margin-top: 2px;
	}

	.group-header.my-win  { background: #f0fdf4; }
	.group-header.opp-win { background: #fef2f2; }
	.group-header.tied    { background: #f9fafb; }

	.group-tiles-label {
		font-size: 0.67rem;
		color: #9ca3af;
		font-weight: 400;
		margin-left: 4px;
	}

	.tile-row--indent {
		padding-left: 28px;
		border-left: 3px solid #e5e7eb;
		margin-left: 14px;
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
	.count-opp strong { color: #dc2626; }

	.round-winner-msg {
		text-align: center;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.msg-win  { color: #16a34a; }
	.msg-lose { color: #dc2626; }

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
	.tally-opp strong { color: #dc2626; }

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

	.waiting-msg {
		text-align: center;
		font-size: 0.82rem;
		color: #9ca3af;
		margin: 0;
	}
</style>
