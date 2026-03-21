<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import SaveStatus from './SaveStatus.svelte';
	import ModeSelector from './ModeSelector.svelte';
	import ConnectionDot from './ConnectionDot.svelte';

	type Props = {
		slug: string;
		saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error' | 'merged';
		collaborationMode: 'last-save-wins' | 'auto-merge' | 'real-time';
		onModeChange: (mode: 'last-save-wins' | 'auto-merge' | 'real-time') => void;
		connectionStatus?: 'connected' | 'connecting' | 'disconnected';
	};

	let { slug, saveStatus, collaborationMode, onModeChange, connectionStatus }: Props = $props();

	let isEditing = $state(false);
	let editValue = $state('');
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	async function startEditing() {
		editValue = slug;
		isEditing = true;
		await tick();
		inputEl?.select();
	}

	function cancelEditing() {
		isEditing = false;
	}

	function commitEditing() {
		isEditing = false;
		const trimmed = editValue.trim().replace(/^\/+|\/+$/g, '');
		if (trimmed && trimmed !== slug) {
			goto(`/${trimmed}`);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitEditing();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEditing();
		}
	}
</script>

<header class="header">
	<div class="header-left">
		<a href="/" class="home-link" title="Home">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		</a>
		{#if isEditing}
			<div class="slug-edit-wrapper">
				<span class="slug-prefix">/</span>
				<input
					bind:this={inputEl}
					bind:value={editValue}
					class="slug-input"
					type="text"
					spellcheck="false"
					autocomplete="off"
					onblur={commitEditing}
					onkeydown={handleKeydown}
				/>
			</div>
		{:else}
			<button class="pad-name-btn" type="button" onclick={startEditing} title="Click to navigate to a different pad">
				/{slug}
			</button>
		{/if}
	</div>

	<div class="header-right">
		{#if collaborationMode === 'real-time'}
			<ConnectionDot status={connectionStatus ?? 'disconnected'} />
		{:else}
			<SaveStatus status={saveStatus} />
		{/if}
		<span class="header-mode">
			<ModeSelector slug={slug} mode={collaborationMode} onModeChange={onModeChange} />
		</span>
	</div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-lg);
		background: var(--color-bg-elevated);
		border-bottom: 1px solid var(--color-border);
		height: 48px;
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.home-link {
		display: flex;
		align-items: center;
		color: var(--color-text-muted);
		transition: color 0.15s ease;
		flex-shrink: 0;
	}

	.home-link:hover {
		color: var(--color-accent);
	}

	/* Clickable pad name button */
	.pad-name-btn {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: 2px 6px;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.pad-name-btn:hover {
		background: color-mix(in srgb, var(--color-accent) 8%, transparent);
		border-color: color-mix(in srgb, var(--color-accent) 25%, transparent);
		color: var(--color-accent);
	}

	/* Inline editing */
	.slug-edit-wrapper {
		display: flex;
		align-items: center;
		background: var(--color-bg);
		border: 1.5px solid var(--color-accent);
		border-radius: var(--radius-sm);
		padding: 0 6px;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
	}

	.slug-prefix {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text-muted);
		user-select: none;
		pointer-events: none;
	}

	.slug-input {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		background: transparent;
		border: none;
		outline: none;
		padding: 2px 0;
		width: 200px;
		max-width: 40vw;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.header {
			padding: var(--space-sm) var(--space-md);
		}

		.header-mode {
			display: none;
		}

		.pad-name-btn {
			font-size: var(--font-size-xs);
			max-width: 160px;
		}

		.slug-input {
			width: 140px;
			font-size: var(--font-size-xs);
		}

		.slug-prefix {
			font-size: var(--font-size-xs);
		}
	}
</style>
