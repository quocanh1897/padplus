<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	type Props = {
		slug: string;
		initialContent: string;
		onStatusChange: (status: 'connected' | 'connecting' | 'disconnected') => void;
	};

	let { slug, initialContent, onStatusChange }: Props = $props();

	let textareaEl: HTMLTextAreaElement;
	let synced = $state(false);

	// Store references for cleanup
	let binding: { destroy: () => void } | null = null;
	let provider: { disconnect: () => void; destroy: () => void } | null = null;
	let doc: { destroy: () => void } | null = null;

	onMount(async () => {
		const Y = await import('yjs');
		const { WebsocketProvider } = await import('y-websocket');
		const { TextAreaBinding } = await import('y-textarea');

		const ydoc = new Y.Doc();
		const ytext = ydoc.getText('content');

		const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/pads`;

		const wsProvider = new WebsocketProvider(wsUrl, slug, ydoc, {
			connect: true,
			maxBackoffTime: 5000
		});

		// Track connection status
		wsProvider.on('status', (event: { status: string }) => {
			if (event.status === 'connected') {
				onStatusChange('connected');
			} else if (event.status === 'connecting') {
				onStatusChange('connecting');
			} else {
				onStatusChange('disconnected');
			}
		});

		// Wait for initial sync before binding textarea
		wsProvider.on('sync', (isSynced: boolean) => {
			if (isSynced && !binding) {
				binding = new TextAreaBinding(ytext, textareaEl);
				synced = true;
			}
		});

		// Store references for cleanup
		provider = wsProvider;
		doc = ydoc;
	});

	onDestroy(() => {
		binding?.destroy();
		provider?.disconnect();
		provider?.destroy();
		doc?.destroy();
	});
</script>

<textarea
	bind:this={textareaEl}
	class="editor"
	value={initialContent}
	readonly={!synced}
	placeholder="Connecting..."
	spellcheck="true"
	style:opacity={synced ? '1' : '0.7'}
	style:transition="opacity 0.3s ease"
></textarea>
