<script lang="ts">
	import { createGame, joinGame } from '$lib/db.js';
	import { goto } from '$app/navigation';

	let mode: 'home' | 'create' | 'join' = $state('home');
	let displayName = $state('');
	let roomCode = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleCreate() {
		if (!displayName.trim()) { error = 'Enter a display name'; return; }
		loading = true; error = '';
		try {
			const result = await createGame(displayName.trim());
			localStorage.setItem('madripoor_session', JSON.stringify({
				gameId: result.gameId,
				roomCode: result.roomCode,
				myUserId: result.myUserId,
				myPlayerId: result.myPlayerId,
				myPlayerIndex: 0,
				displayName: displayName.trim()
			}));
			goto(`/${result.roomCode}`);
		} catch (e) {
			error = 'Failed to create game. Try again.';
			loading = false;
		}
	}

	async function handleJoin() {
		if (!displayName.trim()) { error = 'Enter a display name'; return; }
		if (!roomCode.trim()) { error = 'Enter a room code'; return; }
		loading = true; error = '';
		const result = await joinGame(roomCode.trim().toUpperCase(), displayName.trim());
		if ('error' in result) {
			error = result.error;
			loading = false;
			return;
		}
		localStorage.setItem('madripoor_session', JSON.stringify({
			gameId: result.gameId,
			roomCode: roomCode.trim().toUpperCase(),
			myUserId: result.myUserId,
			myPlayerId: result.myPlayerId,
			myPlayerIndex: 1,
			displayName: displayName.trim()
		}));
		goto(`/${roomCode.trim().toUpperCase()}`);
	}
</script>

<main>
	<h1>Madripoor</h1>

	{#if mode === 'home'}
		<div class="menu">
			<button onclick={() => { mode = 'create'; error = ''; }}>Create Game</button>
			<button onclick={() => { mode = 'join'; error = ''; }}>Join Game</button>
			<a href="/solo" class="solo-link">Play vs CPU</a>
		</div>
	{:else if mode === 'create'}
		<div class="form">
			<h2>Create Game</h2>
			<input
				type="text"
				placeholder="Your name"
				bind:value={displayName}
				maxlength={20}
				onkeydown={(e) => e.key === 'Enter' && handleCreate()}
			/>
			{#if error}<p class="error">{error}</p>{/if}
			<div class="form-actions">
				<button onclick={handleCreate} disabled={loading}>
					{loading ? 'Creating…' : 'Create →'}
				</button>
				<button class="back" onclick={() => { mode = 'home'; error = ''; }}>Back</button>
			</div>
		</div>
	{:else}
		<div class="form">
			<h2>Join Game</h2>
			<input
				type="text"
				placeholder="Room code"
				bind:value={roomCode}
				maxlength={6}
				style="text-transform: uppercase; letter-spacing: 0.15em"
			/>
			<input
				type="text"
				placeholder="Your name"
				bind:value={displayName}
				maxlength={20}
				onkeydown={(e) => e.key === 'Enter' && handleJoin()}
			/>
			{#if error}<p class="error">{error}</p>{/if}
			<div class="form-actions">
				<button onclick={handleJoin} disabled={loading}>
					{loading ? 'Joining…' : 'Join →'}
				</button>
				<button class="back" onclick={() => { mode = 'home'; error = ''; }}>Back</button>
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		font-family: sans-serif;
		gap: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		letter-spacing: 0.08em;
	}

	h2 {
		margin: 0 0 1rem;
		font-size: 1.2rem;
	}

	.menu {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.menu button, .menu .solo-link {
		width: 200px;
		padding: 12px 0;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
	}

	.menu button {
		background: #1d4ed8;
		color: white;
		border: none;
	}

	.menu button:hover {
		background: #1e40af;
	}

	.menu .solo-link {
		background: transparent;
		color: #6b7280;
		border: 1.5px solid #d1d5db;
		display: block;
	}

	.menu .solo-link:hover {
		border-color: #9ca3af;
		color: #374151;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 280px;
	}

	input {
		padding: 10px 12px;
		border: 1.5px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		outline: none;
	}

	input:focus {
		border-color: #1d4ed8;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
	}

	.form-actions button {
		flex: 1;
		padding: 10px 0;
		font-size: 0.95rem;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		border: none;
	}

	.form-actions button:first-child {
		background: #1d4ed8;
		color: white;
	}

	.form-actions button:first-child:disabled {
		background: #93c5fd;
		cursor: not-allowed;
	}

	.form-actions button:first-child:not(:disabled):hover {
		background: #1e40af;
	}

	.form-actions button.back {
		background: #f3f4f6;
		color: #374151;
	}

	.form-actions button.back:hover {
		background: #e5e7eb;
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #dc2626;
	}
</style>
