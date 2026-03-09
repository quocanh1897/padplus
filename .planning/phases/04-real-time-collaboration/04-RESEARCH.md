# Phase 4: Real-Time Collaboration - Research

**Researched:** 2026-03-09
**Domain:** Real-time collaborative editing with Yjs CRDT, WebSocket transport, SvelteKit integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No visible cursors or user colors -- just text syncing silently between users
- Keep the distraction-free feel -- upgrade the editor component invisibly (same visual appearance)
- No presence indication -- no user count, no "who's editing" -- simplest approach
- Images continue to use HTTP upload -- only text is synced via WebSocket in real-time mode
- User can keep typing when WebSocket drops -- edits buffer locally and sync on reconnect (Yjs handles this natively)
- Connection status via colored dot in header: green=connected, yellow=reconnecting, red=disconnected
- Auto-reconnect with exponential backoff -- keep trying silently in the background
- No manual retry button needed -- reconnection is automatic
- Switching TO real-time: editor swaps from textarea to Yjs-backed editor without page reload, content preserved
- Switching FROM real-time: Yjs persistence keeps DB in sync, switching just disconnects WebSocket
- When another user switches the pad to real-time while you're editing in another mode: silent detection on next auto-save, prompts to reload
- "Real-time" appears as a third option in the existing ModeSelector dropdown
- The real-time experience should feel like "nothing changed" from the user's perspective -- same font, same layout, same padding -- just text magically stays in sync
- Speed is still king -- the initial text load must still be SSR'd before JS loads, even in real-time mode
- Yjs should only load when real-time mode is actually active (dynamic import) -- don't bloat the bundle for users who never use real-time
- Playwright E2E tests required for verification

### Claude's Discretion
- Yjs integration approach (y-websocket, custom WebSocket provider)
- Editor library for real-time mode (CodeMirror 6, plain contentEditable, or enhanced textarea)
- WebSocket server setup (same process, Hono/SvelteKit WebSocket upgrade)
- Yjs document persistence strategy to SQLite
- Connection status dot styling and placement
- How Yjs document state maps to/from the `content` column
- Reconnection backoff parameters
- How to handle the textarea to Yjs editor swap without losing scroll position
- Room management (one Yjs room per pad slug)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLLAB-03 | Real-time mode -- WebSocket live sync between editors | Yjs CRDT + y-websocket client + custom ws server embedded in SvelteKit via Vite plugin (dev) and custom server entry (prod). y-textarea library binds Y.Text to textarea elements. Persistence via Y.encodeStateAsUpdate/applyUpdate stored as BLOB in SQLite. |
</phase_requirements>

## Summary

Phase 4 adds a "Real-time" collaboration mode where multiple users editing the same pad see each other's keystrokes within ~200ms. The core technology stack is **Yjs** (CRDT library, v13.6.x) for conflict-free document synchronization, **y-websocket** (v3.x client-only) for WebSocket transport, and the **ws** library for the WebSocket server embedded within the SvelteKit process. The editor surface in real-time mode uses **y-textarea** to bind a Y.Text shared type directly to a textarea element, preserving the existing visual appearance.

The architecture follows a room-per-pad model: each pad slug maps to a Yjs room name. When a user opens a pad in real-time mode, the client dynamically imports Yjs and y-websocket, creates a Y.Doc, connects to the WebSocket server at `/ws/pads/{slug}`, and binds Y.Text to the textarea. The server manages in-memory Yjs documents per room, persists document state to SQLite as binary BLOB data, and syncs state between all connected clients. On disconnect, the Yjs CRDT model ensures that edits made offline merge seamlessly on reconnect -- this is a core property of CRDTs and requires no special implementation beyond standard Yjs usage.

The WebSocket server runs in the same Node.js process as SvelteKit. During development, a Vite plugin hooks into `configureServer` to handle WebSocket upgrades. In production, a custom server entry point wraps the SvelteKit handler and adds WebSocket upgrade handling. This keeps the single-process architecture (INFRA-02) intact.

