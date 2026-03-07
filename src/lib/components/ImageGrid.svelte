<script lang="ts">
	import ImageCard from './ImageCard.svelte';
	import Lightbox from './Lightbox.svelte';
	import type Sortable from 'sortablejs';

	export interface ImageItem {
		uuid: string;
		url: string;
		status: 'loading' | 'loaded' | 'error';
		errorMessage?: string;
		size_bytes: number;
		sort_order: number;
	}

	interface Props {
		images: ImageItem[];
		onDelete: (uuid: string) => void;
		onReorder: (orders: { uuid: string; sort_order: number }[]) => void;
		onRetry: (uuid: string) => void;
		onDismiss: (uuid: string) => void;
	}

	let { images, onDelete, onReorder, onRetry, onDismiss }: Props = $props();

	let gridEl = $state<HTMLDivElement | undefined>(undefined);
	let lightboxUrl = $state<string | null>(null);

	function handleImageClick(_uuid: string, url: string) {
		lightboxUrl = url;
	}

	function closeLightbox() {
		lightboxUrl = null;
	}

	// SortableJS integration (dynamic import for SSR safety)
	$effect(() => {
		if (!gridEl || images.length === 0) return;

		let sortableInstance: Sortable | null = null;

		import('sortablejs').then((mod) => {
			const SortableLib = mod.default;
			if (!gridEl) return;
			sortableInstance = SortableLib.create(gridEl, {
				animation: 150,
				ghostClass: 'sortable-ghost',
				filter: '.image-card-error',
				onEnd(evt: Sortable.SortableEvent) {
					const oldIndex = evt.oldIndex;
					const newIndex = evt.newIndex;
					if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;

					// Compute new order from current DOM order
					const items = gridEl!.querySelectorAll('.image-card');
					const orders: { uuid: string; sort_order: number }[] = [];
					items.forEach((el, i) => {
						const uuid = (el as HTMLElement).dataset.uuid;
						if (uuid) {
							orders.push({ uuid, sort_order: i });
						}
					});
					onReorder(orders);
				}
			});
		});

		return () => {
			sortableInstance?.destroy();
		};
	});
</script>

{#if images.length > 0}
	<section class="image-section">
		<span class="image-label">Images</span>
		<div class="image-grid" bind:this={gridEl}>
			{#each images as image (image.uuid)}
				<ImageCard
					uuid={image.uuid}
					url={image.url}
					status={image.status}
					errorMessage={image.errorMessage}
					{onDelete}
					onClick={handleImageClick}
					{onRetry}
					{onDismiss}
				/>
			{/each}
		</div>
	</section>
{/if}

{#if lightboxUrl}
	<Lightbox imageUrl={lightboxUrl} onClose={closeLightbox} />
{/if}

<style>
	.image-section {
		border-top: 1px solid var(--color-border);
		padding: var(--space-md) var(--space-lg) var(--space-lg);
	}

	.image-label {
		display: block;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--space-md);
	}

	/* SortableJS ghost class */
	:global(.sortable-ghost) {
		opacity: 0.4;
	}

	@media (max-width: 640px) {
		.image-section {
			padding: var(--space-sm) var(--space-md) var(--space-md);
		}

		.image-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--space-sm);
		}
	}
</style>
