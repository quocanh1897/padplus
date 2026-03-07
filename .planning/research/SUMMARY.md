# Project Research Summary

**Project:** PadPlus
**Domain:** Self-hosted collaborative notepad (Etherpad/Dontpad alternative)
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

PadPlus is a speed-first self-hosted collaborative notepad built around a single non-negotiable constraint: text must appear before JavaScript loads. Research confirms this positions PadPlus in a genuine market gap -- no existing competitor combines URL-based instant access, image paste, self-hosted simplicity, and fast load times. The recommended approach is a single-process monolith (Hono + Node.js 22 LTS + SQLite) with a progressive enhancement strategy: serve text as a plain `<textarea>` in SSR HTML, then hydrate CodeMirror after JS loads. Collaboration is delivered in phases, starting with last-save-wins (simplest, default) and progressively adding auto-merge and real-time WebSocket modes. This leads-with-speed philosophy inverts the typical collaborative editor approach, where real-time is built first at the cost of everything else.

The most critical architectural decision is to treat the three collaboration modes as three separate milestones, not a single feature. Research and real-world precedent (CKEditor 5, Etherpad) confirm that last-save-wins, auto-merge, and real-time have fundamentally different infrastructure requirements. Building a unified abstraction layer before any mode works is a proven path to months of delay. The recommended path: ship last-save-wins in Phase 1, add auto-merge in Phase 3, and defer real-time to Phase 4. Image paste is the primary feature differentiator and should ship in Phase 2 alongside the markdown toggle and dashboard.

Key risks are concentrated in two areas: security (XSS via markdown rendering, disk exhaustion from unrestricted image uploads, path traversal via URL slugs) and data integrity (silent content loss from last-save-wins without version checks, SQLite write contention from misconfigured pragmas). Both categories are preventable with known patterns that must be applied in the same phase they are introduced -- not retrofitted. The research is high-confidence across all four domains, with the sole notable uncertainty being the degree to which Yjs document compaction complicates the real-time phase.

## Key Findings

### Recommended Stack

PadPlus's stack is unified around minimalism and the speed-first constraint. Hono (~4.12) on Node.js 22 LTS is the framework of choice: it provides built-in JSX SSR with streaming HTML (essential for text-first rendering), native WebSocket upgrade helpers, and runs unchanged on Bun if the team migrates later. better-sqlite3 (~12.6) handles persistence synchronously with zero configuration overhead; Drizzle ORM (~0.45) adds type-safe schema management without Prisma's binary engine weight. For collaboration, Yjs (~13.6) + y-websocket is the industry-standard CRDT stack, but only loaded in real-time mode via dynamic import. Client-side, CodeMirror 6 (~124KB gzipped) progressively replaces the SSR-rendered textarea, with y-codemirror.next binding Yjs to the editor for real-time mode only. Tailwind v4 produces sub-10KB CSS with zero runtime overhead. Vite 7 bundles the client.

See `.planning/research/STACK.md` for full version table, rationale, and alternatives considered.

**Core technologies:**
- Node.js 22.22.1 LTS: server runtime -- LTS through April 2027, safe for a "set and forget" self-hosted deployment
- Hono 4.12.5: HTTP framework -- built-in JSX SSR + streaming HTML + WebSocket helpers, essential for text-first architecture
- better-sqlite3 12.6.2: SQLite driver -- synchronous, zero-config, fastest Node SQLite driver; single-file DB aligns with self-hosted simplicity
- Drizzle ORM 0.45.1: query builder -- lightweight type-safe SQL layer, near-zero runtime overhead, handles migrations
- Yjs 13.6.29: CRDT library -- industry standard, powers real-time and auto-merge modes; loaded dynamically only when needed
- CodeMirror 6.0.2: enhanced editor -- progressively replaces textarea post-hydration; 124KB gzipped vs Monaco's 2MB+
- marked 17.0.4: markdown renderer -- fastest simple parser; no plugin ecosystem needed
- sharp 0.34.5: image processing -- libvips-powered, 10-50x faster than Jimp; resizes/compresses pasted images server-side
- Tailwind CSS 4.2.1: styling -- sub-10KB purged output, zero runtime, v4 CSS-first config
- Vite 7.3.1: bundler -- fastest dev DX, Rolldown-powered production builds

