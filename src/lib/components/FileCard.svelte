<script lang="ts">
	interface Props {
		uuid: string;
		originalName: string;
		sizeBytes: number;
		mimeType: string;
		downloadUrl: string;
		status: 'loading' | 'loaded' | 'error';
		progress?: number;
		errorMessage?: string;
		onDelete: (uuid: string) => void;
		onRetry?: (uuid: string) => void;
		onDismiss?: (uuid: string) => void;
	}

	let { uuid, originalName, sizeBytes, mimeType, downloadUrl, status, progress, errorMessage, onDelete, onRetry, onDismiss }: Props = $props();

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
	}

	function getFileIcon(mime: string, name: string): string {
		if (mime.startsWith('video/')) return '🎬';
		if (mime.startsWith('audio/')) return '🎵';
		if (mime.startsWith('image/')) return '🖼';
		if (mime === 'application/pdf') return '📄';
		if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return '📦';
		if (mime.includes('spreadsheet') || name.endsWith('.csv') || name.endsWith('.xlsx')) return '📊';
		if (mime.includes('presentation') || name.endsWith('.pptx')) return '📽';
		if (mime.includes('document') || name.endsWith('.docx') || name.endsWith('.doc')) return '📝';
		if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return '📃';
		if (mime.includes('json') || name.endsWith('.json')) return '{ }';
		return '📎';
	}

	function getExtension(name: string): string {
		const parts = name.split('.');
		if (parts.length < 2) return '';
		return parts.pop()!.toUpperCase();
	}
</script>

<div class="file-card" class:file-card-error={status === 'error'} data-uuid={uuid}>
	{#if status === 'loading'}
		<div class="file-loading">
			<div class="file-icon-area">
				<span class="file-icon-placeholder">⏳</span>
			</div>
			<div class="file-info">
				<span class="file-name" title={originalName}>{originalName}</span>
				{#if progress != null && progress > 0}
					<div class="progress-bar">
						<div class="progress-fill" style="width: {progress}%"></div>
					</div>
				{:else}
					<span class="file-meta">Uploading…</span>
				{/if}
			</div>
		</div>
	{:else if status === 'loaded'}
		<a class="file-link" href={downloadUrl} download={originalName} title="Download {originalName}">
			<div class="file-icon-area">
				<span class="file-icon">{getFileIcon(mimeType, originalName)}</span>
				{#if getExtension(originalName)}
					<span class="file-ext">{getExtension(originalName)}</span>
				{/if}
			</div>
			<div class="file-info">
				<span class="file-name">{originalName}</span>
				<span class="file-meta">{formatSize(sizeBytes)}</span>
			</div>
		</a>
		<button class="delete-btn" type="button" onclick={() => onDelete(uuid)} aria-label="Delete file">
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
	.file-card {
		position: relative;
		border-radius: var(--radius-md);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		overflow: hidden;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.file-card:hover {
		border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	/* Link state */
	.file-link {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		text-decoration: none;
		color: inherit;
		min-height: 56px;
	}

	.file-link:hover {
		color: inherit;
	}

	/* Loading state */
	.file-loading {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		min-height: 56px;
		opacity: 0.7;
	}

	/* Icon area */
	.file-icon-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		width: 36px;
	}

	.file-icon, .file-icon-placeholder {
		font-size: 1.25rem;
		line-height: 1;
	}

	.file-ext {
		font-size: 9px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: 2px;
	}

	/* File info */
	.file-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.file-name {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-meta {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/* Progress bar */
	.progress-bar {
		width: 100%;
		height: 3px;
		background: var(--color-border);
		border-radius: 2px;
		overflow: hidden;
		margin-top: 2px;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-accent);
		border-radius: 2px;
		transition: width 0.2s ease;
	}

	/* Delete button */
	.delete-btn {
		position: absolute;
		top: 50%;
		right: var(--space-sm);
		transform: translateY(-50%);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.06);
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s ease, background 0.15s ease;
	}

	.file-card:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(0, 0, 0, 0.12);
		color: var(--color-error);
	}

	@media (prefers-color-scheme: dark) {
		.delete-btn {
			background: rgba(255, 255, 255, 0.08);
		}
		.delete-btn:hover {
			background: rgba(255, 255, 255, 0.15);
		}
	}

	/* Error state */
	.file-card-error {
		background: color-mix(in srgb, var(--color-error) 10%, var(--color-bg-elevated));
		border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
	}

	.error-content {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		gap: var(--space-sm);
		min-height: 56px;
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
