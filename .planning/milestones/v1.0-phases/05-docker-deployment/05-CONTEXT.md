# Phase 5: Docker Deployment - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Containerize PadPlus for trivial self-hosting. Users run a single `docker run` or `docker compose up` command and PadPlus is accessible in a browser with no additional setup. Data persists across container restarts via mounted volumes.

No reverse proxy, HTTPS, or orchestration features. Just the container and a compose file.

</domain>

<decisions>
## Implementation Decisions

### Container Configuration
- Multi-stage Dockerfile: build in Node image, run in slim image for smaller final size (~200MB)
- Default port 3000 inside container — standard Node.js convention
- Comprehensive env vars: PORT, DB_PATH, UPLOAD_DIR, MAX_IMAGE_SIZE, MAX_PAD_QUOTA, LOG_LEVEL — flexibility for self-hosters
- Health check endpoint at /health — useful for Docker, k8s, Portainer
- Run as non-root `padplus` user inside container — security best practice

### Data Persistence
- Single `/data` volume mount containing both `padplus.db` and `uploads/` — simplest for users
- `docker run -v padplus-data:/data -p 3000:3000 padplus` is the one-liner
- Container creates `/data` directory structure on first run if it doesn't exist

### Compose File
- Include both: simple `docker-compose.yml` (PadPlus + named volume) and optional `docker-compose.proxy.yml` with Caddy for automatic HTTPS
- Simple compose is the default — `docker compose up` and done
- Proxy compose is opt-in for production deployments

### Deployment README
- Minimal quick-start README: docker run one-liner, compose up, env vars reference
- Not a full documentation site — just enough to get running

### Claude's Discretion
- Exact Node.js base image version (LTS)
- .dockerignore contents
- Caddy configuration details for the proxy compose
- Health check implementation (simple HTTP 200 vs DB ping)
- Whether to include a Makefile or just rely on compose
- Log format and level defaults

</decisions>

<specifics>
## Specific Ideas

- The `docker run` one-liner should be copy-pasteable from the README — zero thought required
- WebSocket must work through Docker (port mapping handles this, but verify)
- sharp needs platform-specific binaries — Dockerfile must handle this correctly
- Playwright E2E tests required for verification

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/index.js`: Already exists as production server entry with WebSocket upgrade support
- `package.json`: Has `start` script pointing to server/index.js
- `.env`: Has BODY_SIZE_LIMIT=10M already set

### Established Patterns
- SQLite at `data/padplus.db` (configured via DB_PATH env var in db.ts)
- Image uploads at `data/uploads/` (filesystem path in images.ts)
- SvelteKit adapter-node builds to `build/` directory
- WebSocket server embedded in same process

### Integration Points
- `npm run build` produces the SvelteKit build output
- `node server/index.js` starts the production server
- `data/` directory is the single persistence root
- Port configured via PORT env var (already supported by adapter-node)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-docker-deployment*
*Context gathered: 2026-03-10*
