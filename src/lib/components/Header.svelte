<script lang="ts">
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
</script>

<header class="header">
	<div class="header-left">
		<a href="/" class="home-link" title="Home">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		</a>
		<span class="pad-name">/{slug}</span>
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

	.pad-name {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

		.pad-name {
			font-size: var(--font-size-xs);
			max-width: 160px;
		}
	}
</style>
