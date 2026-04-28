<script lang="ts">
	import { mp, isHost } from '$lib/game/multiplayerStore.svelte.js';
	import { startGame } from '$lib/db.js';

	let copying = $state(false);

	async function copyLink() {
		await navigator.clipboard.writeText(`${location.origin}/${mp.roomCode}`);
		copying = true;
		setTimeout(() => (copying = false), 1500);
	}

	async function handleStart() {
		if (!mp.gameId) return;
		await startGame(mp.gameId);
	}

	const canStart = $derived(mp.players.length >= mp.maxPlayers);
	const waitingCount = $derived(mp.maxPlayers - mp.players.length);
</script>

<div class="lobby">
	<h1>Madripoor</h1>

	<div class="room-card">
		<p class="room-label">Room Code</p>
		<p class="room-code">{mp.roomCode}</p>
		<button class="copy-btn" onclick={copyLink}>
			{copying ? 'Copied!' : 'Copy Link'}
		</button>
	</div>

	<div class="players-section">
		<h2>Players</h2>
		<ul class="player-list">
			{#each mp.players as player (player.userId)}
				<li class="player-item">
					<span class="player-dot"></span>
					{player.displayName}
					{#if player.playerIndex === 0}
						<span class="host-badge">Host</span>
					{/if}
					{#if player.userId === mp.myUserId}
						<span class="you-badge">You</span>
					{/if}
				</li>
			{/each}
			{#each { length: waitingCount } as _, i}
				<li class="player-item waiting">
					<span class="player-dot empty"></span>
					Waiting for player {mp.players.length + i + 1}…
				</li>
			{/each}
		</ul>
	</div>

	{#if isHost()}
		<button class="start-btn" onclick={handleStart} disabled={!canStart}>
			{canStart ? 'Start Game →' : `Waiting for ${mp.maxPlayers} players…`}
		</button>
	{:else}
		<p class="waiting-msg">Waiting for host to start…</p>
	{/if}
</div>

<style>
	.lobby {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		font-family: sans-serif;
		gap: 2rem;
		padding: 2rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		letter-spacing: 0.08em;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b7280;
	}

	.room-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 1.5rem 2.5rem;
		border: 1.5px solid #e5e7eb;
		border-radius: 12px;
		background: #f9fafb;
	}

	.room-label {
		margin: 0;
		font-size: 0.75rem;
		color: #9ca3af;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.room-code {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: 0.25em;
		font-family: monospace;
	}

	.copy-btn {
		margin-top: 4px;
		padding: 6px 14px;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.82rem;
		cursor: pointer;
		color: #374151;
	}

	.copy-btn:hover {
		background: #f3f4f6;
	}

	.players-section {
		width: 100%;
		max-width: 280px;
	}

	.player-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.95rem;
	}

	.player-item.waiting {
		color: #9ca3af;
		font-style: italic;
	}

	.player-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #16a34a;
		flex-shrink: 0;
	}

	.player-dot.empty {
		background: #d1d5db;
	}

	.host-badge, .you-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 8px;
	}

	.host-badge {
		background: #fef3c7;
		color: #d97706;
	}

	.you-badge {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.start-btn {
		padding: 12px 32px;
		background: #1d4ed8;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.start-btn:disabled {
		background: #93c5fd;
		cursor: not-allowed;
	}

	.start-btn:not(:disabled):hover {
		background: #1e40af;
	}

	.waiting-msg {
		margin: 0;
		color: #6b7280;
		font-size: 0.9rem;
	}
</style>
