# Architecture Patterns

**Domain:** Self-hosted collaborative notepad (Etherpad/Dontpad alternative)
**Researched:** 2026-03-07

## Recommended Architecture

Single-process monolith. One Bun process serves HTTP, WebSocket, and static files. SQLite for persistence, local filesystem for images. No microservices, no external dependencies, no message queues.

```
                         +---------------------------+
                         |      Bun + Hono Server    |
                         |                           |
  Browser ----HTTP-----> |  Route Handler Layer      |
                         |    |                      |
                         |    +-> SSR Engine          |  (text-first HTML)
                         |    +-> REST API            |  (pad CRUD, image upload)
                         |    +-> Static Files        |  (JS, CSS, uploaded images)
                         |                           |
  Browser ---WebSocket-> |  WebSocket Handler        |
                         |    |                      |
                         |    +-> Yjs Sync Protocol   |  (real-time mode only)
                         |    +-> Room Manager        |  (per-pad connections)
                         |                           |
                         |  Persistence Layer         |
                         |    +-> SQLite (bun:sqlite) |  (pad content, metadata)
                         |    +-> Filesystem          |  (uploaded images)
                         +---------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Hono Router** | URL routing, middleware, request/response lifecycle | All handlers |
| **SSR Engine** | Server-renders pad HTML with text content inlined; streams response | SQLite (reads pad content), Hono Router |
| **REST API** | CRUD for pads, image upload endpoint, pad metadata/settings | SQLite, Filesystem, Hono Router |
| **Static File Server** | Serves JS bundles, CSS, and uploaded images | Filesystem, Hono Router |
| **WebSocket Handler** | Upgrades connections, routes Yjs sync protocol messages | Room Manager, Hono Router |
| **Room Manager** | Tracks active WebSocket connections per pad, broadcasts updates | WebSocket Handler, Yjs Sync Engine |
| **Yjs Sync Engine** | Applies CRDT updates, merges document state, encodes/decodes binary | Room Manager, SQLite (persistence) |
| **Collaboration Mode Controller** | Determines which save/sync strategy a pad uses (last-save-wins, auto-merge, real-time) | REST API, WebSocket Handler, SQLite |
| **SQLite Store** | Pad text storage, Yjs binary updates, pad metadata, image references | All server-side components |
| **Image Store** | Writes uploaded images to local filesystem, generates URL paths | REST API, Static File Server |

### Data Flow

**1. Initial Page Load (speed-critical path)**

This is the most important flow. Text must be visible before JavaScript loads.

```
Browser requests GET /my-pad
  -> Hono Router matches wildcard route
  -> SSR Engine queries SQLite for pad content
  -> SSR Engine renders full HTML with text content inlined in a <textarea>
     (or <pre> for markdown-rendered view)
  -> Response sent as complete HTML (no streaming needed for small pads;
     streaming optional for very large pads)
  -> Browser paints text immediately (no JS required)
  -> JS bundle loads asynchronously
  -> JS hydrates: attaches event listeners, initializes editor,
     connects WebSocket if real-time mode
```

Key insight: The initial HTML response contains the full pad text inside a standard `<textarea>`. This means the text is readable and even editable before any JavaScript executes. This is the Dontpad model -- simplicity is speed.

**2. Save Flow: Last-Save-Wins Mode (default)**

```
User types in textarea
  -> Client JS debounces changes (300-500ms)
  -> Client sends PUT /api/pads/:path with full text body
  -> Server writes text to SQLite (single column update)
  -> Server responds 200 OK with timestamp
  -> If another user loads the page, they get the latest saved version
```

No conflict resolution. No merging. The last PUT wins. This is identical to Dontpad's model and is the simplest possible collaboration.

**3. Save Flow: Auto-Merge Mode**

```
User types in textarea
  -> Client JS debounces changes (300-500ms)
  -> Client sends PUT /api/pads/:path with {text, baseVersion}
  -> Server reads current text and version from SQLite
  -> If baseVersion matches current: direct save (no conflict)
  -> If baseVersion differs: server performs three-way text merge
     (base version vs server version vs client version)
  -> Server saves merged result, increments version
  -> Server responds with {text: mergedText, version: newVersion}
  -> Client updates textarea with merged result
