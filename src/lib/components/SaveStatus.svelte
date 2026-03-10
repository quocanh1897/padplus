<script lang="ts">
	type Props = {
		status: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error' | 'merged' | 'live';
	};

	let { status }: Props = $props();

	const labels: Record<string, string> = {
		saved: 'Saved',
		saving: 'Saving...',
		unsaved: 'Unsaved changes',
		conflict: 'Conflict',
		error: 'Error saving',
		merged: 'Merged',
		live: 'Live'
	};
</script>

<span class="save-status" data-status={status}>
	{labels[status] ?? status}
</span>

<style>
	.save-status {
		font-size: var(--font-size-xs);
		font-weight: 500;
		letter-spacing: 0.02em;
		transition: color 0.2s ease;
	}

	.save-status[data-status='saved'] {
		color: var(--color-success);
	}

	.save-status[data-status='saving'] {
		color: var(--color-text-muted);
	}

	.save-status[data-status='unsaved'] {
		color: var(--color-warning);
	}

	.save-status[data-status='conflict'] {
		color: var(--color-error);
	}

	.save-status[data-status='error'] {
		color: var(--color-error);
	}

	.save-status[data-status='merged'] {
		color: var(--color-success);
	}

	.save-status[data-status='live'] {
		color: var(--color-success);
	}
</style>
