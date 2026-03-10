# PadPlus

## What This Is

A self-hosted note-sharing app that replaces Etherpad and Dontpad. Users navigate to any URL path and immediately get a working notepad with server-rendered text, auto-save, clipboard image paste, and three collaboration modes. No signup, no auth. Deployable with a single Docker command.

## Core Value

Text content loads as fast as physically possible — everything else (images, collaboration, markdown rendering) is secondary to instant text delivery.

## Requirements

### Validated

- ✓ URL-based pad access — navigate to any path and it exists — v1.0
- ✓ Instant text loading — SSR renders text before JavaScript loads — v1.0
- ✓ Image paste support — clipboard paste, sharp WebP, lazy-load, size limits — v1.0
- ✓ Three collaboration modes: last-save-wins, auto-merge (three-way diff), real-time (Yjs CRDT) — v1.0
- ✓ Per-pad mode selector with instant switching — v1.0
- ✓ Dashboard with URL bar for direct pad navigation — v1.0
- ✓ SQLite with WAL mode — single file, zero config — v1.0
- ✓ No authentication or authorization — v1.0
- ✓ Warm, inviting UI — soft tones, rounded corners, dark mode — v1.0
- ✓ Mobile responsive layout — v1.0
- ✓ Optimistic concurrency with conflict detection — v1.0
- ✓ Docker deployment with one-liner setup — v1.0

### Active

- [ ] Toggle markdown mode — plain text editing with optional rendered preview
- [ ] Dashboard with recent pads list — recently accessed pads with timestamps

### Out of Scope

- User accounts / authentication — deliberate choice, not needed for internal use
- OAuth / SSO — no auth means no auth
- Mobile native app — web-first, responsive is sufficient
- End-to-end encryption — internal network, trust is assumed
- Version history / revision tracking — keep it simple
- Export to PDF/Word — copy-paste is good enough
- Rich text / WYSIWYG editor — plain text + future markdown is sufficient
- Plugin / extension system — opinionated feature set
- Offline support / PWA — network tool for teams
- Folders / hierarchical organization — URL paths provide implicit hierarchy
- AI features — orthogonal to core value (speed + simplicity)

## Context

Shipped v1.0 with ~26,400 LOC across TypeScript, Svelte 5, CSS, and JavaScript.
Tech stack: SvelteKit 2, Svelte 5, better-sqlite3 (WAL mode), sharp, Yjs + y-websocket, adapter-node.
Built in 3 days across 5 phases and 13 plans.

Known tech debt:
- Production server/index.js duplicates Yjs room logic (~165 lines) from ws-server.ts
- lib0/y-protocols imported as transitive deps, not direct
- 14 human verification items pending (UX quality checks)

## Constraints

- **Performance**: Text must render before JS fully loads — SSR via SvelteKit adapter-node
- **Storage**: SQLite only — no external database dependencies
- **Deployment**: Must be trivially self-hostable — single process, minimal config
- **Images**: Local filesystem storage — no cloud dependencies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| URL-based access (dontpad model) | Lowest friction — no pad creation step | ✓ Good — works seamlessly |
| SQLite for persistence | Zero config, single file backup, fast reads | ✓ Good — WAL mode handles concurrent reads well |
| Three collab modes (user picks) | Different needs: speed (last-save) vs safety (auto-merge) vs live (real-time) | ✓ Good — per-pad flexibility proven useful |
| No auth | Internal tool — auth adds friction without value | ✓ Good — zero-friction confirmed as core value |
| Local filesystem for images | Self-hosted simplicity, no cloud deps | ✓ Good — sharp WebP optimization keeps storage efficient |
| Markdown as toggle, not default | Plain text is faster; markdown is opt-in per pad | — Deferred to v2 |
| SvelteKit with adapter-node | SSR for instant text, single process for deployment | ✓ Good — SSR delivers content before JS |
| Yjs CRDT for real-time | Industry-standard, handles merge conflicts automatically | ✓ Good — reconnect and offline edits sync correctly |
| Self-contained production server | Avoids SvelteKit build import complexity for WebSocket | ⚠️ Creates maintenance risk (duplicated Yjs logic) |
| diff3Merge for auto-merge | Structured blocks avoid conflict markers in content | ✓ Good — clean three-way merge with base_content tracking |
| 400ms auto-save debounce | Fast enough to feel instant, slow enough to batch keystrokes | ✓ Good — natural save rhythm |
| Dynamic Yjs import | Keep Yjs out of initial bundle until real-time mode selected | ✓ Good — no bundle bloat for non-real-time users |

---
*Last updated: 2026-03-10 after v1.0 milestone*