**Primary recommendation:** Use yjs + y-websocket (client) + ws + y-textarea with a custom Vite plugin (dev) and custom server.js (prod) for WebSocket support. Store Yjs binary state in a new `yjs_state` BLOB column on the pads table. Keep the textarea element for visual consistency -- y-textarea binds Y.Text to it invisibly.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yjs | ^13.6.29 | CRDT document model | The fastest CRDT implementation; de facto standard for collaborative editing; handles offline sync natively |
| y-websocket | ^3.0.0 | WebSocket provider (client-side only) | Official Yjs WebSocket provider; handles reconnection, cross-tab sync, status events |
| y-textarea | ^1.0.0 | Binds Y.Text to textarea/input elements | Official community binding; preserves textarea semantics while syncing via Yjs |
| ws | ^8.x | WebSocket server (Node.js) | Standard Node.js WebSocket library; used by y-websocket-server internally |
| fast-diff | ^1.3.0 | Text diffing for textarea binding | Used internally by y-textarea; tiny, fast diff algorithm |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| y-protocols | (peer dep of y-websocket) | Yjs sync/awareness protocol encoders | Automatically used by y-websocket; needed for custom server message handling |
| lib0 | (peer dep of yjs) | Utility library for Yjs encoding | Automatically used; provides encoding/decoding utilities |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| y-textarea | CodeMirror 6 + y-codemirror.next | Richer editing but heavier bundle (~150KB vs ~5KB), different visual appearance, overkill for plain text |
| y-textarea | Custom textarea binding with fast-diff | Full control but must handle cursor position, IME input, mobile keyboards -- y-textarea handles all this |
| ws (custom server) | @y/websocket-server standalone | Easier setup but runs as separate process, violates INFRA-02 (single-process server) |
| Vite plugin + custom server | adapter-node-ws | Third-party adapter with caveats; less maintained than rolling own integration |

**Installation:**
```bash
npm install yjs y-websocket y-textarea ws fast-diff
npm install -D @types/ws
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    server/
      db.ts              # Add migration v4: yjs_state BLOB column
      pads.ts            # Add 'real-time' to mode type union, Yjs state read/write
      ws-server.ts       # NEW: WebSocket server logic (setupWSConnection equivalent)
      yjs-persistence.ts # NEW: SQLite persistence for Yjs documents
    components/
      ModeSelector.svelte    # Add 'real-time' as third option
      Header.svelte          # Add connection status dot
      ConnectionDot.svelte   # NEW: colored dot component
      RealtimeEditor.svelte  # NEW: textarea with Yjs binding (dynamic import target)
  routes/
    [...slug]/
      +page.svelte       # Conditional: textarea for LSW/merge, RealtimeEditor for real-time
      +page.server.ts    # No changes needed (SSR still works)
    api/pads/[...slug]/
      mode/+server.ts    # Accept 'real-time' as valid mode value
server/
  index.ts               # NEW: Custom production server entry (WebSocket upgrade)
```

### Pattern 1: Vite Plugin for Dev WebSocket Server
**What:** A Vite plugin that creates a ws.WebSocketServer and handles HTTP upgrade events during development, allowing WebSocket connections alongside SvelteKit's dev server.
**When to use:** Always during `vite dev` -- this is the only way to add WebSocket support to SvelteKit's dev server without a separate process.
**Example:**
```typescript
// Source: https://joyofcode.xyz/using-websockets-with-sveltekit + custom adaptation
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';
import { handleYjsConnection } from './src/lib/server/ws-server';

const yjsWebSocket = {
  name: 'yjs-websocket',
  configureServer(server) {
    if (!server.httpServer) return;

    const wss = new WebSocketServer({ noServer: true });

    server.httpServer.on('upgrade', (request, socket, head) => {
      // Only handle /ws/pads/* paths
      if (request.url?.startsWith('/ws/pads/')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          const slug = request.url!.replace('/ws/pads/', '');
          handleYjsConnection(ws, slug);
        });
      }
    });
  }
};

export default defineConfig({
  plugins: [sveltekit(), yjsWebSocket]
});
```

