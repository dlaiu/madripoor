<script lang="ts">
	import { goto } from '$app/navigation';
	import { mp, isHost, myRoundWins, myState, otherPlayers, advanceToNextRound, clearSession } from '$lib/game/multiplayerStore.svelte.js';

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

	// Tile wins per userId derived from results
	const playerTileWins = $derived.by(() => {
		const wins: Record<string, number> = {};
		for (const tr of mp.tileResults) {
			wins[tr.winner] = (wins[tr.winner] ?? 0) + 1;
		}
		for (const gr of mp.groupResults) {
			wins[gr.winner] = (wins[gr.winner] ?? 0) + gr.tileIds.length;
		}
		return wins;
	});

	const myTilesWon = $derived(playerTileWins[mp.myUserId ?? ''] ?? 0);

	// Round winner: player with most tiles (tiebreak: lowest player_index)
	const roundWinnerId = $derived.by(() => {
		let winnerId = '';
		let winCount = -1;
		let winIndex = Infinity;
		for (const [uid, count] of Object.entries(playerTileWins)) {
			const p = mp.players.find((pl) => pl.userId === uid);
			const idx = p?.playerIndex ?? Infinity;
			if (count > winCount || (count === winCount && idx < winIndex)) {
				winnerId = uid;
				winCount = count;
				winIndex = idx;
			}
		}
		return winnerId;
	});

	const iWonRound = $derived(roundWinnerId === mp.myUserId);
	const roundWinnerName = $derived(
		iWonRound ? (myState()?.displayName ?? 'You') : (mp.players.find(p => p.userId === roundWinnerId)?.displayName ?? 'Opponent')
	);

	const isGameOver = $derived(mp.phase === 'game_over');

	// Game winner: first to 3 round wins
	const gameWinnerId = $derived(mp.players.find(p => p.roundWins >= 3)?.userId ?? null);
	const gameWinnerName = $derived(
		gameWinnerId === mp.myUserId
			? (myState()?.displayName ?? 'You')
			: (mp.players.find(p => p.userId === gameWinnerId)?.displayName ?? 'Opponent')
	);

	function scoreColor(userId: string): string {
		if (userId === mp.myUserId) return '#16a34a';
		const colors = ['#dc2626', '#7c3aed', '#d97706'];
		const others = otherPlayers();
		const idx = others.findIndex(p => p.userId === userId);
		return colors[idx % colors.length];
	}

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
					{@const isMine = r.winner === mp.myUserId}
					<div class="tile-row" class:my-win={isMine} class:opp-win={!isMine}>
						<span class="tile-num">#{r.tileId}</span>
						<div class="scores-col">
							{#each mp.players as player}
								{@const s = r.scores[player.userId]}
								{#if s}
									<span class="score-entry" style:color={scoreColor(player.userId)}>
										{s.score}<span class="score-detail"> ({s.card.charisma}×{s.roll})</span>
									</span>
								{/if}
							{/each}
						</div>
						<span class="winner-dot" style:background={scoreColor(r.winner)}></span>
					</div>
				{/each}

				{#each mp.groupResults as gr, i (gr.groupId)}
					{@const isMine = gr.winner === mp.myUserId}
					<div class="group-header" class:my-win={isMine} class:opp-win={!isMine}>
						<span class="tile-num">G{i + 1}</span>
						<div class="scores-col">
							{#each mp.players as player}
								{@const total = gr.totals[player.userId] ?? 0}
								<span class="score-entry" style:color={scoreColor(player.userId)}>{total}</span>
							{/each}
							<span class="group-tiles-label">tiles {gr.tileIds.join(',')}</span>
						</div>
						<span class="winner-dot" style:background={scoreColor(gr.winner)}></span>
					</div>
					{#each gr.perTile as r (r.tileId)}
						{@const isMine = r.winner === mp.myUserId}
						<div class="tile-row tile-row--indent" class:my-win={isMine} class:opp-win={!isMine}>
							<span class="tile-num">#{r.tileId}</span>
							<div class="scores-col">
								{#each mp.players as player}
									{@const s = r.scores[player.userId]}
									{#if s}
										<span class="score-entry" style:color={scoreColor(player.userId)}>
											{s.score}<span class="score-detail"> ({s.card.charisma}×{s.roll})</span>
										</span>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				{/each}
			</div>

			<footer class="summary">
				<div class="tile-counts">
					{#each mp.players as player}
						<span class="count-player" style:color={scoreColor(player.userId)}>
							{player.displayName}: <strong>{playerTileWins[player.userId] ?? 0}</strong>
						</span>
					{/each}
				</div>

				{#if mp.phase === 'resolution' || mp.phase === 'round_end' || mp.phase === 'game_over'}
					<div class="round-winner-msg">
						{#if iWonRound}
							<span class="msg-win">You won the round!</span>
						{:else}
							<span class="msg-lose">{roundWinnerName} won the round.</span>
						{/if}
					</div>

					<div class="win-tally">
						{#each mp.players as player, i}
							<div class="tally-item" style:color={scoreColor(player.userId)}>
								<strong>{player.roundWins}</strong>
								<span>{player.displayName}</span>
							</div>
							{#if i < mp.players.length - 1}
								<span class="tally-sep">wins</span>
							{/if}
						{/each}
					</div>

					{#if isGameOver}
						<p class="game-over-msg">{gameWinnerName} wins!</p>
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

	.tile-num {
		width: 28px;
		font-weight: 600;
		color: #6b7280;
		flex-shrink: 0;
	}

	.scores-col {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.score-entry {
		font-weight: 700;
		font-size: 0.85rem;
	}

	.score-detail {
		font-weight: 400;
		font-size: 0.7rem;
		color: #9ca3af;
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
		flex-wrap: wrap;
		gap: 6px;
		font-size: 0.82rem;
	}

	.count-player strong { font-weight: 700; }

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
		gap: 10px;
		padding: 8px 0;
		flex-wrap: wrap;
	}

	.tally-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.tally-item strong {
		font-size: 1.4rem;
		line-height: 1;
	}

	.tally-item span {
		font-size: 0.7rem;
		color: #9ca3af;
	}

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
