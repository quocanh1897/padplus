# Requirements: PadPlus

**Defined:** 2026-03-07
**Core Value:** Text content loads as fast as physically possible -- everything else is secondary to instant text delivery.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core

- [ ] **CORE-01**: User can navigate to any URL path and get a working pad instantly
- [ ] **CORE-02**: Text content renders server-side before JavaScript loads
- [ ] **CORE-03**: Pad content auto-saves after brief idle (no save button)
- [ ] **CORE-04**: Save uses optimistic concurrency (version check prevents silent overwrites)
- [ ] **CORE-05**: UI uses warm, inviting aesthetic -- soft tones, rounded corners, good typography
- [ ] **CORE-06**: Layout is responsive and usable on mobile

### Images

- [ ] **IMG-01**: User can paste images from clipboard directly into a pad
- [ ] **IMG-02**: Images stored on local filesystem with generated filenames
- [ ] **IMG-03**: Images lazy-load -- never block text rendering
- [ ] **IMG-04**: Image uploads have size limits (per-image and per-pad quota)

### Collaboration

- [ ] **COLLAB-01**: Last-save-wins mode (default) -- simple save with version check
- [ ] **COLLAB-02**: Auto-merge mode -- concurrent edits merged gracefully
- [ ] **COLLAB-03**: Real-time mode -- WebSocket live sync between editors
- [ ] **COLLAB-04**: User can select collaboration mode per pad

### Dashboard

- [ ] **DASH-01**: Landing page has URL bar for direct pad navigation

### Infrastructure

- [ ] **INFRA-01**: SQLite with WAL mode for storage
- [ ] **INFRA-02**: Single-process server, trivially self-hostable
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
| CORE-01 | Phase 1: Working Notepad | Pending |
| CORE-02 | Phase 1: Working Notepad | Pending |
| CORE-03 | Phase 1: Working Notepad | Pending |
| CORE-04 | Phase 1: Working Notepad | Pending |
| CORE-05 | Phase 1: Working Notepad | Pending |
| CORE-06 | Phase 1: Working Notepad | Pending |
| IMG-01 | Phase 2: Image Paste | Pending |
| IMG-02 | Phase 2: Image Paste | Pending |
| IMG-03 | Phase 2: Image Paste | Pending |
| IMG-04 | Phase 2: Image Paste | Pending |
| COLLAB-01 | Phase 1: Working Notepad | Pending |
| COLLAB-02 | Phase 3: Auto-Merge Collaboration | Pending |
| COLLAB-03 | Phase 4: Real-Time Collaboration | Pending |
| COLLAB-04 | Phase 3: Auto-Merge Collaboration | Pending |
| DASH-01 | Phase 1: Working Notepad | Pending |
| INFRA-01 | Phase 1: Working Notepad | Pending |
| INFRA-02 | Phase 1: Working Notepad | Pending |
| INFRA-03 | Phase 5: Docker Deployment | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
