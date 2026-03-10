# Requirements: PadPlus

**Defined:** 2026-03-07
**Core Value:** Text content loads as fast as physically possible -- everything else is secondary to instant text delivery.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core

- [x] **CORE-01**: User can navigate to any URL path and get a working pad instantly
- [x] **CORE-02**: Text content renders server-side before JavaScript loads
- [x] **CORE-03**: Pad content auto-saves after brief idle (no save button)
- [x] **CORE-04**: Save uses optimistic concurrency (version check prevents silent overwrites)
- [x] **CORE-05**: UI uses warm, inviting aesthetic -- soft tones, rounded corners, good typography
- [x] **CORE-06**: Layout is responsive and usable on mobile

### Images

- [x] **IMG-01**: User can paste images from clipboard directly into a pad
- [x] **IMG-02**: Images stored on local filesystem with generated filenames
- [x] **IMG-03**: Images lazy-load -- never block text rendering
- [x] **IMG-04**: Image uploads have size limits (per-image and per-pad quota)

### Collaboration

- [x] **COLLAB-01**: Last-save-wins mode (default) -- simple save with version check
- [x] **COLLAB-02**: Auto-merge mode -- concurrent edits merged gracefully
- [x] **COLLAB-03**: Real-time mode -- WebSocket live sync between editors
- [x] **COLLAB-04**: User can select collaboration mode per pad

### Dashboard

- [x] **DASH-01**: Landing page has URL bar for direct pad navigation

### Infrastructure

- [x] **INFRA-01**: SQLite with WAL mode for storage
- [x] **INFRA-02**: Single-process server, trivially self-hostable
- [ ] **INFRA-03**: Docker deployment with one-liner command

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Markdown

- **MD-01**: User can toggle markdown rendering per pad with live preview

### Dashboard

- **DASH-02**: Landing page shows list of recently accessed pads with timestamps

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Internal tool -- auth adds friction without value |
| End-to-end encryption | Speed-first goal, trust the internal network |
| Rich text / WYSIWYG editor | Complexity sink -- plain text + future markdown is sufficient |
| Version history / revision tracking | Deferred for simplicity in v1 |
| Export to PDF/Word | Copy-paste from browser is sufficient |
| Plugin / extension system | Opinionated feature set beats extensible-but-broken |
| Offline support / PWA | Network tool for teams -- network down means tool down |
| Folders / hierarchical organization | URL paths provide implicit hierarchy |
| Comments / annotations | Collaborators write comments inline |
| AI features | Orthogonal to core value (speed + simplicity) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1: Working Notepad | Complete |
| CORE-02 | Phase 1: Working Notepad | Complete |
| CORE-03 | Phase 1: Working Notepad | Complete |
| CORE-04 | Phase 1: Working Notepad | Complete |
| CORE-05 | Phase 1: Working Notepad | Complete |
| CORE-06 | Phase 1: Working Notepad | Complete |
| IMG-01 | Phase 2: Image Paste | Complete |
| IMG-02 | Phase 2: Image Paste | Complete |
| IMG-03 | Phase 2: Image Paste | Complete |
| IMG-04 | Phase 2: Image Paste | Complete |
| COLLAB-01 | Phase 1: Working Notepad | Complete |
| COLLAB-02 | Phase 3: Auto-Merge Collaboration | Complete |
| COLLAB-03 | Phase 4: Real-Time Collaboration | Complete |
| COLLAB-04 | Phase 3: Auto-Merge Collaboration | Complete |
| DASH-01 | Phase 1: Working Notepad | Complete |
| INFRA-01 | Phase 1: Working Notepad | Complete |
| INFRA-02 | Phase 1: Working Notepad | Complete |
| INFRA-03 | Phase 5: Docker Deployment | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
