<script lang="ts">
	interface Props {
		uuid: string;
		url: string;
		status: 'loading' | 'loaded' | 'error';
		errorMessage?: string;
		onDelete: (uuid: string) => void;
		onClick: (uuid: string, url: string) => void;
		onRetry?: (uuid: string) => void;
		onDismiss?: (uuid: string) => void;
	}

	let { uuid, url, status, errorMessage, onDelete, onClick, onRetry, onDismiss }: Props = $props();
</script>

<div class="image-card" class:image-card-error={status === 'error'} data-uuid={uuid}>
	{#if status === 'loading'}
		<div class="skeleton"></div>
	{:else if status === 'loaded'}
		<button class="image-button" type="button" onclick={() => onClick(uuid, url)}>
			<img src={url} alt="" loading="lazy" draggable="false" />
		</button>
		<button class="delete-btn" type="button" onclick={() => onDelete(uuid)} aria-label="Delete image">
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
		</button>
	{:else if status === 'error'}
		<div class="error-content">
			<p class="error-message">{errorMessage || 'Upload failed'}</p>
			<div class="error-actions">
				{#if onRetry}
					<button class="retry-btn" type="button" onclick={() => onRetry?.(uuid)}>Retry</button>
				{/if}
				{#if onDismiss}
					<button class="dismiss-btn" type="button" onclick={() => onDismiss?.(uuid)} aria-label="Dismiss error">
						<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
							<path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.image-card {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-bg-elevated);
	}

	/* Shimmer skeleton */
	.skeleton {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-bg-elevated) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* Loaded image */
	.image-button {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.image-button img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* Delete button */
	.delete-btn {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.image-card:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	/* Error state */
	.image-card-error {
		background: color-mix(in srgb, var(--color-error) 10%, var(--color-bg-elevated));
		border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
	}

	.error-content {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		gap: var(--space-sm);
	}

	.error-message {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text);
		text-align: center;
		line-height: 1.4;
		word-break: break-word;
	}

	.error-actions {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.retry-btn {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-elevated);
		color: var(--color-text);
		font-size: var(--font-size-xs);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.retry-btn:hover {
		background: var(--color-bg);
	}

	.dismiss-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background: var(--color-bg-elevated);
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease;
	}

	.dismiss-btn:hover {
		background: var(--color-bg);
	}
</style>
