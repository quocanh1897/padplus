# Phase 3: Auto-Merge Collaboration - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add auto-merge as a second collaboration mode. When two users edit the same pad concurrently, the server merges their changes instead of rejecting the stale save. Users can switch between last-save-wins and auto-merge via a visible mode selector in the header. The mode persists per pad.

Real-time collaboration (WebSocket, live sync) is Phase 4. This phase is async merge — no live presence, no cursors, just smarter save behavior.

</domain>

<decisions>
## Implementation Decisions

### Mode Selector UX
- Header dropdown replaces the static "last-save-wins" label — already has the UI slot in Header.svelte
- Clicking the label opens a compact dropdown with the two mode options
- Mode changes take effect immediately — next save uses the new mode's logic
- Mode is visible to all users viewing the pad — sets expectations for collaboration behavior
- Technical names: "Last-save-wins" and "Auto-merge" — direct and clear, no ambiguity

### Merge Result UX
- Subtle "Merged" indicator in save status — brief acknowledgment without being disruptive
- Editor content auto-updates with the merged result after a successful merge
- No manual reload needed — the merged content replaces the editor content seamlessly
- The version bumps to the server's new version after merge

### Conflict / Overlap Handling
- When auto-merge fails (can't produce a clean result), fall back to the existing conflict banner from Phase 1 — user chooses overwrite or copy-reload
- Overlapping same-line edits: let the merge algorithm decide (best-effort) — result may concatenate both versions at the conflict point
- If one user deletes all content while another edits: let the merge algorithm decide normally — no special casing
- The existing ConflictBanner component is reused for merge failures

### Mode Defaults
- Default mode for new pads: last-save-wins — auto-merge is opt-in
- Existing pads keep their current mode (last-save-wins) — no retroactive migration
- Any user can change the mode — no ownership concept

### Claude's Discretion
- Merge algorithm choice (diff-match-patch three-way merge vs alternatives)
- How the base version is stored/tracked for three-way merge
- Dropdown styling and animation
- "Merged" status display timing and animation
- How merged content is spliced into the editor without cursor jump
- Server-side merge implementation details
- Whether to store merge history or just the result
- API changes needed to support merge mode

</decisions>

<specifics>
## Specific Ideas

- The mode selector should feel lightweight — not a "settings" experience, just a quick toggle
- Auto-merge should feel "automatic" — the user shouldn't have to think about it after enabling
- When merge works, it should be invisible except for the subtle status indicator
- When merge fails, the existing conflict UX is familiar — reuse it rather than inventing new patterns
- Playwright E2E tests required for verification

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/components/Header.svelte`: Has `.collab-mode` span showing "last-save-wins" — replace with interactive dropdown
- `src/lib/components/ConflictBanner.svelte`: Full conflict UX with overwrite/copy-reload — reuse for merge failures
- `src/lib/components/SaveStatus.svelte`: Five-state indicator — extend with "merged" state
- `src/lib/server/pads.ts`: `savePad()` with version check, `Pad` interface has `collaboration_mode: string` field already in DB schema
- `src/routes/api/pads/[...slug]/+server.ts`: PUT handler with 409 conflict response — extend for merge mode
- `src/routes/[...slug]/+page.svelte`: `performSave()` handles 409 conflicts, sets `conflictData` — extend for merge response

### Established Patterns
- Optimistic concurrency via `version` column — base for three-way merge tracking
- Svelte 5 runes (`$state`, `$effect`, `$props`) for reactivity
- API returns full pad state on conflict (409) — extend to return merged content
- CSS custom properties from `theme.css` for all styling
- Debounced auto-save at 400ms — merge happens on each save attempt

### Integration Points
- `src/lib/server/pads.ts`: Add merge logic alongside existing `savePad` — new `mergePad` function or extend `savePad`
- `src/routes/api/pads/[...slug]/+server.ts`: PUT handler needs to check pad mode and route to merge vs last-save-wins
- `src/lib/components/Header.svelte`: Replace static label with dropdown, accept mode change callback
- `src/routes/[...slug]/+page.svelte`: Handle merge success response (update content + version), handle merge failure (show conflict banner)
- Database: May need `base_content` column or similar for three-way merge base tracking

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-auto-merge-collaboration*
*Context gathered: 2026-03-07*