### Pattern 2: Custom Production Server with WebSocket Upgrade
**What:** A custom Node.js entry point that imports the SvelteKit handler and adds WebSocket upgrade handling on the same HTTP server.
**When to use:** Production builds via `adapter-node`. The custom server replaces the default `build/index.js`.
**Example:**
```typescript
// Source: SvelteKit adapter-node docs + community patterns
// server/index.ts
import { handler } from '../build/handler.js';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { handleYjsConnection } from './ws-server.js';

const port = parseInt(process.env.PORT || '3000');
const server = createServer(handler);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws/pads/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const slug = request.url!.replace('/ws/pads/', '');
      handleYjsConnection(ws, slug);
    });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### Pattern 3: Yjs Server Room Management with SQLite Persistence
**What:** A server-side module that manages Yjs documents per room (pad slug), syncs updates between connected clients, and persists document state to SQLite.
**When to use:** This is the core server logic, shared between dev and production.
**Example:**
```typescript
// Source: y-websocket-server source + Yjs docs (document-updates)
// src/lib/server/ws-server.ts
import * as Y from 'yjs';
import { getYjsState, saveYjsState } from './yjs-persistence';

const rooms = new Map<string, { doc: Y.Doc; clients: Set<WebSocket> }>();

export function handleYjsConnection(ws: WebSocket, slug: string) {
  let room = rooms.get(slug);
  if (!room) {
    const doc = new Y.Doc();
    // Load persisted state from SQLite
    const persistedState = getYjsState(slug);
    if (persistedState) {
      Y.applyUpdate(doc, persistedState);
    } else {
      // Initialize from pad content column
      const pad = getPadBySlug(slug);
      if (pad?.content) {
        doc.getText('content').insert(0, pad.content);
      }
    }
    room = { doc, clients: new Set() };
    rooms.set(slug, room);

    // Persist on updates (debounced)
    doc.on('update', () => {
      // Debounced save to SQLite
      const state = Y.encodeStateAsUpdate(doc);
      saveYjsState(slug, Buffer.from(state));
    });
  }

  room.clients.add(ws);

  // Send current state to new client
  const stateVector = Y.encodeStateAsUpdate(room.doc);
  // ... encode and send via y-protocols sync protocol

  ws.on('close', () => {
    room!.clients.delete(ws);
    if (room!.clients.size === 0) {
      // Persist final state and clean up after timeout
      const state = Y.encodeStateAsUpdate(room!.doc);
      saveYjsState(slug, Buffer.from(state));
      // Keep room alive briefly for reconnecting clients
      setTimeout(() => {
        if (room!.clients.size === 0) {
          room!.doc.destroy();
          rooms.delete(slug);
        }
      }, 30000);
    }
  });
}
```

### Pattern 4: Dynamic Import for Bundle Splitting
**What:** Yjs, y-websocket, and y-textarea are only loaded when real-time mode is active, using dynamic `import()`.
**When to use:** Always -- the user explicitly requires that Yjs not bloat the bundle for non-real-time users.
**Example:**
```svelte
<!-- Source: Established pattern from ImageGrid.svelte (SortableJS dynamic import) -->
{#if collaborationMode === 'real-time'}
  {#await import('$lib/components/RealtimeEditor.svelte') then module}
    <module.default
      slug={data.slug}
      initialContent={content}
      onContentChange={(text) => content = text}
    />
  {/await}
{:else}
  <textarea class="editor" value={content} oninput={handleInput} ...></textarea>
{/if}
```

### Pattern 5: Textarea to Yjs Editor Swap
**What:** When switching to real-time mode, the textarea is replaced with a Yjs-bound textarea. Content and scroll position are preserved.
**When to use:** Mode transitions.
**Example:**
```typescript
// Inside RealtimeEditor.svelte
import { onMount, onDestroy } from 'svelte';

let textareaEl: HTMLTextAreaElement;
let binding: any; // TextAreaBinding from y-textarea
let provider: any; // WebsocketProvider from y-websocket

onMount(async () => {
  const Y = await import('yjs');
  const { WebsocketProvider } = await import('y-websocket');
  const { TextAreaBinding } = await import('y-textarea');

  const doc = new Y.Doc();
  const ytext = doc.getText('content');

  provider = new WebsocketProvider(
    `ws://${window.location.host}/ws/pads`,
    slug,
    doc,
    { connect: true, maxBackoffTime: 5000 }
  );

  // Wait for initial sync before binding to avoid flicker
  provider.on('sync', (synced: boolean) => {
    if (synced && !binding) {
      binding = new TextAreaBinding(ytext, textareaEl);
    }
  });

  provider.on('status', ({ status }: { status: string }) => {
    connectionStatus = status; // 'connected' | 'disconnected'
  });
});

onDestroy(() => {
  binding?.destroy();
  provider?.disconnect();
  provider?.destroy();
});
```

### Anti-Patterns to Avoid
- **Using CodeMirror 6 for plain text:** Massively over-engineered for this use case. The user explicitly wants the same textarea appearance. CodeMirror adds ~150KB+ to the bundle and requires extensive styling to match the existing textarea.
- **Running y-websocket-server as a separate process:** Violates the single-process requirement (INFRA-02). The WebSocket server must run in the same process as SvelteKit.
- **Eagerly loading Yjs on every page:** The user explicitly requires dynamic import. Yjs + y-websocket + y-textarea are ~50KB gzipped combined -- this should only load when real-time mode is active.
- **Storing Yjs state only in the content column as plain text:** Yjs documents contain CRDT metadata (vector clocks, tombstones) that cannot be represented as plain text. The binary state MUST be stored separately. The content column should be kept in sync as a plain-text snapshot for SSR and non-real-time modes.
- **Creating new Y.Doc per WebSocket connection:** Each room (pad slug) should have exactly ONE Y.Doc shared by all connections. Creating a doc per connection defeats the purpose of CRDTs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CRDT merge algorithm | Custom OT or diff-merge | Yjs (Y.Text) | CRDTs are deceptively complex; 10+ years of academic research. Yjs handles tombstones, vector clocks, garbage collection, and convergence guarantees. |
| Textarea binding | Custom input event handler + diff | y-textarea (TextAreaBinding) | Must handle IME input, mobile keyboards, composition events, cursor position preservation, selection ranges. y-textarea handles all edge cases. |
| WebSocket reconnection | Custom reconnect loop | y-websocket (WebsocketProvider) | Built-in exponential backoff, cross-tab communication, awareness protocol, sync status tracking. maxBackoffTime configurable. |
| Binary sync protocol | Custom message format | y-protocols (sync protocol) | Efficient binary encoding, state vector exchange, incremental updates. Well-tested protocol used across the entire Yjs ecosystem. |
| Document persistence | Custom update tracking | Y.encodeStateAsUpdate / Y.applyUpdate | Yjs's update format is commutative, associative, and idempotent. Storing the full encoded state and restoring it is safe and correct by design. |

**Key insight:** Real-time collaborative editing is one of the most complex problems in distributed systems. Every component (CRDT, transport, binding, persistence) has subtle edge cases. The Yjs ecosystem has purpose-built solutions for each layer. Hand-rolling any of them guarantees bugs around concurrent edits, offline sync, and IME input handling.

## Common Pitfalls

### Pitfall 1: Content Column Drift from Yjs State
**What goes wrong:** The `content` column in SQLite gets out of sync with the Yjs document state. SSR shows stale content, or switching from real-time to another mode shows old text.
**Why it happens:** Yjs state is stored as binary BLOB, but the `content` column is plain text used by SSR and non-real-time modes. If updates to one don't update the other, they diverge.
**How to avoid:** On every Yjs state persistence (debounced), also update the `content` column with `ytext.toString()`. When initializing a Yjs doc for a room with no persisted state, seed it from the `content` column.
**Warning signs:** SSR shows different content than what real-time users see; switching modes causes content to jump.

### Pitfall 2: Race Condition on Room Initialization
**What goes wrong:** Two clients connect simultaneously to a room that has no in-memory doc. Both create a new Y.Doc and load from persistence, creating two divergent documents.
**Why it happens:** Room creation is not atomic -- there's a gap between checking if a room exists and creating it.
**How to avoid:** Use a synchronous check-and-create pattern. Since better-sqlite3 is synchronous and Node.js is single-threaded, simply checking `rooms.has(slug)` and setting the room in the same synchronous block is safe. No async operations between check and set.
**Warning signs:** Intermittent "content not syncing" issues when multiple users open the same pad simultaneously.

### Pitfall 3: Yjs Bundle Not Code-Split
**What goes wrong:** Yjs, y-websocket, and y-textarea are included in the main bundle, adding ~50KB gzipped to every page load even when real-time mode is not used.
**Why it happens:** Static `import` at the top of components that conditionally use real-time mode.
**How to avoid:** Use dynamic `import()` inside the RealtimeEditor component. The component itself should be loaded via `{#await import(...)}` in the parent. Follow the existing SortableJS pattern from ImageGrid.svelte.
**Warning signs:** Bundle analyzer shows yjs/y-websocket in the main chunk.

### Pitfall 4: Scroll Position Lost on Editor Swap
**What goes wrong:** When switching from textarea to Yjs-backed textarea, the scroll position resets to top.
**Why it happens:** The DOM element is replaced, losing scroll state.
**How to avoid:** Before swap, capture `scrollTop` from the textarea (or its scroll container). After the new textarea mounts, restore `scrollTop`. Use `tick()` to wait for Svelte DOM update before restoring.
**Warning signs:** User reports "page jumps to top" when enabling real-time mode.

### Pitfall 5: WebSocket Upgrade Path Conflict in Development
**What goes wrong:** Vite's HMR uses WebSockets on the same server. The Yjs WebSocket upgrade handler intercepts Vite's HMR connections.
**Why it happens:** Both use the HTTP upgrade mechanism on the same server.
**How to avoid:** Filter upgrade requests by URL path. Only handle upgrades where `request.url` starts with `/ws/pads/`. Vite HMR uses a different path (typically `/@vite/client` or root `/`).
**Warning signs:** Hot module replacement stops working, or Yjs connections fail during development.

### Pitfall 6: SaveStatus Component Shows "Saving..." in Real-Time Mode
**What goes wrong:** The existing auto-save debounce triggers HTTP PUT requests even when in real-time mode, showing irrelevant save status.
**Why it happens:** The auto-save logic in +page.svelte does not check collaboration mode before saving.
**How to avoid:** When `collaborationMode === 'real-time'`, disable the debounced auto-save entirely. The SaveStatus component should either hide or show a "Live" indicator instead.
**Warning signs:** Network tab shows PUT requests to `/api/pads/slug` while in real-time mode.

### Pitfall 7: Room Cleanup Memory Leak
**What goes wrong:** Server accumulates in-memory Y.Doc instances for every pad ever opened in real-time mode.
**Why it happens:** Rooms are never cleaned up after all clients disconnect.
**How to avoid:** When the last client disconnects, persist the final state and set a cleanup timeout (e.g., 30 seconds). If no client reconnects within the timeout, destroy the Y.Doc and remove the room from the map.
**Warning signs:** Server memory usage grows linearly with the number of unique pads accessed.

### Pitfall 8: Initial Content Flicker on Real-Time Connect
**What goes wrong:** User sees empty textarea briefly before Yjs syncs content from server.
**Why it happens:** SSR renders content, then client-side hydration replaces with empty Yjs doc, then Yjs syncs and populates.
**How to avoid:** Keep SSR content in the textarea until Yjs provider fires the `'sync'` event with `synced: true`. Only then bind y-textarea to the element. Show the SSR'd content as a read-only placeholder during sync.
**Warning signs:** Brief flash of empty content on page load.

## Code Examples

Verified patterns from official sources:

### Yjs Document Creation and Text Operations
```typescript
// Source: https://docs.yjs.dev/api/shared-types/y.text
import * as Y from 'yjs';

const doc = new Y.Doc();
const ytext = doc.getText('content'); // Named shared type

// Insert text
ytext.insert(0, 'Hello World');

// Observe changes
ytext.observe((event) => {
  // event.delta contains the changes
  console.log('Text changed:', ytext.toString());
});

// Get plain text
const plainText = ytext.toString();
```

### WebSocket Provider Setup
```typescript
// Source: https://docs.yjs.dev/ecosystem/connection-provider/y-websocket
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();
const wsProvider = new WebsocketProvider(
  `ws://${window.location.host}/ws/pads`,
  'my-pad-slug', // room name = pad slug
  doc,
  {
    connect: true,
    maxBackoffTime: 5000 // max 5s between reconnection attempts
  }
);

// Connection status (for the colored dot)
wsProvider.on('status', (event: { status: string }) => {
  console.log(event.status); // 'connected' | 'disconnected'
});

// Sync status (content received from server)
wsProvider.on('sync', (synced: boolean) => {
  console.log('Synced:', synced);
});

// Properties
wsProvider.wsconnected;  // boolean: currently connected
wsProvider.wsconnecting; // boolean: connection in progress
wsProvider.synced;       // boolean: connected AND synced

// Cleanup
wsProvider.disconnect();
wsProvider.destroy();
```

### y-textarea Binding (No Cursors)
```typescript
// Source: https://github.com/cm226/y-textarea
import { TextAreaBinding } from 'y-textarea';

const ytext = doc.getText('content');
const textareaEl = document.querySelector('textarea.editor');

// Simple binding without cursor sharing (matches user decision: no cursors)
const binding = new TextAreaBinding(ytext, textareaEl);

// Cleanup
binding.destroy();
```

### Yjs State Persistence to SQLite
```typescript
// Source: https://docs.yjs.dev/api/document-updates
import * as Y from 'yjs';
import db from './db';

// Encode entire document state as binary
const state: Uint8Array = Y.encodeStateAsUpdate(doc);

// Store as BLOB in SQLite (better-sqlite3 handles Buffer/Uint8Array natively)
const saveStmt = db.prepare(
  'UPDATE pads SET yjs_state = ?, content = ? WHERE slug = ?'
);
saveStmt.run(Buffer.from(state), doc.getText('content').toString(), slug);

// Restore from SQLite
const loadStmt = db.prepare<[string], { yjs_state: Buffer | null }>(
  'SELECT yjs_state FROM pads WHERE slug = ?'
);
const row = loadStmt.get(slug);
if (row?.yjs_state) {
  Y.applyUpdate(doc, new Uint8Array(row.yjs_state));
}
```

### Merging Multiple Updates (Compaction)
```typescript
// Source: https://docs.yjs.dev/api/document-updates
import * as Y from 'yjs';

// Collect incremental updates
const updates: Uint8Array[] = [];
doc.on('update', (update: Uint8Array) => {
  updates.push(update);
});

// Merge all updates into one (smaller than sum of parts)
const mergedUpdate = Y.mergeUpdates(updates);

// Apply merged update to a fresh doc (equivalent to applying all updates)
const freshDoc = new Y.Doc();
Y.applyUpdate(freshDoc, mergedUpdate);
```

### Connection Status Dot Component
```svelte
<!-- ConnectionDot.svelte -->
<script lang="ts">
  type Props = {
    status: 'connected' | 'connecting' | 'disconnected';
  };
  let { status }: Props = $props();

  const colors: Record<string, string> = {
    connected: 'var(--color-success)',    // green
    connecting: 'var(--color-warning)',   // yellow
    disconnected: 'var(--color-error)'   // red
  };
</script>

<span
  class="connection-dot"
  title={status === 'connected' ? 'Live' : status === 'connecting' ? 'Reconnecting...' : 'Disconnected'}
  style:background-color={colors[status]}
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
```

### y-protocols Sync Protocol (Server-Side Message Handling)
```typescript
// Source: y-websocket-server implementation pattern
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;

function handleMessage(ws: WebSocket, doc: Y.Doc, message: Uint8Array) {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
      break;
    }
    case messageAwareness: {
      // Even though we don't show cursors, awareness is used for connection tracking
      break;
    }
  }
}