### Expected Features

Research confirms PadPlus occupies a genuine gap: no competitor delivers URL-based instant access + image paste + self-hosted simplicity + fast load simultaneously. The feature set is well-defined and bounded.

See `.planning/research/FEATURES.md` for competitor matrix and dependency graph.

**Must have (table stakes):**
- URL-based pad access (`/any-path` just works) -- the core interaction model; everything else depends on it
- Instant text loading via SSR -- the primary reason this project exists; must ship in v1
- Auto-save with last-save-wins (+ version check to prevent silent data loss) -- baseline collaboration
- Mobile-responsive, clean warm UI -- non-negotiable for adoption
- Basic text editing -- plain textarea, no WYSIWYG

**Should have (differentiators):**
- Image paste from clipboard -- the single largest feature gap vs. all competitors; Etherpad's plugin is 5+ years abandoned
- Markdown toggle (per-pad, opt-in) -- differentiates from plain-text-only tools without forcing markdown on everyone
- Dashboard with recent pads -- basic discoverability; Dontpad has none
- Three collaboration modes -- unique; no competitor offers user-selectable sync strategy per pad

**Defer to v2+:**
- Auto-merge mode -- meaningful upgrade but last-save-wins covers small teams
- Real-time collaboration (WebSocket + Yjs) -- highest complexity, should be Phase 4 after core is solid
- Version history -- explicitly out of scope for v1; significant storage and UI complexity

**Never build:**
- User accounts / auth, end-to-end encryption, WYSIWYG/rich text, plugins, offline/PWA, comments, AI features

### Architecture Approach

The architecture is a deliberate single-process monolith: one Node.js process handles HTTP, WebSocket, and static file serving. SQLite stores pad content and metadata; local filesystem stores images. No microservices, no external dependencies, no message queues. This matches the self-hosted constraint (single `docker run` deployment) and the target scale of 1-50 concurrent users. The critical architectural pattern is dual storage for real-time pads: both a Yjs binary blob (for CRDT sync) AND a plain-text snapshot (for SSR) are maintained, ensuring text-first loading works regardless of collaboration mode.

See `.planning/research/ARCHITECTURE.md` for component diagrams, data flow, schema design, and code examples.

**Major components:**
1. Hono Router -- URL routing, middleware, request/response lifecycle; wildcard route catches all pad paths
2. SSR Engine -- renders pad HTML with text content inlined in `<textarea>`; text is readable with zero JS
3. REST API -- CRUD for pads, image upload endpoint, pad settings (mode, markdown toggle)
4. WebSocket Handler + Room Manager -- upgrades connections, tracks active clients per pad, broadcasts Yjs updates
5. Yjs Sync Engine -- applies CRDT updates, manages in-memory Y.Doc per room, persists to SQLite
6. SQLite Store -- pad text, Yjs binary state, image metadata, pad settings; must be configured with WAL mode from day one
7. Image Store -- filesystem writes at `/data/images/:padPath/`, metadata in SQLite, served as static files

**SQLite schema key points:**
- `pads` table: `path` (unique indexed), `content` (plain text for SSR), `mode`, `version` (for optimistic concurrency), `yjs_state` (nullable BLOB for real-time only), `markdown_enabled`
- `images` table: references `pad_id` with CASCADE delete; stores metadata only, not image BLOBs

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full pitfall details, warning signs, and phase-to-pitfall mapping.

