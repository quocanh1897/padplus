# Pitfalls Research

**Domain:** Self-hosted collaborative notepad (Etherpad/Dontpad alternative)
**Researched:** 2026-03-07
**Confidence:** HIGH (multiple sources corroborate each pitfall; well-documented failure modes)

## Critical Pitfalls

### Pitfall 1: Three Collaboration Modes Creates Three Products

**What goes wrong:**
The project specifies three collaboration modes per pad: last-save-wins (default), auto-merge, and real-time. Each mode requires fundamentally different synchronization infrastructure. Last-save-wins needs simple HTTP save endpoints. Auto-merge needs a diffing/merging algorithm (OT or CRDT). Real-time needs WebSocket connections, presence awareness, cursor synchronization, and conflict resolution. Building all three upfront means building three separate collaboration systems before shipping anything.

**Why it happens:**
It feels like a "simple toggle" at the UI level, but each mode has entirely different backend requirements, client-side state management, and failure modes. Teams underestimate this because the modes share the same editor surface. The CKEditor team documented that adding real-time collaboration "drove the entire architecture" of CKEditor 5 -- it was not a bolt-on feature.

**How to avoid:**
Build last-save-wins first and ship it. It is the simplest mode and the default for a reason. Then add auto-merge as a second phase (requires a merge algorithm but no persistent connections). Real-time is a third phase -- it requires WebSocket infrastructure, reconnection handling, and CRDT/OT integration. Do not attempt to build a "mode-agnostic" abstraction layer upfront. The modes are too different for a shared abstraction to be useful without concrete implementations to learn from first.

**Warning signs:**
- Architecture discussions about "a generic sync layer" before any mode works
- Ticket estimates treating auto-merge and real-time as similar effort
- Building WebSocket infrastructure in Phase 1

**Phase to address:**
Phase 1: last-save-wins only. Phase 2 or 3: auto-merge. Phase 3 or 4: real-time. Each mode should be a distinct milestone.

---

### Pitfall 2: CRDT/OT Complexity Sink for Auto-Merge and Real-Time Modes

**What goes wrong:**
Developers either underestimate the complexity of CRDTs/OT and try to build their own, or they integrate a library like Yjs without understanding its implications: unbounded document growth from tombstones, the requirement to store binary CRDT state alongside readable content, and the difficulty of server-side document inspection. CRDT documents only grow in size because deleted content becomes tombstones rather than being truly removed.

**Why it happens:**
Academic papers make CRDTs sound elegant. Library READMEs show simple examples. The reality is that Yjs has a steep learning curve, documents with garbage collection disabled grow unbounded, the undo manager disables GC and makes doc size grow unbounded, and you need Node.js or Rust to inspect documents server-side. Matthew Weidner's 2025 research describes the core issue: "Text-editing CRDTs' total orders are subtle algorithms defined in academic papers, often challenging to read."

**How to avoid:**
For auto-merge mode, consider the simpler approach from Weidner's research: assign unique IDs to characters, use "insert after" operations, apply operations literally on the server. This avoids CRDT/OT complexity entirely for the non-real-time case. For real-time mode, use Yjs with y-websocket but budget significant time for integration. Plan for periodic document compaction: serialize the current state to a fresh Yjs document and discard the old one to control tombstone growth. Store both the Yjs binary blob and a plain-text export so you always have a human-readable authoritative source.

**Warning signs:**
- Building a custom merge algorithm "because it's simpler than a library"
- Yjs document binary blobs growing to 10x+ the size of the actual text content
- No plan for document compaction/reset
- Server cannot read document contents without loading the full Yjs state

**Phase to address:**
Phase 2+ (auto-merge), Phase 3+ (real-time). Research the specific algorithm before starting each phase.

---

### Pitfall 3: Last-Save-Wins Silently Destroys Content

**What goes wrong:**
Last-save-wins is the default mode, and it will be used by multiple people on the same pad. User A loads the pad, makes edits for 5 minutes. User B loads the same pad, makes a quick edit, saves. User A saves -- User B's entire edit is silently overwritten. No warning, no conflict detection, no recovery. This is especially dangerous because the project has no version history (explicitly out of scope).