```

Three-way merge uses a diff-match-patch library (Google's diff-match-patch) operating on plain text strings. No CRDT overhead. This handles the "two people editing different sections" case well enough.

**4. Save Flow: Real-Time Mode (WebSocket + Yjs)**

```
Page loads with SSR text as before
  -> JS initializes Yjs Y.Doc
  -> JS initializes CodeMirror 6 with y-codemirror.next binding
  -> JS connects WebSocket to /ws/pads/:path
  -> Server creates or joins Room for this pad
  -> Yjs sync protocol exchanges state vectors
  -> Server loads persisted Yjs binary updates from SQLite, sends to client
  -> Client and server are now in sync
  -> Every keystroke generates a Yjs update (Uint8Array)
  -> Client sends update via WebSocket
  -> Server applies update to in-memory Y.Doc
  -> Server broadcasts update to all other clients in Room
  -> Server periodically persists merged Yjs state to SQLite
  -> On disconnect, server persists final state
  -> Server also writes current text snapshot to pad's text column
    (so non-real-time loads still get current content via SSR)
```

**5. Image Paste Flow**

```
User pastes image (Ctrl+V with image in clipboard)
  -> Client JS intercepts paste event
  -> Client reads image blob from ClipboardItem (Clipboard API)
  -> Client generates unique filename (timestamp + random)
  -> Client POSTs to /api/pads/:path/images as multipart/form-data
  -> Server validates file type (png/jpg/gif/webp) and size
  -> Server writes file to /data/images/:padPath/:filename
  -> Server stores image reference in SQLite (pad_id, filename, created_at)
  -> Server responds with image URL: /images/:padPath/:filename
  -> Client inserts markdown image syntax: ![](url) or inline <img> tag
  -> Images served as static files, lazy-loaded with loading="lazy"
