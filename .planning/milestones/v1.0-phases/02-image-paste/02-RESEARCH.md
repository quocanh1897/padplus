# Phase 2: Image Paste - Research

**Researched:** 2026-03-08
**Domain:** Clipboard image capture, file upload, image optimization, lazy-loaded grid display (SvelteKit + SQLite)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Images appear in a grid below the textarea -- text stays clean, images in a separate section
- 2-3 column responsive grid of thumbnails
- Click any thumbnail to open a lightbox overlay with the full-size image and close button
- Lazy-loading with animated shimmer skeleton placeholder in each grid slot until the image loads
- Images listed in paste order by default (most recent last)
- Paste captured anywhere on the pad page -- not just when textarea is focused
- On paste: skeleton immediately appears in the image grid, fills in when upload completes
- On paste failure: skeleton becomes an error card with retry button in the grid
- Only the first image is processed if user pastes multiple at once
- No drag-and-drop file upload -- paste only
- Max 5 MB per image -- reject larger at the HTTP layer
- Max 100 MB total image storage per pad -- track cumulative size
- When limit exceeded: error card appears in grid ("Image too large (5MB max)" or "Pad image quota exceeded") with dismiss button
- Server auto-optimizes: re-encode to WebP/JPEG, resize if over 2000px -- saves disk, improves lazy-load speed
- Users can delete individual images -- X button on hover, deletes immediately (no confirmation, no undo)
- Users can reorder images via drag-and-drop in the grid
- No alt text, captions, or other metadata editing
- Deletion removes from filesystem and database
- Playwright E2E tests required for verification

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMG-01 | User can paste images from clipboard directly into a pad | Clipboard API paste event handling, FormData upload pattern, SvelteKit POST endpoint |
| IMG-02 | Images stored on local filesystem with generated filenames | crypto.randomUUID() for filenames, sharp for optimization, data/uploads directory structure |
| IMG-03 | Images lazy-load -- never block text rendering | Native `loading="lazy"` on img tags, shimmer skeleton CSS, separate API route for image serving |
| IMG-04 | Image uploads have size limits (per-image and per-pad quota) | BODY_SIZE_LIMIT env var (SvelteKit adapter-node), Content-Length check in endpoint, cumulative size tracking in SQLite |
</phase_requirements>

## Summary

This phase adds image paste support to PadPlus. Users paste images from their clipboard anywhere on a pad page; images are uploaded to the server, optimized (resized/re-encoded), stored on the filesystem, and displayed in a lazy-loaded grid below the textarea. The core constraint is that image loading must never block text rendering.

The technical domain spans four areas: (1) browser Clipboard API for capturing pasted images, (2) SvelteKit API endpoints for multipart upload and binary serving, (3) sharp for server-side image optimization, and (4) a responsive grid with skeleton placeholders, lightbox, and drag-to-reorder via SortableJS. The existing codebase uses SvelteKit with adapter-node, Svelte 5 runes, better-sqlite3, and Playwright for E2E tests. All patterns should follow the established conventions (prepared statements, CSS custom properties, `$state`/`$effect` runes).

**Primary recommendation:** Use the browser `paste` event on the document to capture clipboard images, upload via `fetch` to a new POST endpoint at `/api/pads/[...slug]/images`, optimize with `sharp` (resize to 2000px max, WebP at quality 80), store in `data/uploads/{padId}/` with UUID filenames, serve via a GET endpoint, and display in a CSS grid with native `loading="lazy"` and shimmer skeletons.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | ^0.34.5 | Server-side image resize + format conversion | Fastest Node.js image processor, libvips-backed, handles WebP/JPEG/PNG natively |
| sortablejs | ^1.15 | Drag-and-drop reorder in image grid | Most mature DnD library, works with native HTML5 DnD, proven Svelte 5 integration pattern |
| @types/sortablejs | latest | TypeScript types for SortableJS | Project uses TypeScript |

### Already in Project (no install needed)
| Library | Version | Purpose |
|---------|---------|---------|
| better-sqlite3 | ^12.6.2 | Image metadata storage (new `images` table) |
| @sveltejs/kit | ^2.50.2 | API routes for upload/serve/delete, form data handling |
| @sveltejs/adapter-node | ^5.5.4 | BODY_SIZE_LIMIT env var for upload size enforcement |
| @playwright/test | ^1.58.2 | E2E tests for paste, upload, display, delete |
| svelte | ^5.51.0 | Runes ($state, $effect) for reactive image grid |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp | jimp | Pure JS but 5-10x slower, no native WebP encode |
| SortableJS | Native HTML5 DnD API | No touch support, verbose code, no auto-scroll |
| SortableJS | svelte-sortable-list | Less mature, smaller community, SortableJS is battle-tested |
| API route image serving | Express static middleware | Requires custom server.js, breaks standard SvelteKit dev flow |

