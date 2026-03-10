# Phase 1: Working Notepad - Research

**Researched:** 2026-03-07
**Domain:** SSR web app with SQLite persistence, auto-save, optimistic concurrency
**Confidence:** HIGH

## Summary

Phase 1 delivers a URL-based notepad where any path becomes a working editor with content visible before JavaScript loads. The recommended stack is **SvelteKit 2 + Svelte 5** for the framework (smallest JS bundles, SSR by default, catch-all routing), **better-sqlite3** for synchronous SQLite with WAL mode, and **vanilla CSS with custom properties** for the warm aesthetic. SvelteKit's `adapter-node` produces a single-process Node.js server that matches the INFRA-02 requirement perfectly.

The core architecture uses a SvelteKit catch-all route (`[...slug]`) that loads pad content server-side in `+page.server.ts`, renders it into a `<textarea>` in the HTML before any JS ships, then hydrates to add auto-save via a debounced fetch to a `+server.ts` API endpoint. Optimistic concurrency uses an integer `version` column in SQLite -- the client sends its known version on save, the server rejects if it does not match, and the UI shows a conflict banner with options to overwrite or copy-and-reload.

This is a greenfield project. This phase establishes every foundational pattern (project structure, database access, styling system, routing) that later phases build on. Getting the architecture right here avoids rewrites later.

