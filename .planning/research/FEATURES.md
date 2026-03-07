# Feature Landscape

**Domain:** Self-hosted collaborative notepad (Etherpad/Dontpad replacement)
**Researched:** 2026-03-07
**Confidence:** HIGH -- well-understood domain with many existing products to analyze

## Competitor Landscape

Before categorizing features, here is what the relevant competitors offer, since PadPlus sits at the intersection of "simple URL-based notepads" (Dontpad, cl1p.net, Madpad) and "full collaborative editors" (Etherpad, HedgeDoc, CryptPad).

| Product | URL-based access | Real-time collab | Image paste | Markdown | No signup | Self-hosted | Speed |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dontpad | Yes | Limited | No | No | Yes | No | Fast |
| Etherpad | No (pad IDs) | Yes | Via plugins | Via plugins | Yes | Yes | Slow |
| HedgeDoc | No (pad IDs) | Yes | Yes | Yes (native) | Configurable | Yes | Medium |
| CryptPad | No (encrypted URLs) | Yes | Yes | Yes | Yes | Yes | Slow (crypto overhead) |
| Rustpad | Yes (URL paths) | Yes (OT) | No | No | Yes | Yes | Fast |
| Flatnotes | No (search-based) | No | Yes | Yes | Configurable | Yes | Fast |
| Memos | No (feed-based) | No | Yes | Yes | Yes | Yes | Fast |

**Key insight:** No single product combines URL-based instant access + image paste + speed + self-hosted. This is PadPlus's gap to fill.

---

## Table Stakes

Features users expect from any notepad tool in 2025-2026. Missing any of these and users will leave or not adopt.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| URL-based pad access | Core Dontpad model -- navigate to any path, it exists. Zero friction. Users type a URL and start writing. | Low | This IS the product. `/meeting-notes` just works. Support hierarchical paths like Dontpad (`/project/meeting/2026-03-07`). |
| Auto-save | Every notepad since 2015 auto-saves. Users should never click "save." | Low | Save on debounced input (300-500ms idle). Show subtle save indicator. |
| Instant text loading | The primary motivation for replacing Etherpad. Text must appear before JS hydrates. | Med | SSR or streaming HTML for initial text delivery. JS enhances after. This is the #1 differentiator and must be table stakes for PadPlus specifically. |
| Mobile-responsive layout | Users will share pad URLs in chat and open on phones. Non-negotiable. | Low | Responsive CSS, readable text on small screens, usable textarea. |
| Clean, modern UI | Etherpad looks dated. Users expect modern aesthetics in 2025. | Med | Warm tones, rounded corners, good typography. The Arc browser aesthetic from PROJECT.md is the right call. |
| Basic text editing | Plain text input that just works. No lag, no formatting surprises. | Low | Standard textarea or contenteditable with no WYSIWYG overhead for default mode. |
| Shareable via URL | The URL IS the sharing mechanism. Copy URL, send to colleague, done. | Low | Already inherent in the URL-based model. No "share" button needed -- the URL is the share. |
| Pad creation without setup | Navigate to URL, pad exists. No "create pad" step. | Low | Lazy creation on first visit or first edit. |

---

## Differentiators

Features that set PadPlus apart. Not expected by default, but deliver outsized value given the project's goals.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Image paste from clipboard** | THE feature gap. Neither Etherpad (requires plugin, poorly maintained `ep_copy_paste_images` last updated 5 years ago) nor Dontpad (text only) handle this well. Users paste screenshots constantly in 2025. | Med | Intercept paste event, extract image blob, upload to server, insert inline reference. Store on local filesystem per PROJECT.md constraints. Lazy-load images so they never block text rendering. |
| **Three collaboration modes** | Unique approach -- no competitor offers user-selectable collaboration modes. Etherpad forces real-time OT. Dontpad does last-save-wins. PadPlus lets users pick per-pad. | High | Last-save-wins (default, simplest), auto-merge (CRDT-based, good for async), real-time (WebSocket, cursor sharing). Build in phases: last-save-wins first, auto-merge second, real-time third. |
| **Dashboard with recent pads** | Dontpad has no discovery. Etherpad's pad list is admin-only. A simple dashboard with recent pads and a URL bar provides discoverability without complexity. | Med | Track recently visited pads (localStorage or server-side). URL bar for direct navigation. Recent pads list. No folders, no tags, no complex organization. |
| **Markdown toggle** | HedgeDoc is markdown-first (alienates non-technical users). Dontpad is plain-text-only. PadPlus offers markdown as opt-in per pad -- plain text by default, toggle to render. | Med | Per-pad setting stored in DB. Split-pane or toggle between edit/preview. Use a fast markdown renderer (e.g., markdown-it). |
| **Warm, inviting aesthetic** | Etherpad and most self-hosted tools look corporate or dated. A warm, Arc-inspired UI is a genuine differentiator in the self-hosted space. | Med | Soft color palette, rounded corners, good spacing, subtle animations. This is a design task more than a technical one, but it matters for adoption. |
| **Trivial self-hosting** | Most competitors (HedgeDoc, CryptPad) require PostgreSQL, Redis, or other dependencies. Single binary or single Docker container with SQLite = dramatically lower deployment friction. | Low | SQLite for data, local filesystem for images, single process. `docker run -p 3000:3000 -v data:/data padplus` and done. |

---

## Anti-Features

