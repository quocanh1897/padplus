# Phase 4: Real-Time Collaboration - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add "Real-time" as a third collaboration mode. When enabled, multiple users see each other's keystrokes appear within ~200ms via WebSocket + Yjs CRDT. Disconnection queues edits locally and syncs on reconnect. The mode is selectable alongside last-save-wins and auto-merge in the existing ModeSelector dropdown.

This phase does NOT add user accounts, presence avatars, or chat. The editor surface upgrades from textarea to a Yjs-backed editor in real-time mode only.

</domain>

<decisions>
## Implementation Decisions

### Live Editing Feel
- No visible cursors or user colors — just text syncing silently between users
- Keep the distraction-free feel — upgrade the editor component invisibly (same visual appearance)
- No presence indication — no user count, no "who's editing" — simplest approach
- Images continue to use HTTP upload — only text is synced via WebSocket in real-time mode

### Disconnect Behavior
- User can keep typing when WebSocket drops — edits buffer locally and sync on reconnect (Yjs handles this natively)
- Connection status via colored dot in header: green=connected, yellow=reconnecting, red=disconnected
- Auto-reconnect with exponential backoff — keep trying silently in the background
- No manual retry button needed — reconnection is automatic

### Mode Transition
- Switching TO real-time: editor swaps from textarea to Yjs-backed editor without page reload, content preserved
- Switching FROM real-time: Yjs persistence keeps DB in sync, switching just disconnects WebSocket
- When another user switches the pad to real-time while you're editing in another mode: silent detection on next auto-save, prompts to reload
- "Real-time" appears as a third option in the existing ModeSelector dropdown

### Claude's Discretion
- Yjs integration approach (y-websocket, custom WebSocket provider)
- Editor library for real-time mode (CodeMirror 6, plain contentEditable, or enhanced textarea)
- WebSocket server setup (same process, Hono/SvelteKit WebSocket upgrade)
- Yjs document persistence strategy to SQLite
- Connection status dot styling and placement
- How Yjs document state maps to/from the `content` column
- Reconnection backoff parameters
- How to handle the textarea → Yjs editor swap without losing scroll position
- Room management (one Yjs room per pad slug)

</decisions>

<specifics>
## Specific Ideas

- The real-time experience should feel like "nothing changed" from the user's perspective — same font, same layout, same padding — just text magically stays in sync
- Speed is still king — the initial text load must still be SSR'd before JS loads, even in real-time mode
- Yjs should only load when real-time mode is actually active (dynamic import) — don't bloat the bundle for users who never use real-time
- Playwright E2E tests required for verification

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/components/ModeSelector.svelte`: Dropdown with PATCH API — add 'real-time' as third option
- `src/lib/components/Header.svelte`: Uses ModeSelector — add connection status dot near save status
- `src/lib/components/SaveStatus.svelte`: Five-state indicator — may need to hide/replace in real-time mode (no "saving" when using WebSocket)
- `src/lib/server/pads.ts`: `savePad()` with merge branching, `updateCollaborationMode()` — extend for real-time mode
- `src/lib/server/db.ts`: SQLite with WAL mode, migration system (currently v3) — add Yjs state column or table
- `src/routes/[...slug]/+page.svelte`: Current textarea editor with auto-save — needs conditional swap to Yjs editor

### Established Patterns
- Svelte 5 runes for reactivity
- Dynamic imports already used (SortableJS in ImageGrid) — same pattern for Yjs
- Mode stored in DB `collaboration_mode` column — add 'real-time' as valid value
- CSS custom properties from theme.css — editor styling must match
- SSR text rendering via `+page.server.ts` load function — must still work for initial load

### Integration Points
- `src/routes/[...slug]/+page.svelte`: Conditional rendering based on `collaborationMode` — textarea for LSW/merge, Yjs editor for real-time
- `src/lib/components/ModeSelector.svelte`: Add 'real-time' to modes array and type union
- WebSocket endpoint — new server route for Yjs sync (e.g., `/ws/pads/[slug]`)
- `src/lib/server/db.ts`: Yjs binary state storage (new column or table)
- `src/routes/api/pads/[...slug]/+server.ts`: PUT handler may need to handle mode-change detection

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-real-time-collaboration*
*Context gathered: 2026-03-08*
