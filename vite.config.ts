import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { handleYjsConnection } from './src/lib/server/ws-server';

/**
 * Vite plugin that provides a WebSocket server for Yjs collaboration during dev.
 * Only intercepts /ws/pads/* upgrade requests to avoid breaking Vite HMR.
 */
function yjsWebSocket(): Plugin {
	return {
		name: 'yjs-websocket',
		configureServer(server) {
			if (!server.httpServer) return;

			const wss = new WebSocketServer({ noServer: true });

			server.httpServer.on('upgrade', (request, socket, head) => {
				const url = request.url;
				if (!url || !url.startsWith('/ws/pads/')) return;

				const slug = url.replace('/ws/pads/', '');
				if (!slug) return;

				wss.handleUpgrade(request, socket, head, (ws) => {
					handleYjsConnection(ws, slug);
				});
			});
		}
	};
}

export default defineConfig({
	plugins: [yjsWebSocket(), sveltekit()]
});