1. **Three collaboration modes = three separate products** -- build modes incrementally, one per phase; do not attempt a unified sync abstraction before any mode works; last-save-wins ships first and alone
2. **Silent content loss in last-save-wins** -- add optimistic concurrency control (version check) to the save endpoint in Phase 1; reject saves with stale versions and show a conflict warning; this is 2-4 hours of work that must not be deferred
3. **SQLite misconfiguration causes write contention** -- apply WAL mode, `busy_timeout = 5000`, `synchronous = NORMAL`, and `cache_size = -20000` pragmas on first DB connection; this is a Phase 1 requirement, not a later optimization
4. **Markdown rendering enables XSS** -- sanitize rendered HTML with DOMPurify after conversion (not before); set a strict Content Security Policy; must ship in the same phase as markdown toggle, not as a follow-up
5. **Image paste as disk exhaustion vector** -- enforce per-image size limits (5-10MB), per-pad quotas, and IP-based rate limiting at the same time image paste ships; sharp re-encoding also mitigates image bomb attacks

**Additional security requirements to address per phase:**
- Validate URL slugs against strict allowlist (`^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$`) to prevent path traversal -- Phase 1
- Validate image content-type via magic bytes, not extension; generate random filenames server-side -- Phase with image paste
- Set `Access-Control-Allow-Origin` to own origin only; set request body size limits at both app and reverse proxy -- Phase 1

## Implications for Roadmap

Based on combined research, the feature dependency graph, architecture component order, and pitfall-to-phase mapping all converge on a five-phase structure. The ordering is not arbitrary -- it follows hard dependencies (SSR must exist before any feature uses it), complexity progression (simpler modes before complex ones), and risk mitigation (security controls ship with the feature that creates the risk).

### Phase 1: Foundation -- Working Notepad

**Rationale:** Every other feature depends on HTTP routing, SSR, SQLite, and the basic read/write pad cycle. This is the Dontpad clone phase -- ship something usable before adding any collaboration complexity. Security foundations (slug validation, SQLite pragmas, version checking) must also be laid here because retrofitting them is painful and risky.

**Delivers:** A functional URL-based notepad. Navigate to any path, see text, edit, auto-save. Text appears before JS loads. No collaboration complexity, no images, no markdown.

**Features from FEATURES.md:**
- URL-based pad access
- Instant text loading (SSR)
- Auto-save with last-save-wins + optimistic concurrency (version check)
- Basic text editing
- Mobile-responsive, warm UI (Tailwind v4)

**Architecture components:** Hono Router, SSR Engine, REST API (pad CRUD), SQLite Store (with WAL pragmas), Static File Server, basic client JS (debounced save, version tracking)

**Pitfalls to prevent:**
- SQLite write contention: apply all WAL pragmas at DB initialization
- Silent data loss: implement version check on save endpoint
- Path traversal: validate URL slugs with allowlist regex
- Three-modes trap: implement ONLY last-save-wins; no WebSocket, no Yjs

**Research flag:** Standard, well-documented patterns. No deeper research phase needed. Hono SSR + SQLite + debounced save are all extensively documented.

---

### Phase 2: Rich Editing -- Images, Markdown, Dashboard

**Rationale:** Image paste is the primary differentiator that motivates replacing Etherpad/Dontpad. It belongs in Phase 2 (before collaboration complexity) because it is independent of the collaboration mode infrastructure. Markdown toggle and dashboard complete the "rich editing" surface before tackling WebSocket complexity in later phases. CodeMirror replaces textarea in this phase to enable syntax highlighting and proper keyboard handling.

**Delivers:** Users can paste images, toggle markdown preview, and find recent pads from a dashboard. The editor is CodeMirror rather than a plain textarea.

**Features from FEATURES.md:**
- Image paste from clipboard (THE feature gap)
- Markdown toggle (per-pad, opt-in)
- Dashboard with recent pads
- Progressive CodeMirror enhancement (replaces textarea post-hydration)

**Architecture components:** Image Store (filesystem + SQLite metadata), Upload API, Clipboard paste client JS (intercept paste event, POST multipart), marked + DOMPurify for markdown rendering, dashboard route (recent pads by updated_at DESC)

**Pitfalls to prevent:**
- Image disk exhaustion: per-image size limit (5-10MB), per-pad quota, IP rate limiting, sharp re-encoding
- Image content-type abuse: validate magic bytes, generate random filenames, serve with explicit Content-Type
- Markdown XSS: DOMPurify sanitization after marked conversion + CSP header -- must ship with markdown feature

