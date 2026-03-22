/**
 * Production server entry point.
 * Wraps the SvelteKit adapter-node handler with WebSocket upgrade support
 * for Yjs real-time collaboration at /ws/pads/{slug}.
 *
 * Self-contained: uses its own DB connection and Yjs room management
 * to avoid build/import complexity with the SvelteKit output.
 */

import { handler } from "../build/handler.js";
import http from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import Database from "better-sqlite3";

// --- Database connection ---
const DB_PATH = process.env.DB_PATH || "./data/padplus.db";
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// Prepared statements for Yjs persistence
const getStateStmt = db.prepare("SELECT yjs_state FROM pads WHERE slug = ?");
const saveStateStmt = db.prepare(
  `UPDATE pads SET yjs_state = ?, content = ?, updated_at = datetime('now') WHERE slug = ?`,
);
const getPadStmt = db.prepare("SELECT content FROM pads WHERE slug = ?");

function getYjsState(slug) {
  const row = getStateStmt.get(slug);
  if (!row || !row.yjs_state) return null;
  return new Uint8Array(row.yjs_state);
}

function saveYjsState(slug, state, plainText) {
  saveStateStmt.run(Buffer.from(state), plainText, slug);
}

// --- Yjs room management ---
const messageSync = 0;
const messageAwareness = 1;

/** @type {Map<string, { doc: Y.Doc, clients: Set<import('ws').WebSocket>, cleanupTimer: ReturnType<typeof setTimeout> | null, saveTimer: ReturnType<typeof setTimeout> | null }>} */
const rooms = new Map();

function persistRoom(slug, doc) {
  const state = Y.encodeStateAsUpdate(doc);
  const plainText = doc.getText("content").toString();
  saveYjsState(slug, Buffer.from(state), plainText);
}

function schedulePersist(room, slug) {
  if (room.saveTimer) clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => {
    room.saveTimer = null;
    persistRoom(slug, room.doc);
  }, 500);
}

function getOrCreateRoom(slug) {
  let room = rooms.get(slug);
  if (room) {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    return room;
  }

  const doc = new Y.Doc();

  const persistedState = getYjsState(slug);
  if (persistedState) {
    Y.applyUpdate(doc, persistedState);
  } else {
    const pad = getPadStmt.get(slug);
    if (pad && pad.content) {
      doc.getText("content").insert(0, pad.content);
    }
  }

  room = {
    doc,
    clients: new Set(),
    cleanupTimer: null,
    saveTimer: null,
  };

  doc.on("update", () => {
    schedulePersist(room, slug);
  });

  rooms.set(slug, room);
  return room;
}

function broadcastToOthers(room, sender, message) {
  for (const client of room.clients) {
    if (client !== sender && client.readyState === 1) {
      client.send(message);
    }
  }
}

function handleConnection(ws, slug) {
  const room = getOrCreateRoom(slug);
  room.clients.add(ws);

  // Send sync step 1 to new client
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  ws.send(encoding.toUint8Array(encoder));

  ws.on("message", (data) => {
    try {
      const message = new Uint8Array(data);
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
          broadcastToOthers(room, ws, message);
          break;
        }
        case messageAwareness:
          // Awareness ignored (no presence features)
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[ws-server] Error processing message:", err);
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);

    if (room.clients.size === 0) {
      if (room.saveTimer) {
        clearTimeout(room.saveTimer);
        room.saveTimer = null;
      }
      persistRoom(slug, room.doc);

      room.cleanupTimer = setTimeout(() => {
        if (room.clients.size === 0) {
          room.doc.destroy();
          rooms.delete(slug);
        }
      }, 30_000);
    }
  });
}

// --- HTTP + WebSocket server ---
const server = http.createServer(handler);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = request.url;
  if (!url || !url.startsWith("/ws/pads/")) return;

  const slug = url.replace("/ws/pads/", "");
  if (!slug) return;

  wss.handleUpgrade(request, socket, head, (ws) => {
    handleConnection(ws, slug);
  });
});

const PORT = parseInt(process.env.PORT || "8462", 10);
server.listen(PORT, () => {
  console.log(`[padplus] Production server listening on port ${PORT}`);
});
