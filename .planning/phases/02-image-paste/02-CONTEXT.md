# Phase 2: Image Paste - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can paste images from clipboard into any pad. Images are stored on the local filesystem with generated filenames, displayed in a grid below the text editor, and lazy-loaded so they never block text rendering. Size limits are enforced per-image and per-pad. Users can delete images and reorder them via drag-and-drop.

Markdown toggle, auto-merge collaboration, real-time collaboration, and recent pads list are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Image Display
- Images appear in a grid below the textarea — text stays clean, images in a separate section
- 2-3 column responsive grid of thumbnails
- Click any thumbnail to open a lightbox overlay with the full-size image and close button
- Lazy-loading with animated shimmer skeleton placeholder in each grid slot until the image loads
- Images listed in paste order by default (most recent last)

### Paste Behavior
- Paste captured anywhere on the pad page — not just when textarea is focused
- On paste: skeleton immediately appears in the image grid, fills in when upload completes
- On paste failure: skeleton becomes an error card with retry button in the grid
- Only the first image is processed if user pastes multiple at once
- No drag-and-drop file upload — paste only

### Limits & Feedback
- Max 5 MB per image — reject larger at the HTTP layer
- Max 100 MB total image storage per pad — track cumulative size
- When limit exceeded: error card appears in grid ("Image too large (5MB max)" or "Pad image quota exceeded") with dismiss button
- Server auto-optimizes: re-encode to WebP/JPEG, resize if over 2000px — saves disk, improves lazy-load speed

### Image Management
- Users can delete individual images — X button on hover, deletes immediately (no confirmation, no undo)
- Users can reorder images via drag-and-drop in the grid
- No alt text, captions, or other metadata editing
- Deletion removes from filesystem and database

### Claude's Discretion
- Grid column count and breakpoints
- Lightbox animation and styling
- Skeleton shimmer animation details
- Image optimization settings (quality level, max dimensions)
- Upload API endpoint design
- Database schema for image metadata (images table)
- Filesystem directory structure for stored images
- Rate limiting strategy for uploads
- How reorder state is persisted

</decisions>

<specifics>
## Specific Ideas

- The image grid should feel like a natural extension of the pad — not a separate "file manager" bolted on
- Skeleton → image transition should feel smooth, not jarring
- Error cards should be dismissible and not clutter the grid
- Speed matters: text rendering must never be blocked by image loading — this is the core constraint
- Existing textarea stays as-is; images are a separate section below it
- Playwright E2E tests required for verification

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/components/Header.svelte`: Already shows pad name and save status — may need image count indicator
- `src/lib/components/SaveStatus.svelte`: Five-state indicator — could be extended for upload status
- `src/lib/utils/debounce.ts`: Debounce utility — reusable for upload throttling
- `src/lib/styles/theme.css`: CSS custom properties with warm palette — grid and lightbox should use these
- `src/lib/server/db.ts`: SQLite singleton with WAL mode — images table goes here
- `src/lib/server/pads.ts`: Pad CRUD with prepared statements — pattern to follow for image operations

### Established Patterns
- Server-side data loading via `+page.server.ts` load functions
- API endpoints in `src/routes/api/pads/[...slug]/+server.ts` — image upload endpoint follows same pattern
- Svelte 5 runes (`$state`, `$effect`, `$props`) for reactivity
- CSS custom properties from `theme.css` for all styling
- Catch-all `[...slug]` routing for pad URLs

### Integration Points
- `src/routes/[...slug]/+page.svelte`: Add image grid section below textarea
- `src/routes/[...slug]/+page.server.ts`: Load image metadata alongside pad content
- `src/routes/api/pads/[...slug]/+server.ts`: Add image upload endpoint (POST) and delete endpoint (DELETE)
- `src/lib/server/db.ts`: Add `images` table to schema migration
- Paste event listener on the pad page component (document-level)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-image-paste*
*Context gathered: 2026-03-07*