**Primary recommendation:** Use SvelteKit 2 with adapter-node, better-sqlite3 with WAL mode, catch-all routing for pad URLs, server-side textarea rendering, debounced auto-save via fetch POST, and integer version column for optimistic concurrency.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Distraction-free editing surface -- just text, no visible chrome around the editor
- Thin header bar with pad name + save status + home link, but the editor dominates the page
- Sans-serif font for the editor -- clean, modern reading feel matching the warm aesthetic
- Full width editor with comfortable padding -- maximize space for notes
- Save feedback: subtle text indicator in header -- "Saved" / "Saving..." / "Unsaved changes"
- Minimal header: pad name (from URL slug), save status indicator, home link icon
- Collaboration mode indicator in header (Phase 1 only shows "last-save-wins" but establishes the UI slot for future modes)
- Pad name displays as the URL path as-is (e.g., `/meeting-notes`) -- no humanization or renaming
- Follows system light/dark preference -- respects OS setting automatically
- Subtle PadPlus branding -- small logo/name in header, pad content is the focus
- Address-bar style URL input on landing page -- shows `padplus/` prefix, user types the pad slug
- Large, centered on page -- Google-search-bar energy
- Light hero: app name + one-line description ("Type a name, start writing") above the URL bar
- Empty state (first visit): just the URL bar + tagline, clean and inviting
- Phase 1 has no recent pads list (that's DASH-02, v2)
- On stale save: banner at top of editor warning that the pad was modified since load
- Shows what changed (diff or summary) so user can make an informed decision
- User can force-overwrite with a clearly labeled "Overwrite" button (with warning text)
- User can copy their version to clipboard before reloading to see server version
- Stale detection happens on save only (not periodic polling) -- simplest approach
- Auto-save fires, version mismatch detected -> banner appears, auto-save pauses until user resolves
- Playwright E2E tests required for verification after implementation

### Claude's Discretion
- Exact color palette within "warm & inviting" (soft tones, rounded corners, Arc-inspired)
- Typography choices (font family, sizes, weights)
- Spacing, padding, border-radius values
- Auto-save debounce timing (300-500ms range per research)
- Error state handling beyond conflicts
- SSR implementation approach (streaming vs full render)
- SQLite schema design

### Deferred Ideas (OUT OF SCOPE)
- Recent pads list on dashboard -- DASH-02 (v2)
- Markdown toggle -- MD-01 (v2)
- Image paste -- Phase 2
- Auto-merge collaboration -- Phase 3
- Real-time collaboration -- Phase 4

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | User can navigate to any URL path and get a working pad instantly | SvelteKit catch-all route `[...slug]` + server load function creates pad on first visit |
| CORE-02 | Text content renders server-side before JavaScript loads | SvelteKit SSR is default -- `+page.server.ts` load function fetches content, template renders `<textarea>` with value in HTML |
| CORE-03 | Pad content auto-saves after brief idle (no save button) | Client-side debounced (400ms) fetch POST to `/api/pads/[slug]` endpoint |
| CORE-04 | Save uses optimistic concurrency (version check prevents silent overwrites) | Integer `version` column, `UPDATE ... WHERE version = ?` pattern, 409 Conflict response |
| CORE-05 | UI uses warm, inviting aesthetic -- soft tones, rounded corners, good typography | CSS custom properties design system with warm palette, system font stack override with sans-serif |
| CORE-06 | Layout is responsive and usable on mobile | CSS container queries / media queries, full-width textarea, collapsible header elements |
| INFRA-01 | SQLite with WAL mode for storage | better-sqlite3 with `db.pragma('journal_mode = WAL')` on connection open |
| INFRA-02 | Single-process server, trivially self-hostable | SvelteKit adapter-node produces standalone Node.js server on port 3000 |
| COLLAB-01 | Last-save-wins mode (default) -- simple save with version check | Version column + conditional UPDATE; UI shows "last-save-wins" mode indicator |
| DASH-01 | Landing page has URL bar for direct pad navigation | Root route (`/`) with address-bar-style input that navigates to `/{slug}` |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.53+ | UI framework | Smallest bundles, compiled reactivity, SSR by default |
| @sveltejs/kit | 2.53+ | Full-stack framework | SSR, file-based routing, form actions, adapter-node |
| @sveltejs/adapter-node | 5.5+ | Production server adapter | Single-process Node.js server, trivially self-hostable |
| better-sqlite3 | 12.6+ | SQLite driver | Synchronous API (no async overhead), fastest Node.js SQLite, WAL mode support |
| vite | 6.x | Build tool | SvelteKit's bundler, HMR in dev, optimized production builds |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.58+ | E2E testing | Verification tests per CONTEXT.md requirement |
| typescript | 5.x | Type safety | All `.ts` files, better-sqlite3 has `@types/better-sqlite3` |
| @types/better-sqlite3 | 7.x | Type definitions | TypeScript support for database layer |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SvelteKit | Next.js / Remix | Larger JS bundles (566KB Next vs 371KB Remix vs ~200KB SvelteKit), React runtime overhead contradicts "text visible before JS" goal |
| better-sqlite3 | Drizzle ORM + better-sqlite3 | ORM adds abstraction; schema is simple enough (1-2 tables) that raw SQL is clearer and avoids dependency |
| Vanilla CSS | Tailwind CSS | Tailwind adds build complexity and learning curve; CSS custom properties achieve the warm design system with zero deps |
| `<textarea>` | contenteditable div | Textarea is a real form element, works without JS, SSR-friendly; contenteditable requires JS to extract value |

**Installation:**
```bash
npx sv create padplus --template minimal --types ts
cd padplus
npm install better-sqlite3
npm install -D @types/better-sqlite3 @sveltejs/adapter-node @playwright/test
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    server/
      db.ts              # Database singleton, WAL setup, migrations
      pads.ts            # Pad CRUD operations (getPad, savePad, createPad)
    components/
      Header.svelte      # Thin header: pad name, save status, home link
      SaveStatus.svelte   # "Saved" / "Saving..." / "Unsaved changes"
      ConflictBanner.svelte  # Stale version warning + overwrite/copy actions
      UrlBar.svelte       # Landing page address-bar-style input
    styles/
      theme.css           # CSS custom properties: colors, spacing, typography
      global.css          # Reset, base styles, responsive defaults
    utils/
      debounce.ts         # Debounce utility for auto-save
  routes/
    +page.svelte          # Landing page (DASH-01)
    +page.server.ts       # Landing page server load (if needed)
    [...slug]/
      +page.svelte        # Pad editor page
      +page.server.ts     # SSR load: fetch pad content from SQLite
    api/
      pads/[...slug]/
        +server.ts        # PUT endpoint for auto-save with version check
  app.html                # HTML shell with CSS custom property defaults
  hooks.server.ts         # Database initialization on server start
static/
  favicon.svg             # PadPlus branding
tests/
  pad-creation.spec.ts    # E2E: navigate to URL, editor appears
  auto-save.spec.ts       # E2E: type, wait, reload, content persists
  conflict.spec.ts        # E2E: stale save shows conflict banner
  landing.spec.ts         # E2E: URL bar navigation works
  responsive.spec.ts      # E2E: mobile viewport layout check
```

### Pattern 1: Server-Side Pad Loading with Auto-Create

**What:** The catch-all route `[...slug]` loads pad content in `+page.server.ts`. If the pad does not exist, it creates an empty one and returns it. The page always renders with content (even if empty string).

**When to use:** Every pad page request.

**Example:**
```typescript
// src/routes/[...slug]/+page.server.ts
import { getPadBySlug, createPad } from '$lib/server/pads';

export async function load({ params }) {
  const slug = params.slug;

  let pad = getPadBySlug(slug);
  if (!pad) {
    pad = createPad(slug);
  }

  return {
    slug: pad.slug,
    content: pad.content,
    version: pad.version
  };
}
```

```svelte
<!-- src/routes/[...slug]/+page.svelte -->
<script lang="ts">
  let { data } = $props();
  // data.content is available immediately from SSR -- no loading state needed
</script>

<textarea value={data.content}></textarea>
```

### Pattern 2: Debounced Auto-Save with Optimistic Concurrency

**What:** On every input event, a debounced function fires after 400ms of idle time. It sends the content + current version to the server. The server checks the version, saves if matching, or returns 409 if stale.

**When to use:** Every keystroke in the editor.

**Example:**
```typescript
// src/lib/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}
```

```typescript
// Auto-save logic in pad page component
async function save(content: string, version: number, slug: string) {
  const res = await fetch(`/api/pads/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, version })
  });

  if (res.ok) {
    const data = await res.json();
    return { status: 'saved', version: data.version };
  } else if (res.status === 409) {
    const data = await res.json();
    return { status: 'conflict', serverContent: data.content, serverVersion: data.version };
  } else {
    return { status: 'error' };
  }
}
```

### Pattern 3: Optimistic Concurrency in SQLite

**What:** Each pad has an integer `version` column starting at 1. On save, the UPDATE includes `WHERE version = :expected_version`. If no rows are updated, the version was stale. The save endpoint returns 409 with the current server content.

**When to use:** Every save operation.

**Example:**
```typescript
// src/lib/server/pads.ts
import db from './db';

