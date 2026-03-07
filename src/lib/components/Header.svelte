<script lang="ts">
	import SaveStatus from './SaveStatus.svelte';

	type Props = {
		slug: string;
		saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
	};

	let { slug, saveStatus }: Props = $props();
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
		<SaveStatus status={saveStatus} />
		<span class="collab-mode">last-save-wins</span>
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

	.collab-mode {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		background: var(--color-bg);
		padding: 2px var(--space-sm);
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.header {
			padding: var(--space-sm) var(--space-md);
		}

		.collab-mode {
			display: none;
		}

		.pad-name {
			font-size: var(--font-size-xs);
			max-width: 160px;
		}
	}
</style>
