<script lang="ts">
	import FileCard from './FileCard.svelte';

	export interface FileItem {
		uuid: string;
		originalName: string;
		sizeBytes: number;
		mimeType: string;
		downloadUrl: string;
		status: 'loading' | 'loaded' | 'error';
		progress?: number;
		errorMessage?: string;
		sort_order: number;
	}

	interface Props {
		files: FileItem[];
		onUpload: (files: File[]) => void;
		onDelete: (uuid: string) => void;
		onRetry: (uuid: string) => void;
		onDismiss: (uuid: string) => void;
	}

	let { files, onUpload, onDelete, onRetry, onDismiss }: Props = $props();

	let isDragging = $state(false);
	let dragCounter = $state(0);
	let fileInputEl = $state<HTMLInputElement | undefined>(undefined);

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		// Check that dragged data contains files (not text, images, etc.)
		if (e.dataTransfer?.types.includes('Files')) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDragging = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
		dragCounter = 0;

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			// Filter out image files (those are handled by the paste/image flow)
			const nonImageFiles = Array.from(droppedFiles).filter(
				f => !f.type.startsWith('image/')
			);
			if (nonImageFiles.length > 0) {
				onUpload(nonImageFiles);
			}
		}
	}

	function handleFileInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			onUpload(Array.from(input.files));
			input.value = ''; // Reset so the same file can be re-selected
		}
	}

	function openFilePicker() {
		fileInputEl?.click();
	}
</script>

<section
	class="file-section"
	class:dragging={isDragging}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	aria-label="Files"
>
	{#if files.length > 0}
		<span class="file-label">Files</span>
		<div class="file-grid">
			{#each files as file (file.uuid)}
				<FileCard
					uuid={file.uuid}
					originalName={file.originalName}
					sizeBytes={file.sizeBytes}
					mimeType={file.mimeType}
					downloadUrl={file.downloadUrl}
					status={file.status}
					progress={file.progress}
					errorMessage={file.errorMessage}
					{onDelete}
					{onRetry}
					{onDismiss}
				/>
			{/each}
		</div>
	{/if}

	<!-- Drop zone / upload trigger -->
	<div class="drop-zone" class:drop-zone-active={isDragging} class:drop-zone-empty={files.length === 0}>
		{#if isDragging}
			<div class="drop-zone-content">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
				<span>Drop files here</span>
			</div>
		{:else}
			<button class="drop-zone-trigger" type="button" onclick={openFilePicker}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				<span>Drop files here or <strong>browse</strong></span>
				<span class="size-hint">Max 250 MB per file</span>
			</button>
		{/if}
	</div>

	<input
		bind:this={fileInputEl}
		type="file"
		multiple
		class="file-input-hidden"
		onchange={handleFileInputChange}
	/>
</section>

<style>
	.file-section {
		border-top: 1px solid var(--color-border);
		padding: var(--space-md) var(--space-lg) var(--space-lg);
		position: relative;
		transition: background 0.2s ease;
	}

	.file-section.dragging {
		background: color-mix(in srgb, var(--color-accent) 5%, var(--color-bg));
	}

	.file-label {
		display: block;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.file-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	/* Drop zone */
	.drop-zone {
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		transition: border-color 0.2s ease, background 0.2s ease;
	}

	.drop-zone-active {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 8%, transparent);
	}

	.drop-zone-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-lg);
		color: var(--color-accent);
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.drop-zone-trigger {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		width: 100%;
		padding: var(--space-md) var(--space-lg);
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.drop-zone-trigger:hover {
		color: var(--color-accent);
	}

	.drop-zone-trigger strong {
		color: var(--color-accent);
	}

	.size-hint {
		font-size: var(--font-size-xs);
		opacity: 0.7;
	}

	.file-input-hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	@media (max-width: 640px) {
		.file-section {
			padding: var(--space-sm) var(--space-md) var(--space-md);
		}

		.file-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