export function savePad(slug: string, content: string, expectedVersion: number) {
  const result = db.prepare(`
    UPDATE pads
    SET content = ?, version = version + 1, updated_at = datetime('now')
    WHERE slug = ? AND version = ?
  `).run(content, slug, expectedVersion);

  if (result.changes === 0) {
    // Version mismatch -- return current state for conflict resolution
    const current = db.prepare('SELECT * FROM pads WHERE slug = ?').get(slug);
    return { conflict: true, pad: current };
  }

  const updated = db.prepare('SELECT * FROM pads WHERE slug = ?').get(slug);
  return { conflict: false, pad: updated };
}
```

### Pattern 4: CSS Custom Properties Design System

**What:** A warm color palette defined as CSS custom properties, with automatic light/dark mode via `prefers-color-scheme`. No build-time CSS tools needed.

**When to use:** All styling across the app.

**Example:**
```css
/* src/lib/styles/theme.css */
:root {
  /* Warm palette -- light mode */
  --color-bg: #faf8f5;
  --color-bg-elevated: #ffffff;
  --color-text: #2d2a26;
  --color-text-muted: #8a8279;
  --color-accent: #d4845a;
  --color-accent-hover: #c4744a;
  --color-border: #e8e2da;
  --color-success: #6b9e78;
  --color-warning: #d4a04a;
  --color-error: #c45c5c;

  /* Typography */
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-sm: 14px;
  --font-size-xs: 12px;
  --line-height: 1.6;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 48px;

  /* Shapes */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1c1a17;
    --color-bg-elevated: #2a2723;
    --color-text: #e8e2da;
    --color-text-muted: #9a9189;
    --color-accent: #e09a6e;
    --color-border: #3d3830;
  }
}
```

### Anti-Patterns to Avoid

- **Creating pad on save, not on load:** The pad must exist before the page renders so the textarea has content in SSR HTML. Always create on first GET, not first POST.
- **Using form actions for auto-save:** Form actions require a `<form>` submit. Auto-save should use `fetch()` to a `+server.ts` endpoint for smoother UX without page state disruption.
- **Storing the database file inside the build directory:** The `build/` dir is regenerated on each build. Store the SQLite file in a configurable data directory (e.g., `./data/padplus.db`).
- **Blocking SSR on database creation:** The database singleton should be initialized once (in `hooks.server.ts` or on first import), not on every request.
- **Polling for changes:** CONTEXT.md explicitly says stale detection happens on save only, not periodic polling. Do not add polling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce | Custom debounce with edge cases | Simple `setTimeout`/`clearTimeout` wrapper (see pattern above) | The utility is ~8 lines; a library is overkill, but do extract it as a reusable function |
| SQLite migrations | Custom migration runner | Simple version-check in `db.ts` using `PRAGMA user_version` | SQLite has a built-in integer you can read/write for schema version; use it with sequential `if` blocks |
| Dark mode detection | Manual `matchMedia` + localStorage | CSS `prefers-color-scheme` media query only | CONTEXT.md says "follows system preference" -- pure CSS handles this, no JS needed for Phase 1 |
| Form validation | Custom URL slug validator | SvelteKit route params + simple regex | The catch-all route handles any path; just sanitize for SQLite safety |
| Clipboard API | Custom clipboard handling | `navigator.clipboard.writeText()` | For the "copy your version" conflict resolution action; the API is Baseline since 2020 |

**Key insight:** This phase is deliberately simple infrastructure. The complexity is in getting the patterns right (SSR rendering, auto-save flow, conflict UX), not in the individual pieces. Resist adding libraries for problems that are a few lines of code.

## Common Pitfalls

### Pitfall 1: Textarea Value Not in SSR HTML
**What goes wrong:** The textarea renders empty on first paint, then fills in after hydration -- causing a visible flash.
**Why it happens:** Using `bind:value` with a reactive state variable instead of setting the initial value in the HTML.
**How to avoid:** Set the `value` attribute on the `<textarea>` directly from the server-loaded data in the template. SvelteKit SSR will render it into the HTML string.
**Warning signs:** Content appears after a brief blank flash; View Source shows empty textarea.

### Pitfall 2: Auto-Save Fires During SSR
**What goes wrong:** The debounced save function runs on the server during SSR, causing errors or duplicate saves.
**Why it happens:** Not guarding client-only code in SvelteKit components.
**How to avoid:** Use `$effect` (Svelte 5) for the auto-save setup, which only runs in the browser. Or check `browser` from `$app/environment`.
**Warning signs:** Server logs show save attempts during page render.

### Pitfall 3: Catch-All Route Catches Static Assets
**What goes wrong:** Requests for `/favicon.ico`, `/_app/...`, or other SvelteKit internal routes hit the pad route and create junk pads.
**Why it happens:** The `[...slug]` route matches everything.
**How to avoid:** SvelteKit serves `static/` files and `_app/` assets before route matching, so those are fine. But add slug validation in the load function to reject slugs starting with `_` or `api`, or containing file extensions like `.ico`, `.js`, `.css`.
**Warning signs:** Database fills with pads named `favicon.ico` or `robots.txt`.

### Pitfall 4: SQLite Database Locked Errors
**What goes wrong:** Concurrent requests fail with "database is locked" errors.
**Why it happens:** Not enabling WAL mode, or opening multiple database connections.
**How to avoid:** Enable WAL mode immediately after opening the connection (`db.pragma('journal_mode = WAL')`). Use a single database instance (singleton pattern). better-sqlite3 is synchronous and handles concurrency within a single process well with WAL.
**Warning signs:** Intermittent 500 errors under concurrent save load.

### Pitfall 5: Version Mismatch on Self-Conflict
**What goes wrong:** User's own rapid saves trigger false conflict warnings.
**Why it happens:** Auto-save sends version N, server increments to N+1, but the next debounced save still has version N because the response has not returned yet.
**How to avoid:** After a successful save, update the client-side version number from the response BEFORE the next save can fire. The debounce timer ensures a gap between saves. Track an `isSaving` flag to prevent overlapping requests.
**Warning signs:** User sees conflict banner when they are the only editor.

### Pitfall 6: Slug Injection / Path Traversal
**What goes wrong:** Malicious slug values like `../../etc/passwd` or SQL-special characters cause unexpected behavior.
**Why it happens:** No input sanitization on the URL path.
**How to avoid:** Normalize the slug (trim slashes, lowercase, restrict to alphanumeric + hyphens + slashes). Use parameterized queries (better-sqlite3 does this by default with `?` placeholders).
**Warning signs:** Pads with unusual names in the database; 500 errors on certain URLs.

## Code Examples

### Database Singleton with WAL and Migrations

```typescript
// src/lib/server/db.ts
import Database from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'padplus.db');