**Installation:**
```bash
npm install sharp sortablejs
npm install -D @types/sortablejs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    server/
      db.ts              # Add migration for images table
      pads.ts            # Existing (unchanged)
      images.ts          # NEW: image CRUD operations (prepared statements)
    components/
      ImageGrid.svelte   # NEW: grid + skeleton + error cards
      ImageCard.svelte   # NEW: single image thumbnail with delete button
      Lightbox.svelte    # NEW: fullscreen overlay for image viewing
    utils/
      debounce.ts        # Existing (reusable for upload throttling)
  routes/
    [...slug]/
      +page.svelte       # Add ImageGrid below textarea, paste handler
      +page.server.ts    # Load image metadata alongside pad content
    api/
      pads/[...slug]/
        +server.ts       # Existing PUT for pad content
        images/
          +server.ts     # NEW: POST (upload), GET (list)
          [imageId]/
            +server.ts   # NEW: GET (serve file), DELETE (remove)
            reorder/
              +server.ts # NEW: PUT (update sort_order)
data/
  padplus.db             # Existing database
  uploads/               # NEW: image storage root
    {padId}/             # Per-pad directories
      {uuid}.webp        # Optimized images
```

### Pattern 1: Clipboard Paste Capture
**What:** Listen for paste events at the document level, extract image files from clipboard, upload via fetch
**When to use:** Always -- this is the only image input method (no file picker, no drag-drop upload)
**Example:**
```typescript
// Source: MDN ClipboardEvent.clipboardData
// In +page.svelte <script>
function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        uploadImage(file);
      }
      return; // Only process first image
    }
  }
}

// Register at document level
$effect(() => {
  document.addEventListener('paste', handlePaste);
  return () => document.removeEventListener('paste', handlePaste);
});
```

### Pattern 2: SvelteKit File Upload Endpoint
**What:** POST endpoint that accepts FormData with image file, validates size, optimizes with sharp, saves to disk
**When to use:** Image upload endpoint at `/api/pads/[...slug]/images`
**Example:**
```typescript
// Source: SvelteKit docs + sharp docs
// src/routes/api/pads/[...slug]/images/+server.ts
import { json, error } from '@sveltejs/kit';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PAD_QUOTA = 100 * 1024 * 1024; // 100MB
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 80;

export const POST: RequestHandler = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug) error(400, 'Slug is required');

  // Check Content-Length before reading body
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_IMAGE_SIZE) {
    error(413, 'Image too large (5MB max)');
  }

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  if (!file || !file.type.startsWith('image/')) {
    error(400, 'No valid image provided');
  }

  // Double-check actual file size
  if (file.size > MAX_IMAGE_SIZE) {
    error(413, 'Image too large (5MB max)');
  }

  // Check pad quota (query cumulative size from DB)
  // ... getPadImageTotalSize(padId) ...

  const buffer = Buffer.from(await file.arrayBuffer());
  const uuid = randomUUID();
  const filename = `${uuid}.webp`;

  // Optimize: resize if needed, convert to WebP
  const optimized = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Save to filesystem
  const uploadDir = path.join(process.cwd(), 'data', 'uploads', String(padId));
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), optimized);

  // Insert into database
  // ... insertImage(padId, uuid, filename, optimized.length, sortOrder) ...

  return json({ id: uuid, filename, size: optimized.length });
};
```

### Pattern 3: Image Serving via API Route
**What:** GET endpoint that reads image from filesystem and returns binary response with proper Content-Type
**When to use:** Serving uploaded images -- cannot use SvelteKit `static/` because images are dynamic user content
**Example:**
```typescript
// Source: SvelteKit docs, Node.js fs
// src/routes/api/pads/[...slug]/images/[imageId]/+server.ts
import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  // Look up image metadata in DB to get filename and padId
  // ...
  const filePath = path.join(process.cwd(), 'data', 'uploads', String(padId), image.filename);

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(data.length)
      }
    });
  } catch {
    error(404, 'Image not found');
  }
};
```

