<script lang="ts">
	type Props = {
		serverContent: string;
		localContent: string;
		onOverwrite: () => void;
		onCopyAndReload: () => void;
	};

	let { serverContent, localContent, onOverwrite, onCopyAndReload }: Props = $props();
</script>

<div class="conflict-banner" role="alert">
	<div class="conflict-content">
		<div class="conflict-icon">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
		</div>
		<div class="conflict-details">
			<p class="conflict-message">
				This pad was modified by someone else since you started editing.
			</p>
			<p class="conflict-comparison">
				Your version: {localContent.length} characters &middot; Server version: {serverContent.length} characters
			</p>
		</div>
	</div>
	<div class="conflict-actions">
		<button class="btn btn-secondary" onclick={onCopyAndReload}>
			Copy my version &amp; reload
		</button>
		<button class="btn btn-danger" onclick={onOverwrite}>
			Overwrite with my version
		</button>
	</div>
</div>

<style>
	.conflict-banner {
		background: color-mix(in srgb, var(--color-error) 8%, var(--color-bg-elevated));
		border-bottom: 2px solid var(--color-error);
		padding: var(--space-md) var(--space-lg);
	}

	.conflict-content {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.conflict-icon {
		color: var(--color-error);
		flex-shrink: 0;
		margin-top: 1px;
	}

	.conflict-details {
		flex: 1;
		min-width: 0;
	}

	.conflict-message {
		margin: 0;
		font-weight: 500;
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	.conflict-comparison {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.conflict-actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--space-xs) var(--space-md);
		border: none;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		white-space: nowrap;
	}

	.btn-secondary {
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-border);
	}

	.btn-danger {
		background: var(--color-error);
		color: #fff;
	}

	.btn-danger:hover {
		background: color-mix(in srgb, var(--color-error) 85%, #000);
	}

	@media (max-width: 640px) {
		.conflict-banner {
			padding: var(--space-sm) var(--space-md);
		}

		.conflict-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
