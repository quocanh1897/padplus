# Technology Stack

**Project:** PadPlus
**Researched:** 2026-03-07
**Overall Confidence:** MEDIUM-HIGH

## Design Philosophy

PadPlus is a speed-first collaborative notepad. Every stack decision flows from one constraint: **text must appear before JavaScript loads**. This means server-rendered HTML, minimal client JS, and progressive enhancement. The editor starts as a plain `<textarea>` served inline with the HTML -- CodeMirror upgrades it after JS hydrates.

## Recommended Stack

### Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 22.x LTS (22.22.1) | Server runtime | LTS through April 2027. Rock-solid stability for a self-hosted tool that needs to run unattended. Bun is faster in benchmarks but Node 22 is the safe production choice for a "set and forget" server. | HIGH |

**Rationale:** Bun is tempting (built-in SQLite, faster cold starts) but Node 22 LTS is the right call for a self-hosted tool deployed to someone's server and forgotten for months. Node's ecosystem compatibility, predictable behavior, and LTS support timeline matter more than raw throughput for an internal notepad. If the team wants to experiment with Bun later, Hono runs on both runtimes unchanged.

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Hono | ~4.12 | HTTP framework + SSR | Fastest lightweight framework with built-in JSX SSR, streaming HTML support via `renderToReadableStream`, and WebSocket helpers. Runs on Node, Bun, Deno unchanged. 3-5x faster than Express for raw routing. | HIGH |
| @hono/node-server | ~1.14 | Node.js HTTP adapter | Official adapter to run Hono on Node.js. Required for production Node deployment. | HIGH |
| @hono/node-ws | ~1.3 | WebSocket support | Official Hono adapter for WebSocket on Node.js using `ws` under the hood. Needed for real-time collaboration mode. | HIGH |

**Why Hono over Fastify:** Fastify wins on raw throughput (70-80k vs ~25k req/s in hello-world benchmarks), but Hono has built-in JSX SSR with streaming -- exactly what PadPlus needs for "text before JS". With Fastify you'd need to bolt on a template engine. Hono's JSX middleware renders HTML server-side with `Suspense` for streaming, which means we can flush the `<textarea>` with pad content while the page shell is still rendering. Hono also has a built-in `upgradeWebSocket()` helper that integrates cleanly with its routing.

**Why Hono over Express:** Express handles 20-30k req/s vs Hono's ~25k. Express has no built-in JSX, no streaming HTML, no WebSocket helpers. Express is legacy tooling at this point.

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| better-sqlite3 | ~12.6 | SQLite driver | Synchronous, zero-config, fastest Node.js SQLite driver. Single-file database aligns perfectly with self-hosted simplicity. No connection pooling, no ORM overhead -- just fast reads. | HIGH |
| drizzle-orm | ~0.45 | SQL query builder | Lightweight, type-safe SQL layer over better-sqlite3. Zero runtime overhead beyond what you'd write by hand. Handles migrations via drizzle-kit. Not a heavy ORM -- it generates SQL you can read. | MEDIUM |
| drizzle-kit | latest | Schema migrations | Generates and runs SQLite migrations from Drizzle schema definitions. | MEDIUM |

**Why better-sqlite3 over Bun's built-in SQLite:** We're targeting Node.js LTS. better-sqlite3 is the standard synchronous SQLite driver for Node with 12+ years of production use. If the team migrates to Bun later, swapping the driver is a one-file change behind Drizzle's abstraction layer.

**Why Drizzle over raw SQL:** Drizzle adds type safety and migration management with near-zero runtime cost. It generates readable SQL -- you can always eject. For a small project, raw SQL with better-sqlite3 is also fine, but Drizzle's schema-as-code prevents drift as the app grows.

**Why NOT Prisma:** Prisma generates a query engine binary, adds cold-start latency, and is overkill for a single-table notepad. Drizzle is 10-50x lighter.

