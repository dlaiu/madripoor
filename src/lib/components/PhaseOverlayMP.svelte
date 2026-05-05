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

	const ABILITY_COLORS: Record<string, string> = {
		hometown: '#15803d', independent: '#15803d',
		pollster: '#1d4ed8',
		disadvantage: '#dc2626',
		coalition: '#7c3aed', party_leader: '#7c3aed',
		underdog: '#d97706',
		entrench: '#0d9488',
		mr_popular: '#6b7280',
	};

	function scoreColor(userId: string): string {
		if (userId === mp.myUserId) return '#16a34a';
		const colors = ['#dc2626', '#7c3aed', '#d97706'];
		const others = otherPlayers();
		const idx = others.findIndex(p => p.userId === userId);
		return colors[idx % colors.length];
	}

	// Sequential animation indices: solo tiles first, then group header + per-tiles
	const soloCount = $derived(mp.tileResults.length);
	const groupStartIndices = $derived.by((): number[] => {
		let i = soloCount;
		return mp.groupResults.map(gr => {
			const start = i;
			i += 1 + gr.perTile.length;
			return start;
		});
	});

	async function handleNextRound() {
		await advanceToNextRound();
	}

	function handleNewGame() {
		clearSession();
		goto('/');
	}
</script>

{#snippet scoreDetail(s: import('$lib/game/types.js').MPPlayerScore)}
	<span class="score-base">({s.card.charisma}×{s.roll})</span>
	{#if s.bonuses?.rollType === 'pollster'}
		<span class="ability-pill" style:background={ABILITY_COLORS.pollster}>★ Poll</span>
	{/if}
	{#if s.bonuses?.rollType === 'disadvantage'}
		<span class="ability-pill" style:background={ABILITY_COLORS.disadvantage}>↓ Disadv</span>
	{/if}
	{#if s.bonuses?.ability}
		<span class="ability-pill" style:background={ABILITY_COLORS[s.card.ability] ?? '#6b7280'}>
			+{s.bonuses.ability} {s.bonuses.abilityLabel ?? ''}
		</span>
	{/if}
	{#if s.bonuses?.entrench}
		<span class="ability-pill" style:background={ABILITY_COLORS.entrench}>+2 Ent</span>
	{/if}
{/snippet}

{#if show}
	<aside class="panel">
		{#if !showResults}
			<p class="revealing-msg">Flipping cards…</p>
		{:else}
			<h2>Round {mp.roundNumber} — Vote Tally</h2>

			<div class="tile-list">
				{#each mp.tileResults as r, ri (r.tileId)}
					{@const isMine = r.winner === mp.myUserId}
					<div class="tile-row" class:my-win={isMine} class:opp-win={!isMine} style:--anim-index={ri}>
						<span class="tile-num">#{r.tileId}</span>
						<div class="scores-col">
							{#each mp.players as player}
								{@const s = r.scores[player.userId]}
								{#if s}
									<span class="score-entry" style:color={scoreColor(player.userId)}>
										{s.score} {@render scoreDetail(s)}
									</span>
								{/if}
							{/each}
							{#if r.underdogActive}<span class="ability-pill" style:background={ABILITY_COLORS.underdog}>⚡ Underdog</span>{/if}
						</div>
						<span class="winner-dot" style:background={scoreColor(r.winner)}></span>
					</div>
				{/each}

				{#each mp.groupResults as gr, i (gr.groupId)}
					{@const isMine = gr.winner === mp.myUserId}
					<div class="group-header" class:my-win={isMine} class:opp-win={!isMine} style:--anim-index={groupStartIndices[i]}>
						<span class="tile-num">G{i + 1}</span>
						<div class="scores-col">
							{#each mp.players as player}
								{@const total = gr.totals[player.userId] ?? 0}
								{@const ent = gr.groupEntrenchBonuses?.[player.userId] ?? 0}
								<span class="score-entry" style:color={scoreColor(player.userId)}>
									{total}{#if ent}<span class="ability-pill" style:background={ABILITY_COLORS.entrench}>+2 Ent</span>{/if}
								</span>
							{/each}
							{#if gr.underdogActive}<span class="ability-pill" style:background={ABILITY_COLORS.underdog}>⚡ Underdog</span>{/if}
							<span class="group-tiles-label">tiles {gr.tileIds.join(',')}</span>
						</div>
						<span class="winner-dot" style:background={scoreColor(gr.winner)}></span>
					</div>
					{#each gr.perTile as r, ri (r.tileId)}
						{@const isMine = r.winner === mp.myUserId}
						<div class="tile-row tile-row--indent" class:my-win={isMine} class:opp-win={!isMine} style:--anim-index={groupStartIndices[i] + 1 + ri}>
							<span class="tile-num">#{r.tileId}</span>
							<div class="scores-col">
								{#each mp.players as player}
									{@const s = r.scores[player.userId]}
									{#if s}
										<span class="score-entry" style:color={scoreColor(player.userId)}>
											{s.score} {@render scoreDetail(s)}
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

	@media (max-width: 640px) {
		.panel {
			top: auto;
			left: 0;
			width: 100%;
			max-height: 50vh;
			overflow-y: auto;
			border-left: none;
			border-top: 1px solid #e5e7eb;
			border-radius: 12px 12px 0 0;
		}
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

	@keyframes rowIn {
		from { opacity: 0; transform: translateX(10px); }
		to   { opacity: 1; transform: translateX(0); }
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
		animation: rowIn 0.18s ease-out both;
		animation-delay: calc(var(--anim-index, 0) * 70ms);
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
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
	}

	.score-base {
		font-weight: 400;
		font-size: 0.7rem;
		color: #9ca3af;
	}

	.ability-pill {
		display: inline-block;
		font-size: 0.58rem;
		font-weight: 700;
		color: white;
		padding: 1px 5px;
		border-radius: 10px;
		white-space: nowrap;
		vertical-align: middle;
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
		animation: rowIn 0.18s ease-out both;
		animation-delay: calc(var(--anim-index, 0) * 70ms);
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
