<script lang="ts">
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { debounce } from '$lib/utils/debounce';
	import Header from '$lib/components/Header.svelte';
	import ConflictBanner from '$lib/components/ConflictBanner.svelte';
	import ImageGrid from '$lib/components/ImageGrid.svelte';
	import FileGrid from '$lib/components/FileGrid.svelte';
	import type { ImageItem } from '$lib/components/ImageGrid.svelte';
	import type { FileItem } from '$lib/components/FileGrid.svelte';

	let { data } = $props();

	let content = $state(data.content);
	let version = $state(data.version);
	let collaborationMode = $state(data.collaboration_mode as 'last-save-wins' | 'auto-merge' | 'real-time');
	let connectionStatus = $state<'connected' | 'connecting' | 'disconnected'>('disconnected');
	let saveStatus = $state<'saved' | 'saving' | 'unsaved' | 'conflict' | 'error' | 'merged'>('saved');
	let isSaving = $state(false);
	let conflictData = $state<{ serverContent: string; serverVersion: number } | null>(null);
	let hasEdited = $state(false);

	// Track if content diverged from initial load
	let initialContent = data.content;

	// Image state -- initialized from SSR data
	let images = $state<ImageItem[]>(
		data.images.map((img: { uuid: string; size_bytes: number; sort_order: number }) => ({
			uuid: img.uuid,
			url: `/api/pads/${data.slug}/images/${img.uuid}`,
			status: 'loaded' as const,
			size_bytes: img.size_bytes,
			sort_order: img.sort_order
		}))
	);

	// File state -- initialized from SSR data
	let files = $state<FileItem[]>(
		data.files.map((f: { uuid: string; original_name: string; size_bytes: number; mime_type: string; sort_order: number }) => ({
			uuid: f.uuid,
			originalName: f.original_name,
			sizeBytes: f.size_bytes,
			mimeType: f.mime_type,
			downloadUrl: `/api/pads/${data.slug}/files/${f.uuid}`,
			status: 'loaded' as const,
			sort_order: f.sort_order
		}))
	);

	// Store original File objects for retry functionality
	const retryFiles = new Map<string, File>();
	const retryFileUploads = new Map<string, File>();

	const MAX_FILE_SIZE = data.maxFileSize;

	async function performSave() {
		if (isSaving || saveStatus === 'conflict') return;

		// Capture slug at save time to prevent cross-pad saves after navigation
		const saveSlug = data.slug;

		isSaving = true;
		saveStatus = 'saving';

		try {
			const res = await fetch(`/api/pads/${saveSlug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content, version })
			});

			// Discard response if we navigated away during the save
			if (saveSlug !== data.slug) return;

			if (res.ok) {
				const result = await res.json();
				if (result.merged) {
					// Auto-merge succeeded -- update content and version
					// Preserve cursor position (Research Pitfall 6)
					const textarea = document.querySelector('textarea.editor') as HTMLTextAreaElement;
					const cursorStart = textarea?.selectionStart ?? 0;
					const cursorEnd = textarea?.selectionEnd ?? 0;

					content = result.content;
					version = result.version;
					saveStatus = 'merged';

					// Restore cursor after Svelte reactive update
					await tick();
					if (textarea) {
						textarea.selectionStart = Math.min(cursorStart, content.length);
						textarea.selectionEnd = Math.min(cursorEnd, content.length);
					}

					// Show "Merged" briefly, then transition to "Saved"
					setTimeout(() => {
						if (saveStatus === 'merged') saveStatus = 'saved';
					}, 2000);

					// If had conflicts (overlapping edits), show conflict banner for user review
					if (result.hadConflicts) {
						conflictData = {
							serverContent: result.content,
							serverVersion: result.version
						};
						saveStatus = 'conflict';
					}
				} else {
					version = result.version;
					saveStatus = 'saved';
				}
			} else if (res.status === 409) {
				const result = await res.json();
				conflictData = {
					serverContent: result.content,
					serverVersion: result.version
				};
				saveStatus = 'conflict';
			} else {
				saveStatus = 'error';
			}
		} catch {
			if (saveSlug !== data.slug) return;
			saveStatus = 'error';
		} finally {
			isSaving = false;
		}
	}

	const debouncedSave = debounce(performSave, 400);

	function handleInput(event: Event) {
		// In real-time mode, Yjs handles sync -- no auto-save
		if (collaborationMode === 'real-time') return;

		const textarea = event.target as HTMLTextAreaElement;
		content = textarea.value;

		if (!hasEdited) {
			hasEdited = true;
			return; // Don't save on first edit to avoid saving the initial value
		}

		if (saveStatus !== 'conflict') {
			saveStatus = 'unsaved';
			debouncedSave();
		}
	}

	function handleModeChange(mode: 'last-save-wins' | 'auto-merge' | 'real-time') {
		const wasRealtime = collaborationMode === 'real-time';
		collaborationMode = mode;

		if (wasRealtime && mode !== 'real-time') {
			// Exiting real-time mode: reload SSR data to get latest content from Yjs persistence
			connectionStatus = 'disconnected';
			invalidateAll().then(() => {
				content = data.content;
				version = data.version;
				hasEdited = false;
				saveStatus = 'saved';
			});
		}
	}

	// Reset state when navigating to a different pad
	$effect(() => {
		if (data.slug) {
			debouncedSave.cancel(); // Cancel any pending save from previous page
			content = data.content;
			version = data.version;
			collaborationMode = data.collaboration_mode as 'last-save-wins' | 'auto-merge' | 'real-time';
			initialContent = data.content;
			saveStatus = 'saved';
			isSaving = false;
			conflictData = null;
			hasEdited = false;
			images = data.images.map((img: { uuid: string; size_bytes: number; sort_order: number }) => ({
				uuid: img.uuid,
				url: `/api/pads/${data.slug}/images/${img.uuid}`,
				status: 'loaded' as const,
				size_bytes: img.size_bytes,
				sort_order: img.sort_order
			}));
			files = data.files.map((f: { uuid: string; original_name: string; size_bytes: number; mime_type: string; sort_order: number }) => ({
				uuid: f.uuid,
				originalName: f.original_name,
				sizeBytes: f.size_bytes,
				mimeType: f.mime_type,
				downloadUrl: `/api/pads/${data.slug}/files/${f.uuid}`,
				status: 'loaded' as const,
				sort_order: f.sort_order
			}));
			retryFiles.clear();
			retryFileUploads.clear();
		}
	});

	// Document-level paste handler
	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				event.preventDefault();
				const file = item.getAsFile();
				if (file) uploadImage(file);
				return; // Only process first image
			}
		}
		// No image found -- let text paste propagate naturally
	}

	$effect(() => {
		document.addEventListener('paste', handlePaste);
		return () => document.removeEventListener('paste', handlePaste);
	});

	// Image upload
	function addErrorCard(message: string) {
		const tempId = crypto.randomUUID();
		images = [...images, {
			uuid: tempId,
			url: '',
			status: 'error' as const,
			errorMessage: message,
			size_bytes: 0,
			sort_order: images.length
		}];
	}

	async function uploadImage(file: File) {
		// Client-side size check
		if (file.size > 5 * 1024 * 1024) {
			addErrorCard('Image too large (5MB max)');
			return;
		}

		const tempId = crypto.randomUUID();
		const skeleton: ImageItem = {
			uuid: tempId,
			url: '',
			status: 'loading',
			size_bytes: 0,
			sort_order: images.length
		};
		images = [...images, skeleton];

		// Store file for retry
		retryFiles.set(tempId, file);

		const formData = new FormData();
		formData.append('image', file);

		try {
			const res = await fetch(`/api/pads/${data.slug}/images`, {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Upload failed' }));
				images = images.map(img =>
					img.uuid === tempId
						? { ...img, status: 'error' as const, errorMessage: err.message || 'Upload failed' }
						: img
				);
				return;
			}

			const result = await res.json();
			// Upload succeeded -- remove from retry map
			retryFiles.delete(tempId);
			images = images.map(img =>
				img.uuid === tempId
					? {
						...img,
						uuid: result.id,
						url: `/api/pads/${data.slug}/images/${result.id}`,
						status: 'loaded' as const,
						size_bytes: result.size,
						sort_order: result.sort_order
					}
					: img
			);
		} catch {
			images = images.map(img =>
				img.uuid === tempId
					? { ...img, status: 'error' as const, errorMessage: 'Upload failed -- check your connection' }
					: img
			);
		}
	}

	async function handleDeleteImage(uuid: string) {
		// Optimistically remove from UI
		const prev = images;
		images = images.filter(img => img.uuid !== uuid);

		try {
			const res = await fetch(`/api/pads/${data.slug}/images/${uuid}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				// Restore on failure
				images = prev;
			}
		} catch {
			images = prev;
		}
	}

	async function handleReorder(orders: { uuid: string; sort_order: number }[]) {
		// Optimistically update local sort orders
		const orderMap = new Map(orders.map(o => [o.uuid, o.sort_order]));
		images = images
			.map(img => ({ ...img, sort_order: orderMap.get(img.uuid) ?? img.sort_order }))
			.sort((a, b) => a.sort_order - b.sort_order);

		try {
			await fetch(`/api/pads/${data.slug}/images/reorder`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orders })
			});
		} catch {
			// Reorder is best-effort; UI already reflects the new order
		}
	}

	function handleRetry(uuid: string) {
		const file = retryFiles.get(uuid);
		// Remove the error card
		images = images.filter(img => img.uuid !== uuid);
		retryFiles.delete(uuid);

		if (file) {
			// Re-upload the stored file
			uploadImage(file);
		}
	}

	function handleDismiss(uuid: string) {
		images = images.filter(img => img.uuid !== uuid);
		retryFiles.delete(uuid);
	}

	// ---- File upload ----
	function addFileErrorCard(message: string) {
		const tempId = crypto.randomUUID();
		files = [...files, {
			uuid: tempId,
			originalName: 'Error',
			sizeBytes: 0,
			mimeType: '',
			downloadUrl: '',
			status: 'error' as const,
			errorMessage: message,
			sort_order: files.length
		}];
	}

	async function uploadFile(file: File) {
		// Client-side size check
		if (file.size > MAX_FILE_SIZE) {
			const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
			const label = maxMB >= 1024 ? `${Math.round(maxMB / 1024)}GB` : `${maxMB}MB`;
			addFileErrorCard(`"${file.name}" is too large (${label} max)`);
			return;
		}

		const tempId = crypto.randomUUID();
		const skeleton: FileItem = {
			uuid: tempId,
			originalName: file.name,
			sizeBytes: file.size,
			mimeType: file.type || 'application/octet-stream',
			downloadUrl: '',
			status: 'loading',
			sort_order: files.length
		};
		files = [...files, skeleton];

		// Store file for retry
		retryFileUploads.set(tempId, file);

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch(`/api/pads/${data.slug}/files`, {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Upload failed' }));
				files = files.map(f =>
					f.uuid === tempId
						? { ...f, status: 'error' as const, errorMessage: err.message || 'Upload failed' }
						: f
				);
				return;
			}

			const result = await res.json();
			retryFileUploads.delete(tempId);
			files = files.map(f =>
				f.uuid === tempId
					? {
						...f,
						uuid: result.id,
						originalName: result.original_name,
						sizeBytes: result.size,
						mimeType: result.mime_type,
						downloadUrl: `/api/pads/${data.slug}/files/${result.id}`,
						status: 'loaded' as const,
						sort_order: result.sort_order
					}
					: f
			);
		} catch {
			files = files.map(f =>
				f.uuid === tempId
					? { ...f, status: 'error' as const, errorMessage: 'Upload failed -- check your connection' }
					: f
			);
		}
	}

	function handleFileUpload(uploadedFiles: File[]) {
		for (const file of uploadedFiles) {
			uploadFile(file);
		}
	}

	async function handleDeleteFile(uuid: string) {
		const prev = files;
		files = files.filter(f => f.uuid !== uuid);

		try {
			const res = await fetch(`/api/pads/${data.slug}/files/${uuid}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				files = prev;
			}
		} catch {
			files = prev;
		}
	}

	function handleFileRetry(uuid: string) {
		const file = retryFileUploads.get(uuid);
		files = files.filter(f => f.uuid !== uuid);
		retryFileUploads.delete(uuid);

		if (file) {
			uploadFile(file);
		}
	}

	function handleFileDismiss(uuid: string) {
		files = files.filter(f => f.uuid !== uuid);
		retryFileUploads.delete(uuid);
	}

	function handleOverwrite() {
		if (!conflictData) return;
		version = conflictData.serverVersion;
		conflictData = null;
		saveStatus = 'unsaved';
		performSave();
	}

	async function handleCopyAndReload() {
		if (browser) {
			try {
				await navigator.clipboard.writeText(content);
			} catch {
				// Clipboard API may fail in some contexts; fallback is to just reload
			}
		}
		conflictData = null;
		saveStatus = 'saved';
		await invalidateAll();
		// After invalidation, reset local state from fresh data
		content = data.content;
		version = data.version;
		hasEdited = false;
	}
</script>

<svelte:head>
	<title>{data.slug} - PadPlus</title>
</svelte:head>

<div class="pad-layout">
	<Header slug={data.slug} {saveStatus} {collaborationMode} onModeChange={handleModeChange} {connectionStatus} />

	{#if conflictData}
		<ConflictBanner
			serverContent={conflictData.serverContent}
			localContent={content}
			onOverwrite={handleOverwrite}
			onCopyAndReload={handleCopyAndReload}
		/>
	{/if}

	<div class="content-area">
		{#if collaborationMode === 'real-time'}
			{#key data.slug}
				{#await import('$lib/components/RealtimeEditor.svelte') then module}
					<module.default
						slug={data.slug}
						initialContent={content}
						onStatusChange={(status) => connectionStatus = status}
					/>
				{/await}
			{/key}
		{:else}
			<textarea
				class="editor"
				value={content}
				oninput={handleInput}
				spellcheck="true"
				placeholder="Start typing..."
			></textarea>
		{/if}

		<ImageGrid
			{images}
			onDelete={handleDeleteImage}
			onReorder={handleReorder}
			onRetry={handleRetry}
			onDismiss={handleDismiss}
		/>

		<FileGrid
			{files}
			maxFileSize={MAX_FILE_SIZE}
			onUpload={handleFileUpload}
			onDelete={handleDeleteFile}
			onRetry={handleFileRetry}
			onDismiss={handleFileDismiss}
		/>
	</div>
</div>

<style>
	.pad-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
	}

	.content-area {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.editor {
		min-height: 60vh;
		width: 100%;
		padding: var(--space-lg);
		border: none;
		outline: none;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--font-size-lg);
		line-height: var(--line-height);
		resize: none;
		flex-shrink: 0;
	}

	.editor::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	@media (max-width: 640px) {
		.editor {
			padding: var(--space-md);
			font-size: var(--font-size-base);
		}
	}
</style>
