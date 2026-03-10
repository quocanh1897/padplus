import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { getYjsState, saveYjsState } from './yjs-persistence';
import { getPadBySlug } from './pads';
import type { WebSocket as WsWebSocket } from 'ws';

// Message type constants (y-protocols convention)
const messageSync = 0;
const messageAwareness = 1;

interface Room {
	doc: Y.Doc;
	clients: Set<WsWebSocket>;
	cleanupTimer: ReturnType<typeof setTimeout> | null;
	saveTimer: ReturnType<typeof setTimeout> | null;
}

export const rooms = new Map<string, Room>();

/**
 * Persist the current Yjs document state and plain text content to SQLite.
 */
function persistRoom(slug: string, doc: Y.Doc): void {
	const state = Y.encodeStateAsUpdate(doc);
	const plainText = doc.getText('content').toString();
	saveYjsState(slug, Buffer.from(state), plainText);
}

/**
 * Schedule a debounced persistence (500ms) for a room.
 * Cancels any pending save timer before scheduling.
 */
function schedulePersist(room: Room, slug: string): void {
	if (room.saveTimer) {
		clearTimeout(room.saveTimer);
	}
	room.saveTimer = setTimeout(() => {
		room.saveTimer = null;
		persistRoom(slug, room.doc);
	}, 500);
}

/**
 * Get or create a Yjs room for the given slug.
 * Creates the Y.Doc synchronously to avoid race conditions (Research Pitfall 2).
 */
function getOrCreateRoom(slug: string): Room {
	let room = rooms.get(slug);
	if (room) {
		// Cancel any pending cleanup since a new client is connecting
		if (room.cleanupTimer) {
			clearTimeout(room.cleanupTimer);
			room.cleanupTimer = null;
		}
		return room;
	}

	const doc = new Y.Doc();

	// Load persisted Yjs state if available
	const persistedState = getYjsState(slug);
	if (persistedState) {
		Y.applyUpdate(doc, persistedState);
	} else {
		// No Yjs state yet -- seed from existing pad content if available
		const pad = getPadBySlug(slug);
		if (pad && pad.content) {
			doc.getText('content').insert(0, pad.content);
		}
	}

	room = {
		doc,
		clients: new Set(),
		cleanupTimer: null,
		saveTimer: null
	};

	// Register update listener for debounced persistence
	doc.on('update', () => {
		schedulePersist(room!, slug);
	});

	rooms.set(slug, room);
	return room;
}

/**
 * Broadcast a message to all clients in a room except the sender.
 */
function broadcastToOthers(room: Room, sender: WsWebSocket, message: Uint8Array): void {
	for (const client of room.clients) {
		if (client !== sender && client.readyState === 1 /* WebSocket.OPEN */) {
			client.send(message);
		}
	}
}

/**
 * Handle a new WebSocket connection for Yjs synchronization.
 * This is the core handler shared by both dev (Vite plugin) and production server.
 */
export function handleYjsConnection(ws: WsWebSocket, slug: string): void {
	const room = getOrCreateRoom(slug);
	room.clients.add(ws);

	// Send sync step 1 to new client (server state vector)
	const encoder = encoding.createEncoder();
	encoding.writeVarUint(encoder, messageSync);
	syncProtocol.writeSyncStep1(encoder, room.doc);
	ws.send(encoding.toUint8Array(encoder));

	ws.on('message', (data: ArrayBuffer | Buffer | Buffer[]) => {
		try {
			const message = new Uint8Array(data as ArrayBuffer);
			const decoder = decoding.createDecoder(message);
			const messageType = decoding.readVarUint(decoder);

			switch (messageType) {
				case messageSync: {
					const responseEncoder = encoding.createEncoder();
					encoding.writeVarUint(responseEncoder, messageSync);
					syncProtocol.readSyncMessage(decoder, responseEncoder, room.doc, ws);
					if (encoding.length(responseEncoder) > 1) {
						ws.send(encoding.toUint8Array(responseEncoder));
					}
					// Broadcast the original sync message to all other clients
					broadcastToOthers(room, ws, message);
					break;
				}
				case messageAwareness:
					// Awareness/presence messages are ignored per user decision (no presence features)
					break;
				default:
					break;
			}
		} catch (err) {
			console.error('[ws-server] Error processing message:', err);
		}
	});

	ws.on('close', () => {
		room.clients.delete(ws);

		if (room.clients.size === 0) {
			// Persist final state immediately (cancel any pending debounce)
			if (room.saveTimer) {
				clearTimeout(room.saveTimer);
				room.saveTimer = null;
			}
			persistRoom(slug, room.doc);

			// Set 30-second cleanup timer
			room.cleanupTimer = setTimeout(() => {
				if (room.clients.size === 0) {
					room.doc.destroy();
					rooms.delete(slug);
				}
			}, 30_000);
		}
	});
}
