<script lang="ts">
	import { goto } from '$app/navigation';

	let slug = $state('');

	function navigate(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = slug.trim().replace(/^\/+|\/+$/g, '');
		if (trimmed) {
			goto(`/${trimmed}`);
		}
	}
</script>

<svelte:head>
	<title>PadPlus</title>
</svelte:head>

<main class="landing">
	<div class="hero">
		<h1 class="brand">PadPlus</h1>
		<p class="tagline">Type a name, start writing</p>
	</div>

	<form class="url-bar" onsubmit={navigate}>
		<div class="url-input-wrapper">
			<span class="url-prefix">padplus/</span>
			<input
				type="text"
				bind:value={slug}
				placeholder="meeting-notes"
				class="url-input"
				autofocus
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
		<button type="submit" class="go-button" disabled={!slug.trim()}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="5" y1="12" x2="19" y2="12" />
				<polyline points="12 5 19 12 12 19" />
			</svg>
		</button>
	</form>
</main>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		padding: var(--space-lg);
	}

	.hero {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.brand {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0 0 var(--space-sm);
		letter-spacing: -0.02em;
	}

	.tagline {
		font-size: var(--font-size-lg);
		color: var(--color-text-muted);
		margin: 0;
	}

	.url-bar {
		display: flex;
		align-items: stretch;
		width: 100%;
		max-width: 560px;
		gap: var(--space-sm);
	}

	.url-input-wrapper {
		display: flex;
		align-items: center;
		flex: 1;
		background: var(--color-bg-elevated);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0 var(--space-md);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.url-input-wrapper:focus-within {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
	}

	.url-prefix {
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
		white-space: nowrap;
		user-select: none;
		pointer-events: none;
	}

	.url-input {
		flex: 1;
		border: none;
		outline: none;
		background: transparent;
		font-size: var(--font-size-lg);
		padding: var(--space-md) 0;
		min-width: 0;
	}

	.url-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.go-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		background: var(--color-accent);
		color: #fff;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 0.15s ease, opacity 0.15s ease;
		flex-shrink: 0;
	}

	.go-button:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}

	.go-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.brand {
			font-size: 2rem;
		}

		.tagline {
			font-size: var(--font-size-base);
		}

		.url-prefix {
			font-size: var(--font-size-base);
		}

		.url-input {
			font-size: var(--font-size-base);
		}

		.hero {
			margin-bottom: var(--space-lg);
		}
	}
</style>