**Stack elements used:** CodeMirror 6 (client bundle via Vite), marked 17.0.4, sharp 0.34.5, nanoid (image filenames)

**Research flag:** Standard patterns for image upload and markdown rendering. DOMPurify + CSP is well-documented. No deeper research needed. However, the clipboard paste API has browser compatibility nuances worth verifying during implementation (especially mobile browsers).

---

### Phase 3: Auto-Merge Collaboration

**Rationale:** Auto-merge is the bridge between last-save-wins simplicity and full real-time complexity. It addresses the "two people editing different sections simultaneously" case without requiring WebSocket infrastructure. Building it before real-time establishes the version/conflict infrastructure and mode-switching UI that real-time will extend. diff-match-patch is a battle-tested library with no Yjs learning curve.

**Delivers:** Two users can edit different sections of the same pad simultaneously without losing each other's work. The server performs three-way text merge on conflicting saves. Users see the merged result.

**Features from FEATURES.md:**
- Auto-merge collaboration mode (per-pad setting)
- Mode selector UI (which mode is this pad using?)
- Conflict resolution UI (show merged result, option to reload)

**Architecture components:** Collaboration Mode Controller, three-way merge logic on the REST API (diff-match-patch), version increment on merge, mode selector stored in pads.mode

**Stack elements used:** diff-match-patch (~10KB), extended REST API, mode indicator UI

**Pitfalls to prevent:**
- CRDT complexity trap: use diff-match-patch (simple 3-way string merge), NOT Yjs, for auto-merge; Yjs is overkill here
- Mode abstraction trap: implement auto-merge as a concrete strategy, not a premature generic abstraction

**Research flag:** Consider a spike/prototype before committing to the merge algorithm. Matthew Weidner's 2025 research on "text without CRDTs" is directly applicable here and worth reviewing at phase start. The three-way merge edge cases (overlapping edits in same line) need explicit test cases.

---

### Phase 4: Real-Time Collaboration

**Rationale:** Real-time is the highest-complexity phase -- WebSocket connections, Yjs CRDT, room management, cursor presence, reconnection handling. It belongs last because it requires the full infrastructure from Phases 1-3: SSR (for text-first loading even in real-time mode), the image store, the mode controller, and a solid understanding of the collaboration UX from auto-merge. Building it last means the simpler modes are battle-tested first.

**Delivers:** Full character-by-character real-time collaboration with cursor awareness. Multiple users can edit simultaneously and see each other's cursors. WebSocket connection with automatic reconnection and edit replay.

**Features from FEATURES.md:**
- Real-time collaboration mode (WebSocket + Yjs)
- Cursor/presence awareness
- WebSocket reconnection with queued edits

**Architecture components:** WebSocket Handler, Room Manager (in-memory Map of Y.Doc + client Set per pad), Yjs Sync Engine (apply/broadcast updates, periodic compaction), dual storage (Yjs binary + plain text snapshot), y-codemirror.next client binding

**Stack elements used:** Yjs 13.6.29, y-websocket, @hono/node-ws 1.3.0, ws 8.19.0, y-codemirror.next 0.3.5 (dynamic import)

**Pitfalls to prevent:**
- Yjs document bloat: implement periodic compaction (serialize current state to fresh Y.Doc, discard history) from day one
- WebSocket reconnection data loss: queue edits made during disconnect, replay on reconnect
- Memory leak from idle rooms: evict rooms after a timeout (e.g., 30 minutes of inactivity), persist state before eviction
- Dead connections: implement 30-second ping/pong heartbeat, close after 3 missed pongs
- Dual storage desync: ensure every Yjs state persist also writes the plain-text snapshot (essential for SSR correctness)

**Research flag:** This phase needs a deeper research spike before planning. Yjs + y-websocket integration with custom SQLite persistence (not using Hocuspocus) is less documented than the standard Hocuspocus path. Plan for a 1-2 day spike to validate the Yjs persistence pattern, document size management strategy, and reconnection behavior.

---