### Collaboration Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Yjs | ~13.6 | CRDT for real-time + auto-merge | Industry standard CRDT library. Powers Google Docs-level collaboration. 900k+ weekly npm downloads. Handles the "auto-merge" and "real-time" collaboration modes. | HIGH |
| y-websocket | latest | WebSocket provider for Yjs | Official Yjs WebSocket transport. Connects client Yjs docs to server for real-time sync. | HIGH |
| diff-match-patch | ~1.0 | Auto-merge fallback | Google's battle-tested diff/merge library. Used for the "auto-merge" mode when Yjs is overkill (simple 3-way merge of text saves). | MEDIUM |

**Three collaboration modes, mapped to tech:**

1. **Last-save-wins (default):** No special library. Plain HTTP POST overwrites the stored text. Simplest, fastest, covers 80% of use cases.
2. **Auto-merge:** When two users edit the same pad offline, use diff-match-patch to 3-way merge their changes on save. Server stores the base version; each save diffs against base and patches. No WebSocket needed.
3. **Real-time:** Yjs CRDT synced over WebSocket via y-websocket. Full character-by-character collaboration with cursor awareness. Only loaded when user opts into this mode.

**Why NOT Hocuspocus:** Hocuspocus (@hocuspocus/server ~3.4) is a production-ready Yjs WebSocket backend, but it's opinionated toward Tiptap/ProseMirror rich-text editors. PadPlus is a plain text notepad. Wiring Yjs directly to y-websocket with a custom persistence layer (saving Yjs updates to SQLite) is simpler and avoids pulling in Tiptap's ecosystem.

### Editor (Client-Side)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Native `<textarea>` | N/A | Initial editor (pre-JS) | Zero JS, instant render. Text appears in the HTML payload before any scripts load. The speed-first foundation. | HIGH |
| CodeMirror 6 | ~6.0 (codemirror meta-package) | Enhanced editor (post-JS) | Progressively enhances the textarea after JS loads. Lightweight (124KB gzipped for full setup), excellent keyboard handling, built-in markdown mode. | MEDIUM |
| y-codemirror.next | ~0.3.5 | Yjs + CodeMirror binding | Bridges Yjs CRDT to CodeMirror for real-time cursor sync and collaborative editing. Only loaded in real-time mode. | MEDIUM |

**Progressive Enhancement Strategy:**
1. Server renders `<textarea>` with pad content inline in HTML
2. Browser paints text immediately (no JS required)
3. Client JS loads, replaces textarea with CodeMirror
4. If real-time mode, initializes Yjs + y-codemirror.next

**Why CodeMirror 6 over Monaco:** Monaco is 2MB+. CodeMirror 6 is ~124KB. For a notepad (not an IDE), CodeMirror is the right weight class. It also has first-class Yjs integration via y-codemirror.next.

**Why CodeMirror over just textarea forever:** Textarea works for basic editing, but lacks markdown syntax highlighting, proper tab handling, and Yjs integration for real-time mode. CodeMirror adds these while remaining lightweight.

### Markdown Rendering

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| marked | ~17.0 | Markdown to HTML | Fastest mainstream markdown parser. 11k+ dependents. Simple API: `marked.parse(text)` returns HTML. Used for the toggle markdown preview feature. | HIGH |

**Why marked over markdown-it:** marked is faster for simple parsing. markdown-it is more extensible with its plugin system, but PadPlus needs basic markdown rendering, not a plugin ecosystem. marked's simplicity matches the project's philosophy.

**Why NOT unified/remark:** Powerful AST manipulation is unnecessary. PadPlus just needs `text -> HTML`. unified adds complexity without benefit here.

### Image Processing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| sharp | ~0.34 | Image resize/compress on upload | Fastest Node.js image processing (libvips-powered). Resizes pasted images before saving to disk. Generates thumbnails for lazy loading. | HIGH |

**Image Upload Flow:**
1. User pastes image in editor
2. Client sends image as multipart form data (Hono handles `c.req.parseBody()` natively -- no multer needed)
3. Server processes with sharp (resize, compress to WebP)
4. Saves to local filesystem at `/data/images/{padId}/{hash}.webp`
5. Returns URL that editor inserts as markdown image or inline `<img>`

**Why NOT multer:** Multer is Express middleware, incompatible with Hono. Hono has built-in multipart parsing via `c.req.parseBody()`. No additional upload middleware needed.

### Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | ~4.2 | Utility-first CSS | Purged production bundles under 10KB. v4 builds are 5x faster than v3. Utility classes make it easy to achieve the "warm, inviting" aesthetic (rounded corners, soft colors) without writing custom CSS files. | MEDIUM |

**Why Tailwind over vanilla CSS:** For a team project, Tailwind's utility classes are self-documenting in the HTML. The purged output is smaller than hand-written CSS for most projects. Tailwind v4's CSS-first config (no `tailwind.config.js`) simplifies setup.

**Why NOT CSS-in-JS:** Runtime overhead contradicts the speed-first philosophy. Tailwind has zero runtime.

### Build Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vite | ~7.3 | Frontend bundler + dev server | Fastest dev server with HMR. Bundles client JS (CodeMirror, Yjs) for production. Vite 7/8 uses Rolldown for 2x faster builds. | HIGH |
| TypeScript | ~5.7 | Type safety | Type-checked server and client code. Hono, Drizzle, and CodeMirror all have excellent TS support. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ws | ~8.19 | WebSocket server | Under the hood of @hono/node-ws. Peer dependency. |
| nanoid | ~5.x | Short unique IDs | Generating image filenames, pad identifiers if needed. Faster than uuid, shorter output. |
| zod | ~3.x | Runtime validation | Validating pad content on save, image upload metadata. Pairs with Hono's validator middleware. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime | Node.js 22 LTS | Bun 1.2+ | Bun is faster but less battle-tested for long-running self-hosted servers. Hono abstracts the runtime, so migration is trivial later. |
| Framework | Hono | Fastify | Fastify lacks built-in JSX SSR and streaming HTML. Would need Handlebars/EJS + manual streaming setup. |
| Framework | Hono | Express | Legacy. Slower. No built-in features PadPlus needs. |
| Database driver | better-sqlite3 | Bun:sqlite | Tied to Bun runtime. better-sqlite3 works everywhere. |
| ORM | Drizzle | Prisma | Prisma's query engine binary adds cold-start latency and deployment complexity. Overkill for SQLite. |
| ORM | Drizzle | Raw SQL | Acceptable for MVP, but schema migrations become painful without tooling. |
| Editor | CodeMirror 6 | Monaco | 2MB+ bundle. Designed for IDEs, not notepads. |
| Editor | CodeMirror 6 | Textarea only | No syntax highlighting, no Yjs binding, no proper keyboard handling. |
| CRDT | Yjs | Automerge | Yjs is faster, smaller, has better editor integrations. Automerge is heavier, designed for document-level sync. |
| Yjs backend | Custom y-websocket | Hocuspocus | Hocuspocus is Tiptap-opinionated. Direct y-websocket integration is simpler for plain text. |
| Markdown | marked | markdown-it | markdown-it's plugin system adds unnecessary complexity. |
| Markdown | marked | unified/remark | AST manipulation is overkill for `text -> HTML`. |
| CSS | Tailwind v4 | Vanilla CSS | Tailwind's purged output is smaller and utility classes are faster to write for the warm/inviting UI. |
| Image processing | sharp | Jimp | sharp is 10-50x faster than Jimp (native libvips vs pure JS). |
| Bundler | Vite 7 | esbuild directly | Vite wraps esbuild/rolldown with HMR, HTML handling, and better DX. |

## Architecture Implications

```
Browser Request
    |
    v
[Hono Server] -- JSX SSR --> HTML with <textarea> (text appears instantly)
    |
    +-- [better-sqlite3] --> Read pad content
    +-- [sharp] --> Process uploaded images
    +-- [ws / @hono/node-ws] --> WebSocket for real-time mode
    |
Browser (after JS loads)
    |
    v
[CodeMirror 6] -- replaces textarea
    |
    +-- (last-save-wins) --> Plain HTTP POST
    +-- (auto-merge) --> diff-match-patch on server
    +-- (real-time) --> Yjs + y-websocket + y-codemirror.next
```

## Installation

