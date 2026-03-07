<script lang="ts">
	import { fade } from 'svelte/transition';

	interface Props {
		imageUrl: string;
		onClose: () => void;
	}

	let { imageUrl, onClose }: Props = $props();

	let overlayEl: HTMLDivElement;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		// Only close when clicking the backdrop itself, not the image
		if (event.target === overlayEl) {
			onClose();
		}
	}

	$effect(() => {
		overlayEl?.focus();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="lightbox-overlay"
	bind:this={overlayEl}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onkeydown={handleKeydown}
	onclick={handleBackdropClick}
	transition:fade={{ duration: 150 }}
>
	<button class="close-btn" type="button" onclick={onClose} aria-label="Close lightbox">
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	</button>
	<img class="lightbox-image" src={imageUrl} alt="" />
</div>

<style>
	.lightbox-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		outline: none;
	}

	.lightbox-image {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}

	.close-btn {
		position: absolute;
		top: var(--space-lg);
		right: var(--space-lg);
		width: 44px;
		height: 44px;
		border: none;
		background: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background 0.15s ease;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}
</style>