### Phase 5: Polish and Production Readiness

**Rationale:** With all features implemented and functioning, Phase 5 addresses production hardening, UX refinements, and operational concerns that emerge from real usage. This is not an afterthought -- it ensures PadPlus is actually deployable and maintainable long-term.

**Delivers:** A production-ready, self-hosted notepad that is easy to deploy, observable, and resilient to common failure modes.

**Features and concerns:**
- Warm, Arc-inspired UI refinement (if not fully addressed in Phase 1)
- Mode indicator UI polish (clear visual cue for which collaboration mode is active)
- Orphaned image cleanup job (scan for images not referenced by any pad)
- Reverse proxy setup guide (nginx/Caddy) with X-Accel-Redirect for image serving
- Rate limiting on all write endpoints (text saves, image uploads)
- Request body size limits (1MB for text, 10MB for images)
- Dashboard pagination (never load all pads into memory)
- Docker image + `docker-compose.yml` for trivial self-hosting
- Basic operational runbook (backup strategy, WAL checkpoint schedule, disk monitoring)

**Research flag:** Standard DevOps patterns. No dedicated research phase needed. Caddy + Docker are extensively documented.

---

### Phase Ordering Rationale

- Phase 1 before everything: SSR, SQLite, and the basic request/response cycle are prerequisites for every feature. Security foundations (slug validation, WAL config, version checks) must be established here, not retrofitted.
- Phase 2 before collaboration phases: image paste is independent of collaboration infrastructure and is the primary motivating differentiator. Delivering it before WebSocket complexity keeps Phase 1 shipping fast and gives users the most-requested feature early.
- Phase 3 before Phase 4: auto-merge establishes the mode-switching infrastructure, version/conflict UI, and team's understanding of collaboration UX -- all of which real-time builds on. Auto-merge's diff-match-patch is also a useful correctness baseline for validating that real-time Yjs produces equivalent results.
- Phase 4 last among features: real-time is the highest complexity and highest risk. Deferring it until Phases 1-3 are solid means the simpler modes are battle-tested and the architecture is well-understood before introducing Yjs + WebSocket.
- Phase 5 after all features: polish and production hardening benefit from knowing the full feature surface.

### Research Flags

Phases likely needing a dedicated research spike before planning:

- **Phase 4 (Real-Time):** Yjs + y-websocket + custom SQLite persistence without Hocuspocus is a less-documented integration path. Plan a 1-2 day spike to validate persistence patterns, document compaction strategy, and reconnection handling before committing to implementation estimates.
- **Phase 3 (Auto-Merge):** Three-way text merge edge cases are subtle. Review Matthew Weidner's 2025 "Collaborative Text Editing without CRDTs or OT" before starting. Plan for test cases covering overlapping edits in the same line.

Phases with standard, well-documented patterns (skip dedicated research):

- **Phase 1 (Foundation):** Hono SSR + SQLite + debounced save are all extensively documented with official examples.
- **Phase 2 (Images + Markdown):** Image upload, sharp processing, marked + DOMPurify, and CodeMirror integration all follow established patterns.
- **Phase 5 (Polish):** Docker, Caddy, and standard rate limiting patterns are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry on 2026-03-07. All core libraries have official docs and production track records. Hono SSR streaming is the one area with fewer real-world examples (MEDIUM for that specific feature). |
| Features | HIGH | Domain is well-understood with multiple live competitors to analyze. Feature gaps confirmed by examining competitor limitations (Etherpad's abandoned image plugin, Dontpad's text-only constraint). |
| Architecture | HIGH | Patterns are grounded in official Hono, Yjs, and SQLite documentation. The dual-storage pattern for real-time pads is a logical necessity, not speculation. Scale analysis is conservative and realistic for the stated target (1-50 users). |
| Pitfalls | HIGH | Multiple independent sources (SQLite write contention, Yjs GC, XSS in markdown, image upload abuse) corroborate each pitfall. Matthew Weidner's 2025 CRDT research is particularly authoritative for the auto-merge complexity assessment. |

**Overall confidence:** HIGH

