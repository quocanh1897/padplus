# Phase 1: Working Notepad - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a URL-based notepad where users navigate to any path and get a working text editor. Text content renders server-side before JavaScript loads. Auto-save with optimistic concurrency (version check) prevents silent data loss. Warm, responsive UI. Landing page has URL bar for direct pad navigation. Last-save-wins collaboration mode (default). SQLite with WAL mode. Single-process server.

Image paste, markdown toggle, auto-merge, real-time collab, recent pads list, and Docker deployment are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Editor Experience
- Distraction-free editing surface — just text, no visible chrome around the editor
- Thin header bar with pad name + save status + home link, but the editor dominates the page
- Sans-serif font for the editor — clean, modern reading feel matching the warm aesthetic
- Full width editor with comfortable padding — maximize space for notes
- Save feedback: subtle text indicator in header — "Saved" / "Saving..." / "Unsaved changes"

### Pad Page Layout
- Minimal header: pad name (from URL slug), save status indicator, home link icon
- Collaboration mode indicator in header (Phase 1 only shows "last-save-wins" but establishes the UI slot for future modes)
- Pad name displays as the URL path as-is (e.g., `/meeting-notes`) — no humanization or renaming
- Follows system light/dark preference — respects OS setting automatically
- Subtle PadPlus branding — small logo/name in header, pad content is the focus

### Landing Page
- Address-bar style URL input — shows `padplus/` prefix, user types the pad slug
- Large, centered on page — Google-search-bar energy
- Light hero: app name + one-line description ("Type a name, start writing") above the URL bar
- Empty state (first visit): just the URL bar + tagline, clean and inviting
- Phase 1 has no recent pads list (that's DASH-02, v2)

### Conflict Handling
- On stale save: banner at top of editor warning that the pad was modified since load
- Shows what changed (diff or summary) so user can make an informed decision
- User can force-overwrite with a clearly labeled "Overwrite" button (with warning text)
- User can copy their version to clipboard before reloading to see server version
- Stale detection happens on save only (not periodic polling) — simplest approach
- Auto-save fires, version mismatch detected → banner appears, auto-save pauses until user resolves

### Claude's Discretion
- Exact color palette within "warm & inviting" (soft tones, rounded corners, Arc-inspired)
- Typography choices (font family, sizes, weights)
- Spacing, padding, border-radius values
- Auto-save debounce timing (300-500ms range per research)
- Error state handling beyond conflicts
- SSR implementation approach (streaming vs full render)
- SQLite schema design

</decisions>

<specifics>
## Specific Ideas

- Warm & inviting aesthetic like Arc browser — softer tones, rounded corners, not sterile/corporate
- Speed is the #1 priority — text visible before JS loads, no spinner, no blank screen
- This replaces both Etherpad (slow, bad UI) and Dontpad (too simple) — should feel like neither
- "Distraction-free" doesn't mean ugly — the editor itself should feel pleasant, like writing in a nice notebook
- No auth means no "create account" step, no "share" button — the URL IS the sharing mechanism
- Playwright E2E tests required for verification after implementation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase and carried forward

### Integration Points
- This phase establishes the foundation that all subsequent phases build on
- SQLite schema must accommodate future columns for collaboration mode, image references
- Route handler must support catch-all URL patterns for pad access
- Server architecture must allow future WebSocket upgrade (Phase 4)

</code_context>

<deferred>
## Deferred Ideas

- Recent pads list on dashboard — DASH-02 (v2)
- Markdown toggle — MD-01 (v2)
- Image paste — Phase 2
- Auto-merge collaboration — Phase 3
- Real-time collaboration — Phase 4

</deferred>

---

*Phase: 01-working-notepad*
*Context gathered: 2026-03-07*