**Why it happens:**
Last-write-wins using timestamps means whoever wrote last "wins," and data can be completely erased. Developers assume "it's just for quick notes, people won't collide" but collisions happen constantly on shared team pads, especially popular ones.

**How to avoid:**
Implement optimistic concurrency control even in last-save-wins mode. Store a version number or ETag with each pad. When saving, the client sends the version it loaded. If the server version has changed, reject the save and show a diff or warning: "This pad was modified since you loaded it. Overwrite or reload?" This is NOT auto-merge -- it is a simple version check that prevents silent data loss. Budget 2-4 hours for this; it is essential.

**Warning signs:**
- Save endpoint accepts content without any version/timestamp check
- No UI indication that the pad has been modified by someone else since load
- Team members complaining about "lost edits"

**Phase to address:**
Phase 1 (core pad functionality). This must ship with last-save-wins, not be deferred.

---

### Pitfall 4: SQLite Write Contention Under Collaborative Load

**What goes wrong:**
SQLite allows only one writer at a time, even in WAL mode. In a collaborative notepad, saves come in bursts -- multiple users editing popular pads, auto-save timers firing, image uploads happening simultaneously. Without proper configuration, users get "database is locked" errors or silently dropped writes. With better-sqlite3's synchronous API, a long write blocks the entire Node.js event loop, freezing all HTTP handling.

**Why it happens:**
SQLite is marketed as "simple" and developers skip the configuration that makes it production-ready. The defaults (journal_mode=DELETE, synchronous=FULL, no busy_timeout) are optimized for safety on embedded devices, not web application throughput. Additionally, better-sqlite3 is synchronous -- it blocks the event loop during queries, which is fine for fast reads but devastating for write contention.

