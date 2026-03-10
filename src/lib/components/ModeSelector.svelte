<script lang="ts">
	type Props = {
		slug: string;
		mode: 'last-save-wins' | 'auto-merge' | 'real-time';
		onModeChange: (mode: 'last-save-wins' | 'auto-merge' | 'real-time') => void;
	};

	let { slug, mode, onModeChange }: Props = $props();
	let open = $state(false);

	const modes = [
		{ value: 'last-save-wins', label: 'Last-save-wins' },
		{ value: 'auto-merge', label: 'Auto-merge' },
		{ value: 'real-time', label: 'Real-time' }
	] as const;

	function handleClickOutside(event: MouseEvent) {
		if (open && !(event.target as Element).closest('.mode-selector')) {
			open = false;
		}
	}

	async function select(value: typeof mode) {
		if (value === mode) {
			open = false;
			return;
		}
		try {
			const res = await fetch(`/api/pads/${slug}/mode`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: value })
			});
			if (res.ok) {
				onModeChange(value);
			}
		} catch {
			// Silently fail -- mode stays unchanged
		}
		open = false;
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="mode-selector">
	<button class="mode-trigger" onclick={() => (open = !open)}>
		{modes.find((m) => m.value === mode)?.label}
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M2.5 4L5 6.5L7.5 4" />
		</svg>
	</button>
	{#if open}
		<div class="mode-dropdown">
			{#each modes as m}
				<button
					class="mode-option"
					class:active={m.value === mode}
					onclick={() => select(m.value)}
				>
					{m.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.mode-selector {
		position: relative;
		display: inline-block;
	}

	.mode-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		background: var(--color-bg);
		padding: 2px var(--space-sm);
		border-radius: var(--radius-sm);
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s ease;
	}

	.mode-trigger:hover {
		color: var(--color-text);
	}

	.mode-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--space-xs);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		z-index: 10;
		min-width: 160px;
		overflow: hidden;
	}

	.mode-option {
		display: block;
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: none;
		background: none;
		text-align: left;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		cursor: pointer;
	}

	.mode-option:hover {
		background: var(--color-bg);
	}

	.mode-option.active {
		color: var(--color-accent);
		font-weight: 500;
	}
</style>