// Ensure data directory exists
import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Recommended: synchronous NORMAL is safe with WAL and faster than FULL
db.pragma('synchronous = NORMAL');

// Schema migrations using built-in user_version pragma
const currentVersion = db.pragma('user_version', { simple: true }) as number;

if (currentVersion < 1) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      collaboration_mode TEXT NOT NULL DEFAULT 'last-save-wins',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pads_slug ON pads(slug);
  `);
  db.pragma('user_version = 1');
}

export default db;
```

### API Endpoint for Auto-Save

```typescript
// src/routes/api/pads/[...slug]/+server.ts
import { json, error } from '@sveltejs/kit';
import { getPadBySlug, savePad } from '$lib/server/pads';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug) throw error(400, 'Slug is required');

  const body = await request.json();
  const { content, version } = body;

  if (typeof content !== 'string') throw error(400, 'Content must be a string');
  if (typeof version !== 'number') throw error(400, 'Version must be a number');

  const result = savePad(slug, content, version);

  if (result.conflict) {
    return json({
      error: 'conflict',
      message: 'Pad was modified since your last load',
      content: result.pad.content,
      version: result.pad.version
    }, { status: 409 });
  }

  return json({
    version: result.pad.version,
    updatedAt: result.pad.updated_at
  });
};
```