**How to avoid:**
On first connection, run these pragmas:
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -20000;  -- 20MB cache
PRAGMA foreign_keys = ON;
PRAGMA wal_autocheckpoint = 1000;
```
Keep write transactions as small as possible -- one statement per transaction for saves. Use `BEGIN IMMEDIATE` for any transaction that will write, to fail fast rather than deadlocking mid-transaction. Consider using ULIDs instead of auto-incrementing IDs to avoid write conflicts on the ID sequence. For image uploads (which are larger writes), process them asynchronously and write metadata to SQLite only after the file is saved to disk.

**Warning signs:**
- "SQLITE_BUSY" errors in logs
- Increasing response times under moderate concurrent usage
- Event loop lag metrics spiking during saves
- WAL file growing unbounded (checkpoint starvation)

**Phase to address:**
Phase 1 (database setup). These pragmas must be set from day one, not retrofitted.

---

### Pitfall 5: Image Paste as a Disk Space Denial-of-Service Vector

**What goes wrong:**
Image paste with no authentication means anyone can paste unlimited images into any pad. A malicious user (or a bot) can exhaust the server's disk space by pasting large images repeatedly. Since images are stored on the local filesystem with no cloud CDN or external storage, the host machine's disk is the only limit. With no auth, there is no way to identify or ban the uploader.

**Why it happens:**
Image paste is designed for frictionless use -- no upload dialogs, no file pickers, just paste. This same frictionlessness makes abuse trivial. Self-hosted tools often skip abuse prevention because they assume a trusted network, but "internal tool" does not mean "impossible to abuse" -- disgruntled users, compromised machines, or accidental bulk pastes all happen.

**How to avoid:**
Layer multiple defenses:
1. **Per-image size limit**: Reject images over 5-10MB at the HTTP layer (configure in web server and application).
2. **Per-pad storage quota**: Track total image bytes per pad. Reject uploads when a pad exceeds a threshold (e.g., 100MB).
3. **Global storage quota**: Monitor total image directory size. Alert or reject when approaching a limit.
4. **Rate limiting**: Limit image uploads to N per minute per IP address.
5. **Image processing**: Re-encode pasted images server-side (strip EXIF, compress, resize if oversized). This also prevents "image bomb" attacks where a small file decompresses to a huge bitmap.
6. **Cleanup job**: Periodically scan for orphaned images (referenced by no pad) and delete them.

**Warning signs:**
- Image directory growing faster than expected
- Single pads with dozens of images
- Disk usage alerts
- Server slowing down due to disk I/O from large image writes

**Phase to address:**
Phase 1 or 2 (whenever image paste is built). Size limits and rate limiting must ship with the feature, not after.

---

### Pitfall 6: Markdown Rendering Enables XSS Attacks

**What goes wrong:**
Markdown-to-HTML conversion can execute arbitrary JavaScript. The Markdown specification actively encourages inline HTML, so `<script>alert('xss')</script>` embedded in a pad renders as executable code when markdown mode is toggled on. Since pads have no authentication, anyone can inject malicious scripts into any pad. Other users viewing that pad with markdown enabled get XSSed.

**Why it happens:**
The most popular Markdown parsing libraries do not sanitize HTML by default. Developers test with benign markdown and never try injecting scripts. The "no auth" model makes this especially dangerous because there is no user session to steal, but attackers can still redirect users, inject phishing forms, mine cryptocurrency, or exfiltrate pad contents to external servers.

**How to avoid:**
Sanitize AFTER markdown conversion, not before (sanitizing before breaks markdown features and leaves holes). Use DOMPurify on the rendered HTML output. Alternatively, use a markdown renderer that outputs React elements directly (like react-markdown) rather than raw HTML strings, which avoids dangerouslySetInnerHTML entirely. Set a strict Content Security Policy header that blocks inline scripts. Never trust markdown output -- treat it exactly like user-submitted HTML.

**Warning signs:**
- Markdown rendered via `dangerouslySetInnerHTML` or `innerHTML` without sanitization
- No Content Security Policy header
- Markdown library docs mentioning "HTML pass-through" as a feature
- No XSS test cases in the test suite

**Phase to address:**
Must be addressed in the same phase that implements markdown rendering. Not negotiable as a follow-up.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping version check on save (last-save-wins) | Simpler save endpoint | Silent data loss for concurrent editors | Never -- even in MVP, a version check is 2-4 hours of work |
| Storing images in the database as BLOBs | Single-file deployment | Database size balloons, backups slow, SQLite performance degrades | Never for this project -- filesystem storage is already the plan |
| No rate limiting on any endpoint | Faster development | Abuse on public-facing instance, disk exhaustion | Only if deployed strictly on a private network with trusted users |
| Building all three collab modes before shipping | "Complete" feature set | Months of delay before any user feedback | Never -- ship last-save-wins, iterate |
| Using contentEditable for plain text editing | Rich-text-ready from day one | Cursor positioning nightmares, inconsistent browser behavior, complex state management | Never for a plain-text-first notepad -- use textarea, add contentEditable only for markdown preview |
| Auto-saving on every keystroke to SQLite | "Real-time" feel | Write contention, event loop blocking, excessive disk I/O | Never -- debounce to 1-3 seconds minimum, or save on blur/pause |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full pad content + all images in a single request | Slow initial page load, high TTFB | Stream text first (SSR or chunked response), lazy-load images below the fold | Pads with 3+ images or >50KB text |
| No debounce on auto-save | "SQLITE_BUSY" errors, event loop blocking | Debounce saves to 2 seconds of inactivity, or save on blur | 3+ concurrent editors on same pad |
| Storing Yjs CRDT state without periodic compaction | Memory growth, slow document load, large sync payloads | Periodically serialize current state to fresh document, discard history | Documents with 10,000+ edits |
| No index on pad lookup by URL slug | Full table scan on every page load | Add unique index on slug column from day one | 1,000+ pads |
| Serving images through the application server | Application becomes I/O bound, event loop blocks on large file reads | Serve images directly via reverse proxy (nginx/caddy) using X-Accel-Redirect or static file serving | 10+ concurrent image loads |
| WebSocket connections held open with no heartbeat | "Dead" connections consume resources, no timeout | Implement ping/pong heartbeat every 30 seconds, close after 3 missed pongs | 50+ concurrent WebSocket connections |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No input validation on URL slug (pad name) | Path traversal attacks (`../../etc/passwd`), directory creation outside intended path | Validate slugs against a strict allowlist pattern: `^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$` |
| Serving user-uploaded images without content-type validation | Stored XSS via SVG files, HTML files disguised as images | Validate image magic bytes server-side, re-encode to PNG/JPEG, serve with `Content-Type: image/png` and `Content-Disposition: inline` |
| No CORS policy on API endpoints | Cross-origin pad content theft from malicious sites | Set `Access-Control-Allow-Origin` to the application's own origin only |
| Image filenames derived from user input | Path traversal via crafted filenames | Generate random filenames (UUID) server-side, never use original filename |
| Markdown rendering without CSP | XSS even if sanitization has a bug | Set `Content-Security-Policy: script-src 'self'; style-src 'self' 'unsafe-inline'` as defense-in-depth |
| No request body size limit | Memory exhaustion via huge POST bodies | Set max body size at reverse proxy and application level (e.g., 10MB for image uploads, 1MB for text saves) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication that a pad is being edited by someone else | User edits for 10 minutes, saves, silently overwrites another person's work | Show "last modified by [IP/nickname] at [time]" or "modified since you loaded" banner |
| Markdown toggle resets scroll position | User loses their place in a long document | Preserve scroll position when toggling between edit and preview |
| Auto-save with no visual feedback | Users don't know if their content is saved, manually refresh to check | Show subtle "Saved" / "Saving..." / "Unsaved changes" indicator |
| Dashboard shows all pads including abandoned ones | Cluttered, impossible to find relevant pads | Sort by last modified, show "last accessed" timestamp, consider soft-archiving inactive pads |
| Editor loads JavaScript before showing content | Perceived slowness -- the primary complaint about Etherpad | Render text server-side or inline it in the initial HTML response, hydrate editor after |
| No way to tell which collaboration mode a pad is in | Users don't understand why their edits behave differently on different pads | Clear visual indicator of current mode with a brief explanation |
| Image paste works but image loading blocks text rendering | The speed advantage is lost -- images are secondary content | Lazy-load images, use placeholder dimensions, prioritize text paint |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Pad saving:** Often missing optimistic concurrency (version check) -- verify saves reject stale versions
- [ ] **Image paste:** Often missing size limits, rate limits, and content-type validation -- verify all three exist
- [ ] **Markdown rendering:** Often missing XSS sanitization -- verify `<script>` tags in markdown are stripped, not executed
- [ ] **URL-based pad access:** Often missing slug validation -- verify path traversal attempts return 404, not filesystem access
- [ ] **SQLite setup:** Often missing WAL mode and busy_timeout pragmas -- verify with `PRAGMA journal_mode` returning "wal"
- [ ] **Auto-save:** Often missing debounce -- verify saves don't fire on every keystroke by checking network tab
- [ ] **WebSocket reconnection (real-time mode):** Often missing message queue during disconnect -- verify edits made offline are replayed on reconnect
- [ ] **Image serving:** Often served through app server -- verify images are served by reverse proxy or static file handler
- [ ] **Dashboard:** Often missing pagination/limit -- verify it doesn't load all pads into memory for a single page

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Silent data loss from last-save-wins | HIGH (data is gone) | Add version check retroactively; cannot recover lost content without backups. Consider adding a simple "last 5 saves" buffer table as insurance. |
| SQLite WAL file grown to gigabytes | LOW | Run `PRAGMA wal_checkpoint(TRUNCATE)` during a low-traffic period. Set up auto-checkpoint going forward. |
| Disk filled by image uploads | MEDIUM | Identify largest/orphaned images, remove them. Add quotas and size limits. May need to resize existing images in batch. |
| XSS via markdown rendering | MEDIUM | Add DOMPurify immediately. Scan existing pad contents for script tags. Set CSP header. Cannot undo damage if sessions were hijacked. |
| CRDT document bloat (Yjs) | MEDIUM | Export current document state as plain text. Create a fresh Yjs document from that text. Replace the old binary blob. Users lose undo history. |
| contentEditable cursor bugs | HIGH (architectural) | Requires rewriting the editor component. This is why starting with textarea is strongly recommended for plain-text-first. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Three collab modes = three products | Phase planning (ship modes incrementally) | Phase 1 ships with only last-save-wins; later phases add one mode each |
| Silent data loss (no version check) | Phase 1 (core pad CRUD) | Save endpoint returns 409 when version mismatch; UI shows conflict warning |
| SQLite misconfiguration | Phase 1 (database setup) | Integration test verifies WAL mode, busy_timeout, and synchronous=NORMAL |
| Image disk exhaustion | Phase with image paste | Upload endpoint rejects files >5MB; per-pad quota enforced; rate limiter active |
| Markdown XSS | Phase with markdown toggle | Test case: pad containing `<script>alert(1)</script>` renders without executing |
| CRDT/OT complexity | Phase with auto-merge or real-time | Spike/prototype before committing; document size monitored in production |
| WebSocket reconnection data loss | Phase with real-time mode | Test: disconnect client mid-edit, reconnect, verify edits appear on other clients |
| Image serving blocks event loop | Phase with image paste | Images served by reverse proxy; app server never reads image files for HTTP responses |
| No rate limiting | Phase 1 or 2 | Load test: 100 requests/second to save endpoint from single IP gets throttled |
| contentEditable cursor nightmares | Phase 1 (editor component choice) | Use textarea for plain text editing; only introduce contentEditable if/when rich text editing is required |

## Sources

- [Collaborative Text Editing without CRDTs or OT - Matthew Weidner (2025)](https://mattweidner.com/2025/05/21/text-without-crdts.html) -- HIGH confidence
- [CKEditor: How collaborative editing drove CKEditor 5's architecture](https://ckeditor.com/blog/lessons-learned-from-creating-a-rich-text-editor-with-real-time-collaboration/) -- MEDIUM confidence (could not fully fetch)
- [SQLite concurrent writes and "database is locked" errors](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) -- HIGH confidence
- [The Write Stuff: Concurrent Write Transactions in SQLite](https://oldmoe.blog/2024/07/08/the-write-stuff-concurrent-write-transactions-in-sqlite/) -- HIGH confidence
- [SQLite WAL documentation](https://sqlite.org/wal.html) -- HIGH confidence
- [Yjs GitHub - INTERNALS.md](https://github.com/yjs/yjs/blob/main/INTERNALS.md) -- HIGH confidence
- [Yjs Community: Memory issues discussion](https://discuss.yjs.dev/t/memory-issue-with-yjs/2568) -- MEDIUM confidence
- [Yjs Community: Undo manager disables GC](https://discuss.yjs.dev/t/undo-manager-disables-gc-makes-doc-size-grow-unbounded/3797) -- MEDIUM confidence
- [Markdown's XSS Vulnerability - Showdown wiki](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-(and-how-to-mitigate-it)) -- HIGH confidence
- [ContentEditable: The Good, The Bad and The Ugly](https://medium.com/content-uneditable/contenteditable-the-good-the-bad-and-the-ugly-261a38555e9c) -- MEDIUM confidence
- [OWASP: Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload) -- HIGH confidence
- [OWASP: Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html) -- HIGH confidence
- [Conflict Resolution: Last-Write-Wins vs CRDTs (DZone)](https://dzone.com/articles/conflict-resolution-using-last-write-wins-vs-crdts) -- MEDIUM confidence
- [Revisiting HTML streaming for modern web performance (2025)](https://calendar.perfplanet.com/2025/revisiting-html-streaming-for-modern-web-performance/) -- HIGH confidence
- [better-sqlite3 performance documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) -- HIGH confidence
- [Padn't: Dontpad alternative portfolio](https://www.baioc.dev/portfolio/padnt/) -- LOW confidence (single project)

---
*Pitfalls research for: PadPlus (self-hosted collaborative notepad)*
*Researched: 2026-03-07*
