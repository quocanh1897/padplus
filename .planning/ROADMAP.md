# Roadmap: PadPlus

## Overview

PadPlus delivers a speed-first self-hosted notepad in five phases. Phase 1 builds the complete core experience: a working URL-based notepad with server-rendered text, auto-save, warm UI, and last-save-wins collaboration. Phase 2 adds the primary differentiator -- image paste from clipboard. Phase 3 introduces auto-merge collaboration with a per-pad mode selector. Phase 4 delivers real-time WebSocket collaboration (the highest-complexity feature, deferred until simpler modes are solid). Phase 5 packages everything for trivial self-hosted deployment via Docker.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Working Notepad** - URL-based pad access with SSR text, auto-save, warm UI, and basic collaboration
- [ ] **Phase 2: Image Paste** - Clipboard image paste with filesystem storage, lazy-loading, and size limits
- [ ] **Phase 3: Auto-Merge Collaboration** - Concurrent edit merging with per-pad mode selector
- [ ] **Phase 4: Real-Time Collaboration** - WebSocket live sync with Yjs CRDT
- [ ] **Phase 5: Docker Deployment** - Containerized self-hosting with one-liner setup

## Phase Details

### Phase 1: Working Notepad
**Goal**: Users can navigate to any URL path and immediately read and edit text that loads before JavaScript, with auto-save and a warm, responsive UI
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, INFRA-01, INFRA-02, COLLAB-01, DASH-01
**Success Criteria** (what must be TRUE):
  1. User navigates to any URL path (e.g., `/meeting-notes`) and sees a working text editor with content visible before JavaScript finishes loading
  2. User types in a pad, stops typing, and content is saved automatically without any save button -- reloading the page shows the saved content
  3. Two users edit the same pad; the last save wins but a stale-version save is rejected with a visible conflict warning (no silent data loss)
  4. Landing page has a URL bar where user can type a pad name and navigate directly to it
  5. UI feels warm and inviting on both desktop and mobile -- soft color palette, rounded corners, readable typography, no layout breakage on small screens
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: Image Paste
**Goal**: Users can paste images from their clipboard directly into any pad, with images stored locally and loaded without blocking text
**Depends on**: Phase 1
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04
**Success Criteria** (what must be TRUE):
  1. User copies an image and pastes it into a pad -- the image appears inline without leaving the editor or using a file picker
  2. Pasted images are stored on the server filesystem with generated filenames (not user-controlled names)
  3. When a pad with images loads, text appears instantly and images lazy-load afterward -- images never block text rendering
  4. Uploading an image larger than the size limit (or exceeding the per-pad quota) shows a clear error message and the upload is rejected
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Auto-Merge Collaboration
**Goal**: Two users can edit different sections of the same pad simultaneously without losing each other's work, and users can select their pad's collaboration mode
**Depends on**: Phase 1
**Requirements**: COLLAB-02, COLLAB-04
**Success Criteria** (what must be TRUE):
  1. Two users edit different sections of a pad set to auto-merge mode, save concurrently, and both see a merged result containing both edits
  2. User can switch a pad's collaboration mode (last-save-wins or auto-merge) via a visible mode selector, and the selected mode persists across sessions
  3. When auto-merge produces a conflict (overlapping edits), the user sees the merged result and can review what changed
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Real-Time Collaboration
**Goal**: Multiple users can edit the same pad simultaneously with character-by-character live sync
**Depends on**: Phase 3
**Requirements**: COLLAB-03
**Success Criteria** (what must be TRUE):
  1. Two users open the same pad in real-time mode and see each other's keystrokes appear within ~200ms
  2. User's connection drops and reconnects -- edits made during disconnection are synced without data loss
  3. Real-time mode selector option is available alongside last-save-wins and auto-merge, and switching modes takes effect immediately
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Docker Deployment
**Goal**: Anyone can self-host PadPlus with a single Docker command and zero configuration
**Depends on**: Phase 1
**Requirements**: INFRA-03
**Success Criteria** (what must be TRUE):
  1. User runs a single `docker run` or `docker compose up` command and PadPlus is accessible in a browser with no additional setup
  2. Data (SQLite database and images) persists across container restarts via mounted volumes
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 --> 2 --> 3 --> 4 --> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Working Notepad | 0/3 | Not started | - |
| 2. Image Paste | 0/2 | Not started | - |
| 3. Auto-Merge Collaboration | 0/2 | Not started | - |
| 4. Real-Time Collaboration | 0/2 | Not started | - |
| 5. Docker Deployment | 0/1 | Not started | - |