### Landing Page URL Bar

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';

  let slug = $state('');

  function navigate() {
    const trimmed = slug.trim().replace(/^\/+|\/+$/g, '');
    if (trimmed) {
      goto(`/${trimmed}`);
    }
  }
</script>

<main class="landing">
  <h1 class="brand">PadPlus</h1>
  <p class="tagline">Type a name, start writing</p>

  <form class="url-bar" onsubmit={(e) => { e.preventDefault(); navigate(); }}>
    <span class="url-prefix">padplus/</span>
    <input
      type="text"
      bind:value={slug}
      placeholder="meeting-notes"
      class="url-input"
      autofocus
    />
    <button type="submit" class="go-button">Go</button>
  </form>
</main>
```

### Conflict Banner Component

```svelte
<!-- src/lib/components/ConflictBanner.svelte -->
<script lang="ts">
  type Props = {
    serverContent: string;
    onOverwrite: () => void;
    onCopyAndReload: () => void;
  };

  let { serverContent, onOverwrite, onCopyAndReload }: Props = $props();
</script>

<div class="conflict-banner" role="alert">
  <p class="conflict-message">
    This pad was modified by someone else since you started editing.
  </p>
  <div class="conflict-actions">
    <button class="btn-secondary" onclick={onCopyAndReload}>
      Copy my version & reload
    </button>
    <button class="btn-danger" onclick={onOverwrite}>
      Overwrite with my version
    </button>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 `export let` props | Svelte 5 `$props()` runes | Oct 2024 | All components use runes syntax, not legacy `export let` |
