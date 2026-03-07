---
phase: 02-image-paste
plan: 01
subsystem: api, database
tags: [sharp, webp, image-upload, sqlite, sveltekit-api, sortablejs]

# Dependency graph
requires:
  - phase: 01-working-notepad
    provides: SvelteKit scaffold, SQLite database with pads table, pad CRUD operations
provides:
  - Images table in SQLite with pad_id FK, uuid, size tracking, sort_order
  - Image CRUD module with 7 prepared statement functions
  - POST upload endpoint with sharp optimization (WebP, resize, EXIF rotation)
  - GET serve endpoint with immutable cache headers
  - DELETE endpoint removing both filesystem file and DB row
  - PUT reorder endpoint with transactional sort_order update
  - GET list endpoint returning image metadata array
  - SSR page load extended with image metadata
affects: [02-image-paste, frontend-components, e2e-tests]

# Tech tracking
tech-stack:
  added: [sharp, sortablejs, "@types/sortablejs"]
  patterns: [image-optimization-pipeline, filesystem-storage-with-db-metadata, api-route-binary-serving]

key-files:
  created:
    - src/lib/server/images.ts
    - src/routes/api/pads/[...slug]/images/+server.ts
    - src/routes/api/pads/[...slug]/images/[imageId]/+server.ts
    - src/routes/api/pads/[...slug]/images/reorder/+server.ts
    - .env.example
  modified:
    - src/lib/server/db.ts
    - src/routes/[...slug]/+page.server.ts
    - package.json

key-decisions:
  - "Enabled foreign_keys pragma in db.ts for ON DELETE CASCADE support"
  - "Used Uint8Array wrapping for Buffer in Response constructor to satisfy TypeScript BodyInit type"
  - "Created .env.example (not .env) for BODY_SIZE_LIMIT since .env is gitignored"

patterns-established:
  - "Image storage: data/uploads/{padId}/{uuid}.webp filesystem layout"
  - "Binary serving: API route reads file, returns Response with Content-Type and immutable cache"
  - "Size enforcement: dual check (Content-Length header + actual file.size) for upload limits"
  - "DB migration chain: re-read user_version after each migration block before checking next"

requirements-completed: [IMG-01, IMG-02, IMG-04]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 2 Plan 1: Backend Image Infrastructure Summary

**Sharp-optimized image upload pipeline with SQLite metadata, filesystem storage, and RESTful API endpoints for upload/serve/delete/reorder**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T18:36:59Z
- **Completed:** 2026-03-07T18:40:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Images table with version 2 migration, indexes on pad_id and uuid, ON DELETE CASCADE FK
- Image CRUD module with 7 prepared statement functions matching pads.ts patterns
- Upload endpoint validates size (5MB/image, 100MB/pad), optimizes with sharp (WebP, 2000px max, EXIF auto-rotate), stores to filesystem
- Serve endpoint returns WebP binary with immutable cache headers (1-year max-age)
- Delete endpoint removes filesystem file first, then DB row (safe ordering per research)
- Reorder endpoint batch-updates sort_order in a transaction
- Page server load extended to include image metadata in SSR response

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, DB migration, and image CRUD module** - `7d3110b` (feat)
2. **Task 2: API endpoints for upload, serve, delete, list, reorder + SSR load** - `0d1c1ac` (feat)

## Files Created/Modified
- `src/lib/server/images.ts` - Image CRUD module with 7 exported functions using prepared statements
- `src/lib/server/db.ts` - Version 2 migration adding images table with indexes
- `src/routes/api/pads/[...slug]/images/+server.ts` - POST upload and GET list endpoints
- `src/routes/api/pads/[...slug]/images/[imageId]/+server.ts` - GET serve and DELETE remove endpoints
- `src/routes/api/pads/[...slug]/images/reorder/+server.ts` - PUT reorder endpoint
- `src/routes/[...slug]/+page.server.ts` - Extended SSR load with getImagesByPadId
- `.env.example` - Documents BODY_SIZE_LIMIT=10M configuration
- `package.json` - Added sharp, sortablejs, @types/sortablejs

## Decisions Made
- Enabled `foreign_keys = ON` pragma in db.ts to ensure ON DELETE CASCADE works for images when a pad is deleted
- Used `Uint8Array` wrapping for Buffer in Response constructor to satisfy TypeScript's BodyInit type requirement
- Created `.env.example` instead of committing `.env` since it's gitignored; documented the BODY_SIZE_LIMIT=10M setting there
- Re-read `user_version` after version 1 migration before checking version 2, establishing a pattern for future migration chains

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer type incompatibility in Response constructor**
- **Found during:** Task 2 (Image serve endpoint)
- **Issue:** TypeScript error: Buffer not assignable to BodyInit in `new Response(data, ...)`
- **Fix:** Wrapped Buffer with `new Uint8Array(data)` which is a valid BodyInit type
- **Files modified:** src/routes/api/pads/[...slug]/images/[imageId]/+server.ts
- **Verification:** `npm run check` passes with 0 errors
- **Committed in:** 0d1c1ac (Task 2 commit)

**2. [Rule 2 - Missing Critical] Enabled foreign_keys pragma for CASCADE support**
- **Found during:** Task 1 (DB migration)
- **Issue:** SQLite foreign key constraints are off by default; ON DELETE CASCADE on images.pad_id would be silently ignored
- **Fix:** Added `db.pragma('foreign_keys = ON')` before migrations
- **Files modified:** src/lib/server/db.ts
- **Verification:** Build succeeds, foreign keys enforced at runtime
- **Committed in:** 7d3110b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
Copy `.env.example` to `.env` (or ensure `BODY_SIZE_LIMIT=10M` is set in the environment). Without this, image uploads larger than 512KB will be rejected by SvelteKit's adapter-node default limit.

## Next Phase Readiness
- All API endpoints ready for frontend integration (Plan 02-02)
- Image metadata included in SSR page load for frontend components
- Sharp optimization pipeline tested via successful build
- SortableJS installed and ready for frontend drag-reorder implementation

## Self-Check: PASSED

All 7 created/modified source files verified on disk. Both task commits (7d3110b, 0d1c1ac) verified in git log.

---
*Phase: 02-image-paste*
*Completed: 2026-03-08*
