---
phase: 03-auto-merge-collaboration
plan: 01
subsystem: api, database
tags: [node-diff3, three-way-merge, sqlite, better-sqlite3, collaboration]

# Dependency graph
requires:
  - phase: 01-working-notepad
    provides: "Pad CRUD, savePad with optimistic concurrency, PUT handler with 409 conflict"
provides:
  - "merge.ts module with mergeText() for three-way text merge"
  - "Extended savePad() returning SaveResult union type with saved/merged/conflict branches"
  - "updateCollaborationMode() for per-pad mode switching"
  - "PUT handler with merge branching (200 with merged:true or 409 for last-save-wins)"
  - "PATCH /api/pads/[slug]/mode endpoint for changing collaboration mode"
  - "DB migration v3 adding base_content column with backfill"
affects: [03-02, 04-real-time-collaboration]

# Tech tracking
tech-stack:
  added: [node-diff3@3.2.0]
  patterns: [three-way-merge-with-diff3Merge, transaction-wrapped-merge, SaveResult-union-type]

key-files:
  created:
    - src/lib/server/merge.ts
    - src/routes/api/pads/[...slug]/mode/+server.ts
  modified:
    - src/lib/server/db.ts
    - src/lib/server/pads.ts
    - src/routes/api/pads/[...slug]/+server.ts
    - package.json

key-decisions:
  - "Used diff3Merge (structured blocks) instead of merge() (conflict markers) to avoid embedding markers in content"
  - "Best-effort conflict resolution: concatenate client then server version at conflict points"
  - "Merge path wrapped in db.transaction() with BEGIN IMMEDIATE for race condition safety"
  - "base_content updated to new content on every save (direct or merged) to track common ancestor"

patterns-established:
  - "SaveResult union type: type-discriminated union for save outcomes (saved/merged/conflict)"
  - "Transaction-wrapped merge: read + compute + write inside db.transaction() for atomicity"
  - "Force update pattern: forceUpdateStmt bypasses version check for writing merge results"

requirements-completed: [COLLAB-02, COLLAB-04]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 3 Plan 1: Backend Merge Engine Summary

**Three-way merge engine using node-diff3 with DB migration, extended savePad, and mode-switching API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T19:39:12Z
- **Completed:** 2026-03-07T19:42:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed node-diff3 and created merge.ts with mergeText() using diff3Merge structured regions for clean conflict detection
- Extended savePad() with SaveResult union type that branches on collaboration_mode: auto-merge pads get three-way merge, last-save-wins pads get 409 (unchanged)
- Added DB migration v3 with base_content column and backfill, plus updateCollaborationMode() function
- Updated PUT handler with switch-based result handling and created PATCH /api/pads/[slug]/mode endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration, merge module, and extended pad operations** - `ebb2d48` (feat)
2. **Task 2: Extended PUT handler and new mode PATCH endpoint** - `8a32b1c` (feat)

## Files Created/Modified
- `src/lib/server/merge.ts` - Three-way merge logic wrapping node-diff3 diff3Merge; exports mergeText() and MergeResult
- `src/lib/server/db.ts` - Migration v3: adds base_content column to pads table, backfills existing pads
- `src/lib/server/pads.ts` - Extended with SaveResult type, merge-aware savePad(), updateCollaborationMode()
- `src/routes/api/pads/[...slug]/+server.ts` - PUT handler branches on SaveResult type (saved/merged/conflict)
- `src/routes/api/pads/[...slug]/mode/+server.ts` - PATCH endpoint for changing pad collaboration mode
- `package.json` - Added node-diff3 dependency

## Decisions Made
- Used diff3Merge (structured ok/conflict blocks) instead of merge() (string with conflict markers) to avoid Pitfall 5 from research
- Best-effort conflict handling: when overlapping edits detected, concatenate client version then server version at conflict points
- Merge path wrapped in db.transaction() which uses BEGIN IMMEDIATE by default, preventing race conditions per Research Pitfall 3
- base_content set to the new content after every successful save or merge, maintaining the common ancestor for future merges
- PATCH mode endpoint includes try/catch to convert "not found" errors into proper 404 HTTP responses

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend merge engine fully operational, ready for Plan 02 frontend integration
- PUT handler returns merged:true with content for auto-merge pads, enabling client content updates
- PATCH mode endpoint ready for header dropdown integration
- All existing last-save-wins behavior preserved (409 on version mismatch)

## Self-Check: PASSED

All 6 files verified present. Both task commits (ebb2d48, 8a32b1c) verified in git log.

---
*Phase: 03-auto-merge-collaboration*
*Completed: 2026-03-08*