Features to explicitly NOT build. These add complexity without serving PadPlus's goals.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / authentication | PROJECT.md explicitly scopes this out. Auth adds friction for an internal tool where trust is assumed. Every competitor that adds auth makes the onboarding slower. | All pads are public. If privacy is needed, use obscure URLs (security through obscurity is fine for internal tools). |
| End-to-end encryption | CryptPad's approach. Adds massive complexity (key management, sharing keys, crypto overhead slowing load times). Antithetical to the "speed first" goal. | Trust the network. This is an internal tool. |
| Rich text / WYSIWYG editor | Etherpad's complexity trap. WYSIWYG editors (ProseMirror, TipTap, Quill) are massive complexity sinks with edge cases around collaborative editing. | Plain text + optional markdown rendering. Users who want formatting use markdown syntax. |
| Version history / revision tracking | HedgeDoc and Etherpad both offer this but it adds storage overhead and UI complexity. PROJECT.md explicitly defers this. | For v1, last-save-wins is fine. Auto-merge mode provides implicit conflict safety. Consider as a v2 feature if demanded. |
| Export to PDF/Word | Rarely used, adds heavyweight dependencies (Puppeteer, LibreOffice). PROJECT.md explicitly excludes this. | Copy-paste from browser. Markdown source is already portable. |
| Plugin/extension system | Etherpad's plugin system is its strength AND its weakness -- plugins are often unmaintained, cause compatibility issues, and fragment the experience. | Build the features you need directly. Small, opinionated feature set beats extensible-but-broken. |
| Folders / hierarchical organization | Dontpad supports `/path/sub/path` but this is URL structure, not folder management UI. Adding a folder tree UI adds complexity for minimal gain. | URL paths provide implicit hierarchy. The dashboard shows recent pads. That is enough. |
| Offline support / PWA | Service workers, IndexedDB sync, conflict resolution for offline edits -- massive complexity. | This is a network tool for a team. If the network is down, the tool is down. Acceptable for internal use. |
| Comments / annotations | Google Docs feature. Adds substantial UI and data model complexity. | Collaborators can write comments inline in the text. Or use the pad itself for discussion. |
| AI features | Blinko and newer tools add AI summarization, RAG, etc. Cool but orthogonal to the core value (speed + simplicity). | Keep scope tight. AI is a distraction from shipping a fast notepad. |

---

## Feature Dependencies

```
URL-based pad access ──> Auto-save (auto-save requires pad existence)
URL-based pad access ──> Dashboard (dashboard links to existing pads)
Auto-save ──> Last-save-wins mode (baseline collaboration)
Last-save-wins mode ──> Auto-merge mode (builds on save infrastructure)
Auto-merge mode ──> Real-time mode (adds WebSocket layer on top of merge logic)
Basic text editing ──> Markdown toggle (markdown extends the editor)
Basic text editing ──> Image paste (images are inserted into the editing context)
Image paste ──> Lazy image loading (optimization after images work)
Instant text loading ──> Image lazy loading (images must not block text)
```

### Critical Path

```
Phase 1: URL-based access + Basic editing + Auto-save + Instant text loading
    |
Phase 2: Image paste + Markdown toggle + Dashboard
    |
Phase 3: Auto-merge collaboration mode
    |
Phase 4: Real-time collaboration mode (WebSocket, cursors, presence)
```

The critical insight: **real-time collaboration is Phase 4, not Phase 1.** Last-save-wins is the default mode and ships first. Most Etherpad alternatives lead with real-time collab and sacrifice everything else. PadPlus leads with speed and progressively adds collaboration sophistication.

---

## MVP Recommendation

**Prioritize (ship in v1):**

1. **URL-based pad access** -- the core interaction model, everything depends on this
2. **Instant text loading (SSR)** -- the reason this project exists, must be present from day one
3. **Auto-save with last-save-wins** -- baseline collaboration, simplest mode
4. **Clean, responsive UI** -- warm aesthetic, mobile-friendly, modern feel
5. **Image paste support** -- the feature gap that motivates replacing existing tools

**Defer to v2:**

- **Markdown toggle** -- valuable but not why users switch from Etherpad/Dontpad
- **Dashboard with recent pads** -- nice to have, users can bookmark URLs initially
- **Auto-merge mode** -- meaningful upgrade but last-save-wins works for small teams

**Defer to v3:**

- **Real-time collaboration** -- highest complexity, requires WebSocket infrastructure, CRDT or OT algorithms, cursor rendering, presence UI. Only build this after the core is rock-solid.

**Never build:**

- Auth, encryption, WYSIWYG, plugins, offline mode, AI (see Anti-Features above)

---

## Sources

- [Etherpad official site](https://etherpad.org/) -- feature reference, plugin ecosystem
- [HedgeDoc official site](https://hedgedoc.org/) -- feature set of primary markdown competitor
- [CryptPad features page](https://cryptpad.fr/features.html) -- encrypted collaboration features
- [Rustpad on GitHub](https://github.com/ekzhang/rustpad) -- minimal self-hosted collaborative editor
- [Flatnotes on GitHub](https://github.com/dullage/flatnotes) -- database-less markdown notes
- [Dontpad on AlternativeTo](https://alternativeto.net/software/dontpad/about/) -- Dontpad feature description
- [awesome-selfhosted: Note-taking and Editors](https://awesome-selfhosted.net/tags/note-taking--editors.html) -- ecosystem overview
- [Ably: Collaborative UX Best Practices](https://ably.com/blog/collaborative-ux-best-practices) -- presence, cursors, locking patterns
- [Memos on GitHub](https://github.com/usememos/memos) -- lightweight self-hosted notes with SQLite
- [ep_copy_paste_images on npm](https://www.npmjs.com/package/ep_copy_paste_images/v/0.0.16) -- Etherpad image plugin (last published 5+ years ago, confirming poor support)