| Svelte 4 `$:` reactive | Svelte 5 `$derived` / `$effect` | Oct 2024 | Reactive statements use explicit runes |
| SvelteKit 1 `load` typing | SvelteKit 2 auto-generated types | Dec 2023 | Import types from `./$types` for full type safety |
| `on:click` event syntax | Svelte 5 `onclick` attribute | Oct 2024 | Use lowercase event attributes, not `on:` directive |
| `<textarea bind:value>` | `<textarea bind:value>` still works | Current | bind:value is still the standard for two-way textarea binding in Svelte 5 |
| contenteditable plaintext-only | Now Baseline (March 2025) | March 2025 | Alternative to textarea, but textarea is simpler for this use case |
| Custom auto-resize JS | CSS `field-sizing: content` | Chrome 119+, ~71% support | NOT yet Baseline; use JS fallback or fixed-height textarea for Phase 1 |

**Deprecated/outdated:**
- Svelte 4 `export let` syntax: Still works in Svelte 5 (backward compatible) but all new code should use `$props()` runes
- SvelteKit `on:submit|preventDefault`: Use `onsubmit` with `e.preventDefault()` in Svelte 5
- `@sveltejs/adapter-auto`: Do not use for self-hosted; use `adapter-node` explicitly

## Open Questions

1. **Diff display in conflict banner**
   - What we know: CONTEXT.md says "shows what changed (diff or summary)"
   - What's unclear: Whether to show a line-by-line diff or a simple "content differs" message
   - Recommendation: Start with a simple side-by-side or "your version vs server version" text comparison. A full diff library (like `diff`) is small (~4KB) and could be added, but a simple approach may be sufficient for Phase 1. Claude's discretion per CONTEXT.md.

2. **Textarea vs full-height approach**
   - What we know: Editor should be "full width with comfortable padding" and dominate the page
   - What's unclear: Whether the textarea should fill the viewport height (minus header) or grow with content
   - Recommendation: Use `height: calc(100vh - header-height)` for the textarea to fill the viewport. This avoids the `field-sizing` browser support issue and matches the "distraction-free" feel. Content scrolls within the textarea.

3. **Nested slug paths**
   - What we know: `[...slug]` catches paths like `/meeting/2024/january` as a single slug string `meeting/2024/january`
   - What's unclear: Whether to support nested paths or flatten to a single segment
   - Recommendation: Support nested paths -- store the full path as the slug. This matches "URL IS the sharing mechanism" and allows implicit hierarchy per the Out of Scope section.

## Sources

### Primary (HIGH confidence)
- SvelteKit official docs (svelte.dev/docs/kit) - routing, project structure, form actions, adapter-node
- better-sqlite3 GitHub (WiseLibs/better-sqlite3) - API, WAL mode, performance
- npm registry - verified versions: svelte 5.53.7, @sveltejs/kit 2.53.4, better-sqlite3 12.6.2, @sveltejs/adapter-node 5.5.4, @playwright/test 1.58.2

### Secondary (MEDIUM confidence)
- [SvelteKit vs Next.js vs Remix comparison](https://www.nxcode.io/resources/news/nextjs-vs-remix-vs-sveltekit-2025-comparison) - bundle size comparisons
- [contenteditable plaintext-only Baseline](https://web.dev/blog/contenteditable-plaintext-only-baseline) - March 2025 browser support
- [CSS field-sizing MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing) - browser support status
- [Optimistic concurrency guide](https://www.shadecoder.com/topics/optimistic-concurrency-control-a-practical-guide-for-2025) - version column pattern
- [SvelteKit SQLite integration patterns](https://scottspence.com/posts/local-analytics-with-sqlite-and-sveltekit) - server-only database access

### Tertiary (LOW confidence)
- Color palette recommendations from design trend articles - specific hex values are Claude's discretion, will be refined during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified versions on npm, confirmed SvelteKit SSR capability from official docs
- Architecture: HIGH - patterns derived from official SvelteKit docs (routing, form actions, project structure) and better-sqlite3 documented API
- Pitfalls: HIGH - common SvelteKit SSR issues well-documented in community discussions; SQLite WAL mode behavior from official better-sqlite3 docs
- Color palette: MEDIUM - based on 2025 design trends; specific values are Claude's discretion

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable stack, 30-day validity)