### Gaps to Address

- **Yjs document compaction in practice:** Research confirms the risk (tombstone growth, unbounded document size) and the theoretical solution (serialize to fresh Y.Doc). The exact compaction strategy and its interaction with y-websocket's sync protocol needs validation during Phase 4 spike.
- **Clipboard API mobile browser support:** The paste event + ClipboardItem API for image paste has known inconsistencies across mobile browsers (particularly iOS Safari). Test on target devices before finalizing the Phase 2 image paste implementation.
- **Hono JSX streaming for large pads:** The SSR architecture assumes streaming HTML (`renderToReadableStream`) benefits pads with large content. For very large pads (100KB+), verify that streaming actually improves perceived performance vs. buffered response, and add a content size limit if streaming adds complexity without measurable benefit.
- **diff-match-patch correctness for concurrent edits in same line:** The auto-merge approach works well when users edit different sections. Overlapping edits in the same line produce unpredictable merge results. Document the known limitations and communicate them to users via the mode description UI.

## Sources

### Primary (HIGH confidence)
- [Hono official docs](https://hono.dev/docs/) -- SSR, streaming, WebSocket, file upload patterns
- [Yjs documentation](https://docs.yjs.dev/) -- CRDT internals, y-websocket, persistence
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) -- synchronous driver, performance docs
- [Drizzle ORM SQLite docs](https://orm.drizzle.team/docs/get-started-sqlite) -- schema, migrations
- [SQLite WAL documentation](https://sqlite.org/wal.html) -- write contention, journal modes, WAL pragmas
- [sharp documentation](https://sharp.pixelplumbing.com/) -- image processing API
- [y-codemirror.next GitHub](https://github.com/yjs/y-codemirror.next) -- CodeMirror + Yjs binding
- [Clipboard API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) -- image paste browser API
- [OWASP: Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload) -- image upload security
- [Markdown's XSS Vulnerability - Showdown wiki](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-(and-how-to-mitigate-it)) -- XSS via markdown
- [Node.js 22.22.1 LTS release](https://nodejs.org/en/blog/release/v22.22.0) -- LTS timeline
- [Tailwind CSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- v4 features, CSS-first config
- [SQLite concurrent writes analysis](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) -- write contention patterns
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) -- synchronous API implications

### Secondary (MEDIUM confidence)
- [Collaborative Text Editing without CRDTs or OT - Matthew Weidner (2025)](https://mattweidner.com/2025/05/21/text-without-crdts.html) -- auto-merge algorithm alternatives
- [Yjs Community: Undo manager disables GC](https://discuss.yjs.dev/t/undo-manager-disables-gc-makes-doc-size-grow-unbounded/3797) -- Yjs document bloat
- [Yjs Community: Memory issues](https://discuss.yjs.dev/t/memory-issue-with-yjs/2568) -- room eviction patterns
- [ContentEditable: The Good, The Bad and The Ugly](https://medium.com/content-uneditable/contenteditable-the-good-the-bad-and-the-ugly-261a38555e9c) -- why textarea > contenteditable for plain text
- [CKEditor: How collaborative editing drove CKEditor 5's architecture](https://ckeditor.com/blog/lessons-learned-from-creating-a-rich-text-editor-with-real-time-collaboration/) -- collab mode complexity confirmation
- [ep_copy_paste_images on npm](https://www.npmjs.com/package/ep_copy_paste_images/v/0.0.16) -- Etherpad image plugin abandonment (5+ years old)
- [awesome-selfhosted: Note-taking and Editors](https://awesome-selfhosted.net/tags/note-taking--editors.html) -- competitor landscape
- [Bun production readiness 2026](https://dev.to/last9/is-bun-production-ready-in-2026-a-practical-assessment-181h) -- Node.js vs Bun tradeoffs
- [CRDT vs OT Comparison](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo) -- algorithm selection

### Tertiary (LOW confidence)
- [Padn't: Dontpad alternative portfolio](https://www.baiode.dev/portfolio/padnt/) -- single project; validates URL-based model feasibility

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