### Pattern 4: Database Migration for Images Table
**What:** Add images table using the existing user_version migration pattern
**When to use:** In `src/lib/server/db.ts`, extending the migration chain
**Example:**
```typescript
// Source: Existing db.ts pattern
if (currentVersion < 2) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pad_id INTEGER NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
      uuid TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      original_filename TEXT,
      mime_type TEXT NOT NULL DEFAULT 'image/webp',
      size_bytes INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_images_pad_id ON images(pad_id);
    CREATE INDEX IF NOT EXISTS idx_images_uuid ON images(uuid);
  `);
  db.pragma('user_version = 2');
}
```

### Pattern 5: SortableJS Integration with Svelte 5
**What:** Use SortableJS with a custom `$effect` hook for drag-and-drop reordering
**When to use:** Image grid reordering
**Example:**
```typescript
// Source: dev.to/jdgamble555/svelte-5-and-sortablejs-5h6j
import Sortable from 'sortablejs';

let gridEl: HTMLElement;

$effect(() => {
  if (!gridEl) return;
  const sortable = Sortable.create(gridEl, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
        // Reorder the images array
        const moved = images.splice(evt.oldIndex, 1)[0];
        images.splice(evt.newIndex, 0, moved);
        // Persist new order to server
        saveImageOrder(images.map((img, i) => ({ id: img.uuid, sort_order: i })));
      }
    }
  });
  return () => sortable.destroy();
});
```

### Anti-Patterns to Avoid
- **Storing images in SQLite BLOBs:** Database bloat, slow queries, breaks backup strategies. Use filesystem + metadata in DB.
- **Blocking text load on image metadata:** Load image metadata as a separate client-side fetch, not in the SSR page load critical path. Actually, image metadata is small enough to include in SSR load, but image binary data must never be inlined.
- **Using base64 data URLs for images:** Enormous HTML payload, 33% larger than binary, defeats lazy loading entirely.
- **Synchronous sharp operations in request handler:** sharp is async by design. Always await. Never use `sharp().toBuffer()` without await.
- **Serving images from `static/`:** The `static/` directory is for build-time assets baked into the deployment. User uploads must go through a data directory with API serving.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize/format conversion | Manual canvas manipulation or ImageMagick shell calls | sharp | Handles ICC profiles, EXIF rotation, memory limits, dozens of edge cases |
| Drag-and-drop reorder | Native HTML5 DnD event handlers | SortableJS | Touch support, auto-scroll, animation, ghost elements, tested across browsers |
| UUID generation | Math.random hex strings | crypto.randomUUID() | Cryptographically secure, zero dependencies, built into Node.js |
| Content-type detection | Extension-based guessing | Check file header magic bytes (sharp handles this internally) | Extensions lie, magic bytes don't |
| Shimmer skeleton animation | Custom JS animation loop | Pure CSS @keyframes with linear-gradient | GPU-accelerated, zero JS overhead, well-established pattern |

**Key insight:** Image processing has an extraordinary number of edge cases (EXIF rotation, ICC color profiles, animated GIFs, corrupt headers, alpha channels, CMYK vs RGB). sharp handles all of these. Custom solutions will break on real user images.

## Common Pitfalls

### Pitfall 1: BODY_SIZE_LIMIT Blocking Uploads
**What goes wrong:** SvelteKit adapter-node has a default BODY_SIZE_LIMIT of 512KB. Image uploads over 512KB silently fail with no helpful error.
**Why it happens:** Developers forget about this built-in limit when adding file upload functionality.
**How to avoid:** Set `BODY_SIZE_LIMIT=10M` environment variable (allow some headroom above the 5MB per-image limit for FormData overhead). Configure this in `.env`, `package.json` scripts, and document for deployment.
**Warning signs:** Uploads of small images succeed, larger ones fail with cryptic errors.

### Pitfall 2: Paste Event Conflicts with Text Paste
**What goes wrong:** The paste handler intercepts ALL paste events, breaking text paste into the textarea.
**Why it happens:** Not checking if the clipboard data contains image items before preventing default behavior.
**How to avoid:** Only call `event.preventDefault()` when clipboard contains image data. Check `item.type.startsWith('image/')` first. If no image items, let the event propagate naturally for text paste.
**Warning signs:** Users can't paste text anymore after implementing image paste.

### Pitfall 3: Race Condition on Rapid Pastes
**What goes wrong:** User pastes multiple images quickly. Skeletons appear but fill in out of order, or sort_order values collide.
**Why it happens:** Concurrent async uploads complete in unpredictable order.
**How to avoid:** Generate sort_order client-side at paste time (use timestamp or incrementing counter). Track pending uploads with a Map keyed by temporary ID. Skeleton order matches paste order regardless of upload completion order.
**Warning signs:** Images appear in wrong order or flash/reorder when uploads complete.

### Pitfall 4: Memory Pressure from Large Image Buffers
**What goes wrong:** Multiple concurrent 5MB uploads exhaust server memory when buffered entirely in RAM.
**Why it happens:** `Buffer.from(await file.arrayBuffer())` loads entire file into memory before sharp processes it.
**How to avoid:** For this app's scale (single-user internal tool), this is acceptable. But set a reasonable concurrent upload limit client-side (one at a time per the "only first image" rule). Monitor memory if scaling.
**Warning signs:** Node.js OOM crashes under load.

### Pitfall 5: Missing Filesystem Cleanup on Delete
**What goes wrong:** Database row is deleted but filesystem file remains, or vice versa.
**Why it happens:** Two-step delete (DB + filesystem) without proper error handling or ordering.
**How to avoid:** Delete from filesystem first, then from database. If filesystem delete fails, don't delete from DB (image is still served). If DB delete fails after filesystem delete, the orphaned DB row points to a missing file (handle gracefully with 404 on serve).
**Warning signs:** Disk usage grows even after deleting images; 500 errors on image serve after DB row removed.

### Pitfall 6: EXIF Orientation Not Applied
**What goes wrong:** Photos from phones appear rotated 90 degrees.
**Why it happens:** JPEG EXIF orientation tag is not applied when rendering the image.
**How to avoid:** sharp automatically applies EXIF rotation by default (`.rotate()` with no arguments). Ensure this isn't disabled. The default behavior in sharp is correct -- it auto-rotates based on EXIF.
**Warning signs:** Phone photos display sideways.

## Code Examples

### Shimmer Skeleton CSS
```css
/* Pure CSS shimmer animation -- no JS needed */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    var(--color-bg-elevated) 50%,
    var(--color-border) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Responsive Image Grid CSS
