<script lang="ts">
	type Props = {
		status: 'connected' | 'connecting' | 'disconnected';
	};

	let { status }: Props = $props();

	const titles: Record<Props['status'], string> = {
		connected: 'Live',
		connecting: 'Reconnecting...',
		disconnected: 'Disconnected'
	};
</script>

<span
	class="connection-dot"
	title={titles[status]}
	style:background-color={status === 'connected'
		? 'var(--color-success)'
		: status === 'connecting'
			? 'var(--color-warning)'
			: 'var(--color-error)'}
></span>

<style>
	.connection-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transition: background-color 0.3s ease;
	}
</style>