```

## Patterns to Follow

### Pattern 1: Text-in-HTML SSR (Zero-JS Readability)

**What:** Inline the pad's text content directly into the server-rendered HTML response inside a `<textarea>` element. The text is readable and editable with zero JavaScript.

**When:** Every initial page load. This is the default path.

**Why:** This is the core speed advantage over Etherpad (which requires JS to render anything) and maintains Dontpad's simplicity. A `<textarea>` with server-rendered content is the fastest possible text delivery -- it is just HTML.

**Example:**
```typescript
// Hono route handler
app.get('/*', async (c) => {
  const path = c.req.path;
  const pad = db.query('SELECT content, mode FROM pads WHERE path = ?').get(path);
  const content = pad?.content ?? '';
  const mode = pad?.mode ?? 'last-save-wins';

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${path} - PadPlus</title>
      <link rel="stylesheet" href="/static/style.css">
    </head>
    <body>
      <div id="app">
        <textarea id="editor" data-pad-path="${path}" data-mode="${mode}">${escapeHtml(content)}</textarea>
      </div>
      <script src="/static/app.js" defer></script>
    </body>
    </html>
  `);
});
```

### Pattern 2: Mode-Aware Client Initialization

**What:** The client JS reads `data-mode` from the textarea and initializes the appropriate collaboration strategy. No unnecessary code loads for simpler modes.

**When:** After JS hydrates on the client.

**Why:** Last-save-wins pads should not load Yjs (large dependency). Only real-time mode needs WebSocket + Yjs + CodeMirror. This keeps the common case fast.

**Example:**
```typescript
// Client-side entry point
const editor = document.getElementById('editor') as HTMLTextAreaElement;
const mode = editor.dataset.mode;

if (mode === 'last-save-wins') {
  // Minimal: just debounced save on input
  initLastSaveWins(editor);
} else if (mode === 'auto-merge') {
  // Adds version tracking and merge logic
  initAutoMerge(editor);
} else if (mode === 'realtime') {
  // Dynamic import: only load heavy deps when needed
  const { initRealtime } = await import('./realtime.js');
  initRealtime(editor);
}
```

### Pattern 3: Dual Storage for Real-Time Pads

**What:** Real-time pads store both the Yjs binary state (for CRDT sync) AND a plain text snapshot (for SSR). The text snapshot is updated whenever the Yjs state changes.

**When:** Any pad in real-time mode.

**Why:** SSR needs plain text to inline in HTML. Yjs needs its binary format for sync. Maintaining both means real-time pads still get instant text-first loading, and switching modes does not lose data.

**Example:**
```typescript
// Server-side: when Yjs state updates
function persistYjsState(padPath: string, ydoc: Y.Doc) {
  const ytext = ydoc.getText('content');
  const textSnapshot = ytext.toString();
  const binaryState = Y.encodeStateAsUpdate(ydoc);

  db.run(`
    UPDATE pads SET content = ?, yjs_state = ?, updated_at = ?
    WHERE path = ?
  `, [textSnapshot, Buffer.from(binaryState), Date.now(), padPath]);
}
```

### Pattern 4: Room-Based WebSocket Management

**What:** Each pad in real-time mode gets a "room" -- an in-memory object holding the Y.Doc and a Set of connected WebSocket clients. Rooms are created on first connection and destroyed when the last client disconnects (after persisting state).

**When:** Real-time collaboration mode.

**Why:** Isolates pads from each other. Simple memory management. No shared state between pads. Matches the y-websocket server pattern.

**Example:**
```typescript
interface Room {
  doc: Y.Doc;
  clients: Set<ServerWebSocket>;
  persistTimer: Timer | null;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(padPath: string): Room {
  if (!rooms.has(padPath)) {
    const doc = new Y.Doc();
    // Load persisted state from SQLite
    const saved = db.query('SELECT yjs_state FROM pads WHERE path = ?').get(padPath);
    if (saved?.yjs_state) {
      Y.applyUpdate(doc, new Uint8Array(saved.yjs_state));
    }
    rooms.set(padPath, { doc, clients: new Set(), persistTimer: null });
  }
  return rooms.get(padPath)!;
}
```

### Pattern 5: Image Directory Structure Mirrors Pad Paths

**What:** Store images in a directory structure that mirrors the pad's URL path. Pad `/meeting/2026-03-07` stores images at `/data/images/meeting/2026-03-07/`.

**When:** Image upload for any pad.

**Why:** Simple to reason about. Easy to clean up when deleting pads. No need for a complex image-to-pad mapping -- the filesystem IS the mapping. Serving is just static file serving with the path prefix.

## Anti-Patterns to Avoid

### Anti-Pattern 1: SPA with Client-Side Routing

**What:** Building a single-page application where the client handles all routing and content fetching.

**Why bad:** Adds a mandatory JavaScript roundtrip before any text is visible. User sees a blank page, then a loading spinner, then content. This is the exact problem with Etherpad that PadPlus is designed to solve.

**Instead:** Server-rendered HTML with the text content inlined. JavaScript enhances the already-visible, already-editable textarea.

### Anti-Pattern 2: Loading Yjs for All Modes

**What:** Initializing Yjs and WebSocket connections for every pad, even those in last-save-wins or auto-merge mode.

**Why bad:** Yjs + y-websocket + y-codemirror.next adds significant bundle size (~40-80KB gzipped). For the common case (simple notepad editing), this is wasted bandwidth and parse time. It also means every pad open maintains a WebSocket connection, wasting server resources.

**Instead:** Dynamic imports. Only load the real-time collaboration stack when `data-mode="realtime"`. Last-save-wins needs only a fetch() call. Auto-merge needs fetch() plus diff-match-patch (~10KB).

### Anti-Pattern 3: Storing Images in SQLite BLOBs

**What:** Putting image binary data directly into SQLite rows.

**Why bad:** Bloats the database file. Makes backups slow. SQLite is not optimized for large BLOBs. Serving images from SQLite requires reading the entire blob into memory per request.

**Instead:** Filesystem for image files, SQLite for metadata only (path, filename, size, created_at). Images served as static files directly by the Hono static middleware or Bun's built-in file serving.

### Anti-Pattern 4: Version History in v1

**What:** Storing every revision of every pad for undo/history.

**Why bad:** Massive storage growth. Complex UI to build. The project explicitly scopes this out. For real-time mode, Yjs handles undo per-session natively via y-undo-manager. For other modes, the text column is simply overwritten.

**Instead:** Single current version per pad. Yjs binary state can be compacted periodically. If version history is ever needed, it is a v2 feature built on top of the existing persistence layer.

### Anti-Pattern 5: Using contenteditable for Plain Text

**What:** Using a contenteditable div instead of a textarea for plain text editing.

**Why bad:** contenteditable produces HTML, not plain text. Browser implementations differ wildly. Paste handling is unpredictable. You fight the browser constantly. For a PLAIN TEXT notepad, this is unnecessary complexity.

**Instead:** Use `<textarea>` for last-save-wins and auto-merge modes (it IS a plain text editor). Use CodeMirror 6 for real-time mode only (because Yjs needs a proper editor binding, and CodeMirror has y-codemirror.next). CodeMirror also handles the markdown syntax highlighting toggle cleanly.

## Component Build Order (Dependency Graph)

Build order matters because later components depend on earlier ones.

```
Phase 1: Foundation (no collaboration, no images)
  SQLite Store -> Hono Router -> SSR Engine -> Static File Server
  Result: A working read/write notepad with server-rendered text.
          Visit any URL, see text, edit, save. Dontpad clone.

Phase 2: Collaboration Modes
  Last-Save-Wins Client JS -> Auto-Merge (diff-match-patch) -> Mode Controller
  Result: Two users can edit the same pad without stomping each other
          (auto-merge), or with explicit overwrite (last-save-wins).

Phase 3: Real-Time Collaboration
  Yjs Sync Engine -> Room Manager -> WebSocket Handler -> y-codemirror.next client
  Depends on: Phase 1 (SQLite for Yjs persistence), Phase 2 (Mode Controller)
  Result: Live cursors, real-time typing, full CRDT sync.

Phase 4: Image Support
  Image Store (filesystem) -> Upload API -> Clipboard paste client JS
  Depends on: Phase 1 (static file serving, SQLite for metadata)
  Result: Paste images, see them inline, stored locally.

Phase 5: Polish
  Markdown toggle -> Dashboard -> Warm UI theme
  Depends on: All above
  Result: Feature-complete product.
```

**Why this order:**
- Phase 1 must be first because every other feature depends on the HTTP server, SQLite, and SSR.
- Phase 2 before Phase 3 because last-save-wins and auto-merge are simpler and more commonly used. They also establish the mode-switching infrastructure that real-time builds on.
- Phase 3 is the heaviest lift (Yjs, WebSocket, CodeMirror). It should come after the simpler modes work.
- Phase 4 is independent of collaboration complexity but depends on the file serving infrastructure from Phase 1.
- Phase 5 is pure UI/UX polish that benefits from all features being in place.

## SQLite Schema Design

```sql
-- Core pad storage
CREATE TABLE pads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,          -- URL path, e.g., '/meeting/standup'
  content TEXT NOT NULL DEFAULT '',    -- Current plain text content (for SSR)
  mode TEXT NOT NULL DEFAULT 'last-save-wins',  -- 'last-save-wins' | 'auto-merge' | 'realtime'
  version INTEGER NOT NULL DEFAULT 1, -- Incremented on each save (for auto-merge)
  yjs_state BLOB,                     -- Yjs binary state (only for realtime pads)
  markdown_enabled INTEGER NOT NULL DEFAULT 0,  -- 0 = plain text, 1 = markdown
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_pads_path ON pads(path);
CREATE INDEX idx_pads_updated ON pads(updated_at DESC);

-- Image metadata (files live on filesystem)
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pad_id INTEGER NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,              -- e.g., '1709827200000-abc123.png'
  original_name TEXT,                  -- Original filename if available
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_images_pad ON images(pad_id);
```

**Key decisions:**
- `path` is unique and indexed -- it is the primary lookup key for every request.
- `content` stores plain text for all modes. Even real-time pads maintain this for SSR.
- `yjs_state` is nullable -- only populated for real-time pads.
- `version` supports auto-merge's optimistic concurrency.
- Timestamps are integers (Unix ms) not strings -- faster comparisons, smaller storage.
- Images reference pads via foreign key with CASCADE delete.

## Scalability Considerations

| Concern | 1-5 users (target) | 50 users | 500+ users |
|---------|---------------------|----------|------------|
| SQLite writes | No issue; WAL mode handles this | WAL mode sufficient; single writer lock is fine at this scale | Consider write queue or move to Postgres |
| WebSocket connections | Trivial; in-memory Map | Fine; Bun handles thousands of concurrent WS | Still fine for single process; Bun benchmarks show 100K+ concurrent WS |
| Memory (Yjs docs) | Negligible; each Y.Doc is small | ~1-5MB for 50 active real-time pads | Consider evicting idle rooms after timeout |
| Image storage | Filesystem is fine | Filesystem is fine | Filesystem is fine; add size limits per pad |
| SSR latency | <5ms SQLite read + HTML template | Same; SQLite reads are fast even at scale | Same; reads are not the bottleneck |

This is a self-hosted tool for a team. The architecture is deliberately simple because the scale does not require complexity. If the team grows to hundreds, the bottleneck will be SQLite write contention on real-time pads, solvable by switching the Yjs persistence to a write queue.

## Sources

- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming) - Official docs, HIGH confidence
- [Hono WebSocket Helper](https://hono.dev/docs/helpers/websocket) - Official docs, HIGH confidence
- [Bun Native SQLite](https://bun.com/docs/runtime/sqlite) - Official docs, HIGH confidence
- [Yjs Document Updates](https://docs.yjs.dev/api/document-updates) - Official docs, HIGH confidence
- [y-websocket Provider](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket) - Official docs, HIGH confidence
- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) - Official repo, HIGH confidence
- [SQLite WAL Mode](https://sqlite.org/wal.html) - Official docs, HIGH confidence
- [Clipboard API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) - Official docs, HIGH confidence
- [Etherpad Architecture](https://github.com/ether/etherpad-lite) - Official repo, MEDIUM confidence
- [CRDT vs OT Comparison](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo) - Community source, MEDIUM confidence
- [Yjs vs Automerge](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync) - Community source, MEDIUM confidence