```bash
# Core server
npm install hono @hono/node-server @hono/node-ws

# Database
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3

# Collaboration
npm install yjs y-websocket diff-match-patch

# Editor (client-side, bundled by Vite)
npm install codemirror @codemirror/lang-markdown @codemirror/theme-one-dark y-codemirror.next

# Markdown
npm install marked

# Image processing
npm install sharp

# Styling
npm install -D tailwindcss @tailwindcss/vite

# Utilities
npm install nanoid zod

# Build tooling
npm install -D vite typescript @types/node

# WebSocket (peer dependency)
npm install ws
npm install -D @types/ws
```

## Version Verification Notes

| Package | Verified Version | Source | Date Checked |
|---------|-----------------|--------|--------------|
| hono | 4.12.5 | npm registry | 2026-03-07 |
| better-sqlite3 | 12.6.2 | npm registry | 2026-03-07 |
| yjs | 13.6.29 | npm registry | 2026-03-07 |
| drizzle-orm | 0.45.1 | npm registry | 2026-03-07 |
| marked | 17.0.4 | npm registry | 2026-03-07 |
| sharp | 0.34.5 | npm registry | 2026-03-07 |
| tailwindcss | 4.2.1 | npm registry | 2026-03-07 |
| vite | 7.3.1 | npm registry | 2026-03-07 |
| codemirror | 6.0.2 | npm registry | 2026-03-07 |
| @codemirror/view | 6.38.8 | npm registry | 2026-03-07 |
| y-codemirror.next | 0.3.5 | npm registry | 2026-03-07 |
| @hono/node-ws | 1.3.0 | npm registry | 2026-03-07 |
| @hocuspocus/server | 3.4.4 | npm registry (not recommended) | 2026-03-07 |
| ws | 8.19.0 | npm registry | 2026-03-07 |
| Node.js | 22.22.1 | nodejs.org | 2026-03-07 |

## Sources

- [Hono official docs - JSX SSR](https://hono.dev/docs/guides/jsx) (HIGH confidence)
- [Hono official docs - WebSocket Helper](https://hono.dev/docs/helpers/websocket) (HIGH confidence)
- [Hono official docs - Streaming Helper](https://hono.dev/docs/helpers/streaming) (HIGH confidence)
- [Hono + htmx + Cloudflare architecture](https://blog.yusu.ke/hono-htmx-cloudflare/) (MEDIUM confidence)
- [Streaming Dynamic HTML with Hono and JSX](https://pmil.me/en/posts/streaming-dynamic-html-with-hono) (MEDIUM confidence)
- [Yjs documentation](https://docs.yjs.dev/) (HIGH confidence)
- [y-websocket docs](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket) (HIGH confidence)
- [y-codemirror.next GitHub](https://github.com/yjs/y-codemirror.next) (HIGH confidence)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) (HIGH confidence)
- [Drizzle ORM SQLite docs](https://orm.drizzle.team/docs/get-started-sqlite) (HIGH confidence)
- [marked documentation](https://marked.js.org/) (HIGH confidence)
- [sharp documentation](https://sharp.pixelplumbing.com/) (HIGH confidence)
- [Tailwind CSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) (HIGH confidence)
- [Vite 8 Beta with Rolldown](https://vite.dev/blog/announcing-vite8-beta) (MEDIUM confidence)
- [CodeMirror 6 bundle size discussion](https://github.com/codemirror/codemirror.next/issues/760) (MEDIUM confidence)
- [Fastify benchmarks](https://fastify.dev/benchmarks/) (HIGH confidence)
- [SSE vs WebSockets comparison](https://dev.to/polliog/server-sent-events-beat-websockets-for-95-of-real-time-apps-heres-why-a4l) (MEDIUM confidence)
- [Bun production readiness 2026](https://dev.to/last9/is-bun-production-ready-in-2026-a-practical-assessment-181h) (MEDIUM confidence)
- [Node.js 22.22.1 LTS release](https://nodejs.org/en/blog/release/v22.22.0) (HIGH confidence)
- [diff-match-patch on npm](https://www.npmjs.com/package/diff-match-patch) (HIGH confidence)
- [Hono file upload handling](https://hono.dev/examples/file-upload) (HIGH confidence)
- [npm-compare: markdown parsers](https://npm-compare.com/markdown-it,marked,remark,remark-parse,unified) (MEDIUM confidence)