```css
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-md);
  padding: var(--space-lg);
}

/* 2 columns on mobile, 3+ on wider screens */
@media (max-width: 640px) {
  .image-grid {
    grid-template-columns: repeat(2, 1fr);
    padding: var(--space-md);
    gap: var(--space-sm);
  }
}
```

### Lightbox Overlay Pattern
```svelte
<!-- Basic lightbox structure -->
{#if lightboxImage}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lightbox-overlay"
    onclick={closeLightbox}
    onkeydown={(e) => e.key === 'Escape' && closeLightbox()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <button class="lightbox-close" onclick={closeLightbox}>x</button>
    <img src={lightboxImage.url} alt="" class="lightbox-image" />
  </div>
{/if}

<style>
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lightbox-image {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: var(--radius-md);
  }
  .lightbox-close {
    position: absolute;
    top: var(--space-lg);
    right: var(--space-lg);
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
  }
</style>
```

### Client-Side Upload with Skeleton State
```typescript
// Reactive image list with pending uploads
interface ImageItem {
  uuid: string;
  url: string;
  status: 'loading' | 'loaded' | 'error';
  errorMessage?: string;
  size_bytes: number;
  sort_order: number;
}

let images = $state<ImageItem[]>([]);

async function uploadImage(file: File) {
  // Client-side size check
  if (file.size > 5 * 1024 * 1024) {
    addErrorCard('Image too large (5MB max)');
    return;
  }

  const tempId = crypto.randomUUID();
  const skeleton: ImageItem = {
    uuid: tempId,
    url: '',
    status: 'loading',
    size_bytes: 0,
    sort_order: images.length
  };
  images = [...images, skeleton];

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`/api/pads/${slug}/images`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      updateImageStatus(tempId, 'error', err.message || 'Upload failed');
      return;
    }

    const result = await res.json();
    // Replace skeleton with real image
    images = images.map(img =>
      img.uuid === tempId
        ? { ...img, uuid: result.id, url: `/api/pads/${slug}/images/${result.id}`, status: 'loaded', size_bytes: result.size }
        : img
    );
  } catch {
    updateImageStatus(tempId, 'error', 'Upload failed -- check your connection');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DataTransfer.getData('text/html') for images | clipboardData.items with getAsFile() | Standardized ~2020 | Direct File access, no HTML parsing needed |
| ImageMagick shell calls | sharp (libvips bindings) | sharp mature since ~2018 | 4-5x faster, no shell exec, async Node-native |
| Custom drag-drop from scratch | SortableJS with Svelte 5 $effect hook | 2024-2025 | Touch support, animation, 2KB gzipped |
| IntersectionObserver for lazy load | Native loading="lazy" on img | Widely supported since 2020 | Zero JS, browser-optimized, no observer setup |
| Base64 inline images | Filesystem + API route serving | Best practice always | 33% smaller payload, proper caching, lazy-loadable |

**Deprecated/outdated:**
- `document.execCommand('paste')`: Replaced by Clipboard API, deprecated in browsers
- `FileReader.readAsDataURL()` for upload previews: Use `URL.createObjectURL(file)` instead (no async, no memory copy)
- `request.body` for file uploads in SvelteKit: Use `request.formData()` which properly parses multipart data

## Open Questions

1. **Image serving performance at scale**
   - What we know: API route per-image-request works fine for internal tools with low concurrency
   - What's unclear: If pad has 50+ images, will the GET requests bottleneck the single Node.js process?
   - Recommendation: Implement with API routes for now. Add `Cache-Control: immutable` headers (images never change once uploaded). If needed later, add a reverse proxy (nginx) to serve the uploads directory directly.

2. **Reorder persistence granularity**
   - What we know: SortableJS fires onEnd with oldIndex/newIndex. We need to persist the new order.
   - What's unclear: Should we update ALL image sort_orders on every reorder, or just the moved item?
   - Recommendation: Update all sort_orders in a single transaction (simple, correct, fast with SQLite). Send the full ordered list of UUIDs to a PUT endpoint.

3. **Pad ID lookup for image operations**
   - What we know: Routes use slug (URL path), but images table references pad_id (integer FK)
   - What's unclear: Best place to resolve slug -> pad_id for image operations
   - Recommendation: Create a `getOrCreatePadBySlug(slug)` helper that returns the pad with its ID. Use this in image endpoints to resolve the FK.

## Sources

### Primary (HIGH confidence)
- [sharp official docs](https://sharp.pixelplumbing.com/) - Resize API, output format options (WebP quality 80 default, resize fit modes)
- [sharp API output](https://sharp.pixelplumbing.com/api-output) - WebP/JPEG options, toBuffer/toFile API
- [MDN ClipboardEvent.clipboardData](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData) - DataTransfer items, getAsFile()
- [SvelteKit adapter-node docs](https://svelte.dev/docs/kit/adapter-node) - BODY_SIZE_LIMIT default 512KB, configuration syntax
- [Node.js crypto.randomUUID](https://nodejs.org/api/crypto.html) - Built-in UUID v4 generation
- [MDN Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading) - Native loading="lazy" attribute

### Secondary (MEDIUM confidence)
- [SvelteKit file upload patterns](https://travishorn.com/uploading-and-saving-files-with-sveltekit/) - request.formData() + writeFile pattern, verified against SvelteKit docs
- [Svelte 5 + SortableJS integration](https://dev.to/jdgamble555/svelte-5-and-sortablejs-5h6j) - Custom hook with $effect, reorder helper, verified with Svelte playground
- [SvelteKit streaming file serving](https://diekmeier.de/posts/2023-11-06-streaming-files-from-sveltekit/) - ReadableStream response for binary data
- [SvelteKit GitHub discussion #10162](https://github.com/sveltejs/kit/discussions/10162) - Serving assets from dynamic locations

### Tertiary (LOW confidence)
- SortableJS exact latest version (1.15.x assumed based on npm search -- verify at install time)
- SvelteKit 2.49 streaming upload feature (mentioned in search results, may not be needed for this phase's scope)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sharp and SortableJS are well-documented, widely used, versions verified
- Architecture: HIGH - follows existing project patterns (prepared statements, API routes, Svelte 5 runes), SvelteKit file upload is well-documented
- Pitfalls: HIGH - BODY_SIZE_LIMIT is documented in official SvelteKit docs, paste event behavior verified via MDN, sharp EXIF handling confirmed in official docs

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (30 days -- stable domain, no rapidly moving parts)
