# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — PadPlus Initial Release

**Shipped:** 2026-03-10
**Phases:** 5 | **Plans:** 13

### What Was Built
- URL-based notepad with SSR text rendering (content before JavaScript)
- Clipboard image paste with sharp WebP optimization and lazy-loading
- Three collaboration modes: last-save-wins, auto-merge, real-time (Yjs CRDT)
- Per-pad mode selector with instant switching
- Docker deployment with one-liner setup and data persistence

### What Worked
- Five-phase structure cleanly separated concerns: each phase had clear boundaries and dependencies
- Research-first approach (per-phase RESEARCH.md) caught complexity early — Yjs persistence and three-way merge designs were informed by research
- Verification loop after each phase caught real bugs (base_content tracking in Phase 3)
- Consistent 3-5 minute plan execution velocity across all 13 plans
- SvelteKit SSR + adapter-node proved ideal for speed-first goal

### What Was Inefficient
- SUMMARY.md frontmatter (`one_liner`, `requirements_completed`) not populated — broke milestone audit 3-source cross-reference
- Production server/index.js duplicates Yjs logic instead of importing ws-server.ts — will require parallel maintenance
- Human verification items accumulated (14 total) without being run — should be done incrementally per phase

### Patterns Established
- Dynamic imports for heavy dependencies (SortableJS, Yjs) to protect initial bundle size
- API-first E2E test setup: create data via API, then verify frontend separately
- Prepared statements for all SQLite queries (performance pattern)
- Transaction wrapping for multi-step DB operations (merge path, image reorder)
- Unique timestamped slugs in E2E tests to prevent cross-test interference

### Key Lessons
1. Three-way merge needs correct base_content tracking — the common ancestor must be the pre-save server content, not the incoming content. Caught by verifier, fixed in commit 64a8fe7.
2. WebSocket dev/production split is unavoidable with SvelteKit — Vite plugin for dev, custom server for prod. Accept the duplication cost or invest in a shared module.
3. 400ms auto-save debounce with isSaving guard is the right balance — fast enough to feel instant, slow enough to prevent overlapping requests.
4. Dynamic import of Yjs via Svelte `{#await import(...)}` is clean and effective for conditional heavy dependencies.

### Cost Observations
- Model mix: quality profile (Opus for orchestration, Sonnet for agents)
- Total execution time: ~50 minutes across all plans
- Notable: 3-day wall-clock for 5 phases with full verification — very efficient

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 13 | Initial process — research, plan, execute, verify per phase |

### Cumulative Quality

| Milestone | E2E Tests | Verification Score | Tech Debt Items |
|-----------|-----------|-------------------|-----------------|
| v1.0 | 32 tests across 7 spec files | 52/52 must-haves verified | 17 items accepted |

### Top Lessons (Verified Across Milestones)

1. Research before planning catches complexity early and informs better designs
2. Verification after execution catches real bugs — do not skip the verifier