function sendSyncStep1(ws: WebSocket, doc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| y-websocket ships server + client | y-websocket v3 is client-only; server is @y/websocket-server | April 2025 (v3.0.0) | Must install server separately or build custom server |
| OT (Operational Transform) | CRDTs (Yjs, Automerge) | 2018-2020 adoption wave | No central server needed for conflict resolution; offline-first by design |
| Custom WebSocket + diff-patch | Yjs shared types + providers | 2020+ | Eliminates entire class of sync bugs; proven at scale |
| LevelDB persistence only | Custom persistence via encodeStateAsUpdate | Always available | Enables SQLite, PostgreSQL, or any storage backend |

**Deprecated/outdated:**
- `y-websocket/bin/utils.js` direct import: Was broken in v1.3.16+, fixed, then server code removed entirely in v3.0.0. Use `@y/websocket-server` or build custom server.
- `y-websockets-server` (old package): Replaced by `@y/websocket-server`. Do not use.
- y-websocket v4.0.0-rc.1 exists but is pre-release. Stick with v3.x for stability.

## Open Questions

1. **y-websocket v3 server-side sync protocol implementation**
   - What we know: The client-side WebsocketProvider handles the sync protocol automatically. The server needs to implement the same protocol using y-protocols/sync.
   - What's unclear: The exact server-side message handling loop. The y-websocket-server source code is the reference implementation, but it was not fully accessible during research.
   - Recommendation: Reference the y-websocket-server source on GitHub during implementation. The server code is ~200 lines and well-understood. The pattern in the Code Examples section above is the standard approach.

2. **y-textarea compatibility with Svelte 5 runes**
   - What we know: y-textarea works with any HTMLTextAreaElement directly (vanilla DOM). It does not depend on any framework.
   - What's unclear: Whether Svelte 5's reactivity system conflicts with y-textarea's direct DOM manipulation (e.g., setting textarea.value).
   - Recommendation: Test during implementation. If conflicts arise, the fallback is a thin custom binding using fast-diff + Y.Text.observe() (as demonstrated in the dev.to article).

3. **Production server entry point with adapter-node**
   - What we know: adapter-node generates `build/handler.js` which exports a request handler. A custom `server/index.ts` can import it and wrap with WebSocket handling.
   - What's unclear: Whether adapter-node's `entryPoint` config option is the correct way to specify the custom server, or whether a separate start script is needed.
   - Recommendation: Use a separate `server/index.ts` file and update the `package.json` start script to use it instead of `build/index.js`. This is the pattern documented in the SvelteKit adapter-node docs and used by the community.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/real-time.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLLAB-03 | Two users open same pad in real-time, see each other's keystrokes within ~200ms | e2e | `npx playwright test tests/real-time.spec.ts -g "keystrokes sync" --project=chromium` | No -- Wave 0 |
| COLLAB-03 | Connection drops and reconnects, edits sync without data loss | e2e | `npx playwright test tests/real-time.spec.ts -g "reconnect sync" --project=chromium` | No -- Wave 0 |
| COLLAB-03 | Real-time mode available in ModeSelector, switching takes effect immediately | e2e | `npx playwright test tests/real-time.spec.ts -g "mode selector" --project=chromium` | No -- Wave 0 |
| COLLAB-03 | Yjs state persists to SQLite and survives server restart | e2e | `npx playwright test tests/real-time.spec.ts -g "persistence" --project=chromium` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/real-time.spec.ts --project=chromium`
- **Per wave merge:** `npx playwright test --project=chromium`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/real-time.spec.ts` -- covers COLLAB-03 (new file for all real-time E2E tests)
- [ ] Multi-context Playwright setup -- tests need two browser contexts connecting to the same pad simultaneously (Playwright supports this via `browser.newContext()`)

### E2E Testing Strategy for Real-Time
Playwright supports multiple browser contexts in a single test. The pattern for testing real-time sync:
```typescript
// Two contexts, one browser -- simulates two users
const context1 = await browser.newContext();
const context2 = await browser.newContext();
const page1 = await context1.newPage();
const page2 = await context2.newPage();

await page1.goto('/test-pad');
await page2.goto('/test-pad');

// Type in page1, verify in page2
await page1.locator('textarea.editor').type('hello');
await expect(page2.locator('textarea.editor')).toHaveValue(/hello/, { timeout: 2000 });
```

For disconnect/reconnect testing, Playwright's `page.route()` can intercept and abort WebSocket connections, or the test can use `context.setOffline(true/false)`.

## Sources

### Primary (HIGH confidence)
- [Yjs Docs - Document Updates](https://docs.yjs.dev/api/document-updates) - encodeStateAsUpdate, applyUpdate, mergeUpdates APIs
- [Yjs Docs - Y.Text API](https://docs.yjs.dev/api/shared-types/y.text) - insert, delete, observe, toString, applyDelta
- [Yjs Docs - y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket) - WebsocketProvider API, events, configuration
- [Yjs Docs - Offline Editing](https://docs.yjs.dev/getting-started/allowing-offline-editing) - CRDT offline/reconnect guarantees
- [y-websocket GitHub](https://github.com/yjs/y-websocket) - v3.0.0 release, client-only package
- [y-websocket-server GitHub](https://github.com/yjs/y-websocket-server) - Server setup, persistence interface
- [y-textarea GitHub](https://github.com/cm226/y-textarea) - TextAreaBinding API, cursor support, cleanup
- [y-codemirror.next GitHub](https://github.com/yjs/y-codemirror.next) - CodeMirror 6 binding (evaluated but not selected)

### Secondary (MEDIUM confidence)
- [Using WebSockets With SvelteKit](https://joyofcode.xyz/using-websockets-with-sveltekit) - Vite plugin pattern, custom server pattern (verified against SvelteKit docs)
- [Collaborative Text Editing with Yjs (dev.to)](https://dev.to/priolo/synchronizing-collaborative-text-editing-with-yjs-and-websockets-1dco) - Textarea binding with fast-diff pattern, server setup with persistence (code examples verified against Yjs docs)
- [adapter-node-ws GitHub](https://github.com/carlosV2/adapter-node-ws) - handleWs hook pattern (evaluated but not selected -- too unmaintained)

### Tertiary (LOW confidence)
- [SvelteKit native WebSocket PR #12973](https://github.com/sveltejs/kit/pull/12973) - Native WebSocket support in development; NOT merged as of March 2026. Do not depend on this.
- [yjs npm](https://www.npmjs.com/package/yjs) - Latest version 13.6.29 (needs validation at install time)
- y-websocket v4.0.0-rc.1 pre-release exists -- do not use in production

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Yjs is the established standard for CRDT collaborative editing; y-websocket and y-textarea are official/well-tested ecosystem packages; ws is the de facto Node.js WebSocket library
- Architecture: HIGH - The Vite plugin + custom server pattern for WebSocket support in SvelteKit is well-documented and widely used in the community; room-per-pad model is the standard Yjs pattern
- Pitfalls: HIGH - Pitfalls identified from Yjs community discussions, official docs, and patterns established in Phases 1-3 of this project (cursor preservation, bundle splitting, SSR considerations)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (30 days -- Yjs ecosystem is mature and stable)
