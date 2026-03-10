---
phase: 04-real-time-collaboration
plan: 01
subsystem: api
tags: [yjs, websocket, crdt, y-protocols, ws, lib0, real-time, sqlite]

# Dependency graph
requires:
  - phase: 03-auto-merge-collaboration
    provides: collaboration mode infrastructure (mode column, PATCH endpoint)
provides:
  - WebSocket server at /ws/pads/{slug} with Yjs CRDT sync
  - Yjs binary state persistence to SQLite (yjs_state BLOB column)
  - Content column kept in sync with Yjs state for SSR compatibility
  - Vite dev plugin for WebSocket upgrade during development
  - Production server entry point with standalone Yjs room management
  - 'real-time' collaboration mode accepted by pads.ts and mode endpoint
affects: [04-02-PLAN (frontend RealtimeEditor connects to this WebSocket)]

# Tech tracking
tech-stack:
  added: [yjs, y-websocket, y-textarea, ws, fast-diff, @types/ws]
  patterns: [y-protocols sync handshake, debounced persistence, noServer WebSocket upgrade, Vite configureServer plugin]

key-files:
  created:
    - src/lib/server/ws-server.ts
    - src/lib/server/yjs-persistence.ts
    - server/index.js
  modified:
    - src/lib/server/db.ts
    - src/lib/server/pads.ts
    - src/routes/api/pads/[...slug]/mode/+server.ts
    - vite.config.ts
    - package.json

key-decisions:
  - "Synchronous room creation to avoid race conditions between check and set (no async gap)"
  - "30-second cleanup timer on empty rooms to prevent memory leaks while allowing quick reconnects"
  - "Debounced persistence at 500ms with immediate save on last client disconnect"
  - "Self-contained server/index.js for production (own DB connection, no SvelteKit build imports for Yjs)"
  - "Vite plugin placed before sveltekit() in plugins array and path-filtered to /ws/pads/* to preserve HMR"

patterns-established:
  - "WebSocket upgrade pattern: noServer WSS with httpServer.on('upgrade') filtered by URL path"
  - "Yjs room lifecycle: create doc -> load/seed state -> register update listener -> track clients -> cleanup on empty"
  - "Dual persistence: saveYjsState writes both BLOB state and plain text content in single UPDATE"

requirements-completed: [COLLAB-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 4 Plan 1: Real-Time Collaboration Backend Summary

**WebSocket server with Yjs CRDT sync at /ws/pads/{slug}, SQLite persistence for binary state, and dual dev/production server entry points**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T04:21:08Z
- **Completed:** 2026-03-10T04:25:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- WebSocket server handles Yjs connections with room management, y-protocols sync, debounced persistence, and 30-second room cleanup
- Yjs binary state persists to SQLite via yjs_state BLOB column (migration v4), with content column kept in sync for SSR
- Vite dev plugin intercepts /ws/pads/* upgrades without breaking HMR (path-filtered, noServer pattern)
- Production server at server/index.js provides identical WebSocket handling with its own DB connection
- Mode endpoint and pads.ts now accept 'real-time' as valid collaboration mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Yjs dependencies, DB migration, persistence layer, and mode endpoint update** - `b874236` (feat)
2. **Task 2: WebSocket server module, Vite dev plugin, and production server entry** - `70fb42a` (feat)

## Files Created/Modified
- `src/lib/server/ws-server.ts` - Core WebSocket handler with Yjs room management, y-protocols sync, debounced persistence
- `src/lib/server/yjs-persistence.ts` - SQLite persistence for Yjs binary state with prepared statements
- `server/index.js` - Production server wrapping adapter-node with WebSocket upgrade support
- `src/lib/server/db.ts` - Migration v4 adding yjs_state BLOB column to pads table
- `src/lib/server/pads.ts` - Widened collaboration mode type to include 'real-time'
- `src/routes/api/pads/[...slug]/mode/+server.ts` - Updated validation to accept 'real-time' mode
- `vite.config.ts` - Added yjsWebSocket plugin for dev WebSocket server
- `package.json` - Added Yjs deps, ws, fast-diff, @types/ws; added start script for production server

## Decisions Made
- Synchronous room creation (no async gap between map check and set) to prevent race conditions per Research Pitfall 2
- 30-second cleanup timer on empty rooms balances memory cleanup with allowing quick reconnects
- Debounced persistence at 500ms reduces SQLite write pressure; immediate save on last client disconnect prevents data loss
- Self-contained server/index.js avoids import/build complexity with SvelteKit output directory
- Vite plugin ordered before sveltekit() and path-filtered to /ws/pads/* to preserve Vite HMR WebSocket at /@vite/client

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- WebSocket endpoint at /ws/pads/{slug} is ready for the frontend RealtimeEditor (Plan 02) to connect
- handleYjsConnection export available for import in the Vite dev plugin
- 'real-time' mode can be set via PATCH /api/pads/{slug}/mode
- Production server entry ready at server/index.js after `npm run build`

## Self-Check: PASSED

All 8 files verified present. Both task commits (b874236, 70fb42a) verified in git log.

---
*Phase: 04-real-time-collaboration*
*Completed: 2026-03-10*
