<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { debounce } from '$lib/utils/debounce';
	import Header from '$lib/components/Header.svelte';
	import ConflictBanner from '$lib/components/ConflictBanner.svelte';

	let { data } = $props();

	let content = $state(data.content);
	let version = $state(data.version);
	let saveStatus = $state<'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'>('saved');
	let isSaving = $state(false);
	let conflictData = $state<{ serverContent: string; serverVersion: number } | null>(null);
	let hasEdited = $state(false);

	// Track if content diverged from initial load
	let initialContent = data.content;

	async function performSave() {
		if (isSaving || saveStatus === 'conflict') return;

		isSaving = true;
		saveStatus = 'saving';

		try {
			const res = await fetch(`/api/pads/${data.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content, version })
			});

			if (res.ok) {
				const result = await res.json();
				version = result.version;
				saveStatus = 'saved';
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
			saveStatus = 'error';
		} finally {
			isSaving = false;
		}
	}

	const debouncedSave = debounce(performSave, 400);

	function handleInput(event: Event) {
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

	// Reset state when navigating to a different pad
	$effect(() => {
		if (data.slug) {
			content = data.content;
			version = data.version;
			initialContent = data.content;
			saveStatus = 'saved';
			conflictData = null;
			hasEdited = false;
		}
	});

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
	<Header slug={data.slug} saveStatus={saveStatus} />

	{#if conflictData}
		<ConflictBanner
			serverContent={conflictData.serverContent}
			localContent={content}
			onOverwrite={handleOverwrite}
			onCopyAndReload={handleCopyAndReload}
		/>
	{/if}

	<textarea
		class="editor"
		value={content}
		oninput={handleInput}
		spellcheck="true"
		placeholder="Start typing..."
	></textarea>
</div>

<style>
	.pad-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
	}

	.editor {
		flex: 1;
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
