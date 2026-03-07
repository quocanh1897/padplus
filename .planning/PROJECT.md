# PadPlus

## What This Is

A self-hosted note-sharing app that replaces Etherpad and Dontpad. Users navigate to any URL path and immediately get a working notepad — no signup, no auth. It loads text instantly, supports image paste, and looks good doing it.

## Core Value

Text content loads as fast as physically possible — everything else (images, collaboration, markdown rendering) is secondary to instant text delivery.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] URL-based pad access — navigate to any path and it exists
- [ ] Instant text loading — text content appears before anything else
- [ ] Image paste support — paste images directly into notes, stored on local filesystem, lazy-loaded
- [ ] Three collaboration modes per pad: last-save-wins (default), auto-merge, real-time
- [ ] Toggle markdown mode — plain text editing with optional rendered preview
- [ ] Dashboard with URL bar + recent pads list
- [ ] SQLite storage — single file, zero config
- [ ] No authentication or authorization
- [ ] Warm, inviting UI — soft tones, rounded corners, modern feel
- [ ] Self-hosted with minimal setup (single binary or simple docker)

### Out of Scope

- User accounts / authentication — deliberate choice, not needed for internal use
- OAuth / SSO — no auth means no auth
- Mobile native app — web-first, responsive is sufficient
- End-to-end encryption — internal network, trust is assumed
- Version history / revision tracking — keep it simple for v1
- Export to PDF/Word — copy-paste is good enough

## Context

- Replacing two tools: Etherpad (slow loading, bad UI) and Dontpad (too simple, no image paste)
- Used internally within a team for quick note sharing
- Scale doesn't matter — should work well for any reasonable team size
- Speed is the primary differentiator — the reason existing tools are being replaced
- Image paste is the feature gap — neither Etherpad nor Dontpad handles it well
- Aesthetic preference: warm and inviting like Arc browser — softer tones, rounded corners, not sterile/corporate

## Constraints

- **Performance**: Text must render before JS fully loads — consider SSR or streaming
- **Storage**: SQLite only — no external database dependencies
- **Deployment**: Must be trivially self-hostable — single process, minimal config
- **Images**: Local filesystem storage — no cloud dependencies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| URL-based access (dontpad model) | Lowest friction — no pad creation step | — Pending |
| SQLite for persistence | Zero config, single file backup, fast reads | — Pending |
| Three collab modes (user picks) | Different needs: speed (last-save) vs safety (auto-merge) vs live (real-time) | — Pending |
| No auth | Internal tool — auth adds friction without value | — Pending |
| Local filesystem for images | Self-hosted simplicity, no cloud deps | — Pending |
| Markdown as toggle, not default | Plain text is faster; markdown is opt-in per pad | — Pending |

---
*Last updated: 2026-03-07 after initialization*
