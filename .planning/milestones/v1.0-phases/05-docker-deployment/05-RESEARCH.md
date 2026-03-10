# Phase 5: Docker Deployment - Research

**Researched:** 2026-03-10
**Domain:** Docker containerization, Node.js production deployment, SvelteKit adapter-node
**Confidence:** HIGH

## Summary

PadPlus is a SvelteKit + adapter-node application with native dependencies (better-sqlite3, sharp) and WebSocket support (Yjs real-time collaboration). The containerization strategy uses a multi-stage Dockerfile with `node:22-bookworm-slim` as the runtime base -- Debian slim is required because both better-sqlite3 and sharp need glibc-based native binaries (Alpine/musl causes compilation failures). The build stage uses the full `node:22-bookworm` image for native module compilation, then copies only production artifacts to the slim runtime image.

The application already uses `./data/` as its single persistence root (SQLite DB at `data/padplus.db`, image uploads at `data/uploads/`). All file paths resolve relative to `process.cwd()`, so the Docker WORKDIR and volume mount must align. The `docker run -v padplus-data:/app/data -p 3000:3000 padplus` one-liner maps to this naturally. A `docker-compose.yml` wraps this with named volumes, and an optional `docker-compose.proxy.yml` adds Caddy for automatic HTTPS.

A `/health` endpoint needs to be created (simple HTTP 200 with optional DB ping). The container runs as a non-root `node` user (built into the Node.js Docker images) for security. SvelteKit adapter-node requires the `ORIGIN` environment variable for CSRF protection in production; this must be documented and defaulted sensibly.

**Primary recommendation:** Use `node:22-bookworm` for build stage and `node:22-bookworm-slim` for runtime; mount a single `/app/data` volume for all persistence; include `ORIGIN` in documented env vars.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multi-stage Dockerfile: build in Node image, run in slim image for smaller final size (~200MB)
- Default port 3000 inside container -- standard Node.js convention
- Comprehensive env vars: PORT, DB_PATH, UPLOAD_DIR, MAX_IMAGE_SIZE, MAX_PAD_QUOTA, LOG_LEVEL -- flexibility for self-hosters
- Health check endpoint at /health -- useful for Docker, k8s, Portainer
- Run as non-root `padplus` user inside container -- security best practice
- Single `/data` volume mount containing both `padplus.db` and `uploads/` -- simplest for users
- `docker run -v padplus-data:/data -p 3000:3000 padplus` is the one-liner
- Container creates `/data` directory structure on first run if it doesn't exist
- Include both: simple `docker-compose.yml` (PadPlus + named volume) and optional `docker-compose.proxy.yml` with Caddy for automatic HTTPS
- Simple compose is the default -- `docker compose up` and done
- Proxy compose is opt-in for production deployments
- Minimal quick-start README: docker run one-liner, compose up, env vars reference
- The `docker run` one-liner should be copy-pasteable from the README -- zero thought required
- WebSocket must work through Docker (port mapping handles this, but verify)
- sharp needs platform-specific binaries -- Dockerfile must handle this correctly
- Playwright E2E tests required for verification

### Claude's Discretion
- Exact Node.js base image version (LTS)
- .dockerignore contents
- Caddy configuration details for the proxy compose
- Health check implementation (simple HTTP 200 vs DB ping)
- Whether to include a Makefile or just rely on compose
- Log format and level defaults

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Docker deployment with one-liner command | Multi-stage Dockerfile, docker-compose.yml, volume mapping for data persistence, ORIGIN env var for SvelteKit, health check endpoint, non-root user, deployment README |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker | 20.10+ | Container runtime | Universal container platform |
| node:22-bookworm | 22.x LTS | Build stage base image | Full Debian image with build tools for native modules (better-sqlite3, sharp) |
| node:22-bookworm-slim | 22.x LTS | Runtime base image | Minimal Debian with glibc; ~233MB; native module compatibility |
| Docker Compose | v2 | Multi-container orchestration | `docker compose` (v2 syntax, built into Docker Desktop) |
| Caddy | 2.x | Reverse proxy with auto-HTTPS | Zero-config TLS via Let's Encrypt; simpler than nginx/traefik for single-app deployments |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| .dockerignore | N/A | Exclude files from build context | Always -- reduces build context size and prevents secrets leaking |
| curl | (in slim image) | Health check probe | Dockerfile HEALTHCHECK instruction |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:22-bookworm-slim | node:22-alpine | ~90MB smaller but musl libc breaks better-sqlite3 and sharp prebuilt binaries; requires manual compilation toolchain |
| Caddy | nginx | More manual TLS config; no automatic certificate management |
| Named volumes | Bind mounts | Named volumes are Docker-managed and portable; bind mounts give direct host path control but are OS-dependent |

### Discretion Recommendations

**Node.js base image version:** Use `node:22-bookworm-slim` (not pinned to patch version). The `22` tag tracks the latest 22.x LTS release. Pinning to `22-bookworm-slim` locks the Debian release while allowing Node security patches. Currently resolves to Node 22.22.x.

**Health check implementation:** Use a simple HTTP 200 response from `/health`. A DB ping adds complexity with minimal benefit -- if the HTTP server is responding, the process is healthy. If SQLite (in-process, same thread) fails, the entire process fails anyway.

**Makefile:** Skip it. `docker compose up` is already one command. A Makefile adds a layer of indirection without value for this use case.

**Log format and level defaults:** Use plain text logging (not JSON) with LOG_LEVEL defaulting to `info`. JSON logging is for log aggregation pipelines; self-hosters reading `docker logs` want human-readable output.

## Architecture Patterns

### Recommended File Structure
```
project-root/
+-- Dockerfile              # Multi-stage build
+-- .dockerignore           # Exclude dev files from build context
+-- docker-compose.yml      # Simple: PadPlus + named volume
+-- docker-compose.proxy.yml # Optional: adds Caddy for HTTPS
+-- DEPLOY.md               # Quick-start deployment README
+-- src/routes/health/
|   +-- +server.ts          # Health check endpoint
+-- server/index.js         # Production entry (already exists)
```

### Pattern 1: Multi-Stage Build for Native Dependencies
**What:** Two-stage Dockerfile -- full image for `npm ci` + native compilation, slim image for runtime with only production artifacts.
**When to use:** Always when the app has native Node.js modules (better-sqlite3, sharp).
**Example:**
```dockerfile
# Source: Docker docs multi-stage + Snyk Node.js best practices
# Stage 1: Build
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm ci --omit=dev

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server
```

### Pattern 2: Non-Root User with Volume Ownership
**What:** Run as the built-in `node` user from the Node.js Docker image, but ensure the data directory is writable.
**When to use:** Always in production containers.
**Important note:** The CONTEXT.md specifies a `padplus` user. However, the `node` Docker images include a built-in `node` user (uid 1000). Creating a custom `padplus` user is equivalent but adds an extra step. Either approach works; the key is matching volume ownership.
**Example:**
```dockerfile
# Create data directory with correct ownership before switching user
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
```

### Pattern 3: Single Volume for All Persistence
**What:** Mount one volume at `/app/data` that contains both SQLite DB and uploads.
**Why it works:** The app already uses `./data/` as its persistence root (DB at `data/padplus.db`, uploads at `data/uploads/`). With WORKDIR `/app`, the relative path `./data/` resolves to `/app/data/`.
**Example:**
```yaml
# docker-compose.yml
services:
  padplus:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - padplus-data:/app/data
    environment:
      - ORIGIN=http://localhost:3000

volumes:
  padplus-data:
```

### Pattern 4: ORIGIN Environment Variable for SvelteKit
**What:** SvelteKit adapter-node requires `ORIGIN` for CSRF protection on form actions and server-side requests.
**Critical:** Without `ORIGIN`, form submissions return 403 "Cross-site POST form submissions are forbidden". This is a SvelteKit security feature, not a Docker issue.
**Default:** Set `ORIGIN=http://localhost:3000` in the Dockerfile ENV so it works out of the box. Users override for their domain.
**Example:**
```dockerfile
ENV ORIGIN=http://localhost:3000
ENV PORT=3000
ENV BODY_SIZE_LIMIT=10M
```

### Pattern 5: Caddy Reverse Proxy for Optional HTTPS
**What:** A separate compose file that adds Caddy in front of PadPlus for automatic TLS.
**When to use:** Production deployments with a domain name.
**Example:**
```yaml
# docker-compose.proxy.yml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - padplus

  padplus:
    environment:
      - ORIGIN=https://your-domain.com
      - PROTOCOL_HEADER=x-forwarded-proto
      - HOST_HEADER=x-forwarded-host

volumes:
  caddy-data:
  caddy-config:
```

With a minimal Caddyfile:
```
your-domain.com {
    reverse_proxy padplus:3000
}
```

Caddy automatically provisions TLS certificates from Let's Encrypt and handles WebSocket upgrade headers natively.

### Anti-Patterns to Avoid
- **Installing dev dependencies in runtime image:** Only copy production node_modules. Use `npm ci --omit=dev` in a separate step after building.
- **Running as root:** Always use USER directive. Root in containers = root on host if container escapes.
- **Using Alpine for native modules:** Alpine uses musl libc; better-sqlite3 and sharp require glibc prebuilt binaries or a full compilation toolchain.
- **Hardcoding paths:** Use environment variables (DB_PATH, PORT) not hardcoded paths in the Dockerfile.
- **Bind-mounting host `./data` in compose:** Use named volumes by default. Bind mounts have permission issues across OS/user combinations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS/HTTPS | Manual cert management scripts | Caddy auto-HTTPS | Let's Encrypt integration, auto-renewal, zero config |
| Health checks | Custom health check scripts | Docker HEALTHCHECK + curl | Native Docker integration, works with orchestrators |
| Process management | PM2/forever in container | Docker restart policy | One process per container; Docker handles restarts |
| Log rotation | Custom log rotation | Docker logging driver | `docker logs` handles this; `--log-opt max-size` for rotation |
| Build caching | Manual layer optimization | Docker BuildKit cache mounts | `--mount=type=cache,target=/root/.npm` for npm cache |

**Key insight:** Docker provides built-in solutions for process management, logging, restart policies, and health monitoring. Adding PM2, forever, or custom scripts inside the container is an anti-pattern that fights Docker's design.

## Common Pitfalls

### Pitfall 1: Missing ORIGIN Environment Variable
**What goes wrong:** All form submissions (including pad saves via form actions) return 403 "Cross-site POST form submissions are forbidden".
**Why it happens:** SvelteKit adapter-node enforces CSRF protection using the ORIGIN header. In Docker, the origin may differ from what the browser sends.
**How to avoid:** Set `ORIGIN=http://localhost:3000` as the default ENV in Dockerfile. Document that users must override this for their domain.
**Warning signs:** 403 errors on POST requests that work fine on GET.

### Pitfall 2: sharp Platform Mismatch
**What goes wrong:** `Error: Could not load the "sharp" module` or `linux-x64` binaries not found.
**Why it happens:** sharp bundles platform-specific prebuilt binaries. If `npm ci` runs on a different platform than the runtime (e.g., macOS build, Linux runtime), the wrong binaries are included.
**How to avoid:** Run `npm ci` inside the Docker build stage (same platform as runtime). Never copy `node_modules` from host into the container.
**Warning signs:** Image upload returns 500 errors while text operations work fine.

### Pitfall 3: SQLite WAL Files and Volume Boundaries
**What goes wrong:** Database corruption or "database is locked" errors after container restart.
**Why it happens:** SQLite WAL mode creates `-wal` and `-shm` companion files alongside the main `.db` file. All three must be on the same filesystem (volume).
**How to avoid:** Mount the entire `data/` directory as one volume. Never mount just the `.db` file -- the WAL files would be on the container's ephemeral layer.
**Warning signs:** Data loss after restart, "database disk image is malformed" errors.

### Pitfall 4: Volume Permission Denied
**What goes wrong:** Container fails to start with "SQLITE_CANTOPEN" or "EACCES" on the data directory.
**Why it happens:** The non-root user inside the container doesn't have write permission to the mounted volume. Docker named volumes are initialized with the correct permissions from the Dockerfile, but bind mounts inherit host permissions.
**How to avoid:** Create the `/app/data` directory and set ownership before switching to the non-root user in the Dockerfile. Document bind mount permission requirements.
**Warning signs:** Container starts but crashes immediately on first DB write.

### Pitfall 5: process.cwd() and WORKDIR Misalignment
**What goes wrong:** Image uploads write to the wrong path or images return 404.
**Why it happens:** The image upload paths in `images/+server.ts` and `images/[imageId]/+server.ts` use `path.join(process.cwd(), 'data', 'uploads', ...)`. If WORKDIR doesn't match where the volume is mounted, uploads go to the ephemeral container filesystem instead of the volume.
**How to avoid:** Set `WORKDIR /app` in the Dockerfile and mount the volume at `/app/data`. The `process.cwd()` returns `/app`, so `./data/` resolves to `/app/data/` which is the volume.
**Warning signs:** Images upload successfully but disappear after container restart.

### Pitfall 6: WebSocket Not Working Behind Reverse Proxy
**What goes wrong:** Real-time collaboration mode fails to connect.
**Why it happens:** Some reverse proxies don't forward WebSocket upgrade headers by default.
**How to avoid:** Direct Docker port mapping (no proxy) works out of the box. For the Caddy proxy compose, Caddy natively supports WebSocket forwarding -- no special configuration needed. Document this for users using other proxies (nginx requires explicit config).
**Warning signs:** HTTP requests work fine but WebSocket connections fail; connection dot never turns green.

### Pitfall 7: BODY_SIZE_LIMIT Not Set
**What goes wrong:** Image uploads over 512KB fail with 413 Payload Too Large.
**Why it happens:** SvelteKit adapter-node defaults BODY_SIZE_LIMIT to 512KB. The app needs 10MB for image uploads.
**How to avoid:** Set `BODY_SIZE_LIMIT=10M` as a default ENV in the Dockerfile (matching the existing `.env.example`).
**Warning signs:** Small images upload fine, larger images fail.

## Code Examples

Verified patterns from official sources and project codebase analysis:

### Complete Dockerfile
```dockerfile
# Source: Docker multi-stage build docs + Snyk Node.js best practices
# Stage 1: Build
FROM node:22-bookworm AS build
WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# Install curl for health check (slim image may not include it)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy production artifacts
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server

# Create data directory with correct ownership
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=http://localhost:3000
ENV BODY_SIZE_LIMIT=10M
ENV DB_PATH=./data/padplus.db

# Switch to non-root user
USER node

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server/index.js"]
```

### .dockerignore
```
node_modules
.git
.svelte-kit
build
data
test-results
tests
.planning
.env
.env.*
!.env.example
*.md
.vscode
playwright.config.ts
```

### Health Check Endpoint (src/routes/health/+server.ts)
```typescript
// Source: SvelteKit server routes + Docker health check best practices
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    return json({ status: 'ok' }, { status: 200 });
};
```

### docker-compose.yml
```yaml
# Source: Docker Compose v2 specification
services:
  padplus:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - padplus-data:/app/data
    environment:
      - ORIGIN=http://localhost:3000
    restart: unless-stopped

volumes:
  padplus-data:
```

### docker-compose.proxy.yml (Caddy HTTPS)
```yaml
# Usage: docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped
    depends_on:
      - padplus

  padplus:
    ports: !override []  # Remove direct port exposure
    environment:
      - ORIGIN=https://your-domain.com
      - PROTOCOL_HEADER=x-forwarded-proto
      - HOST_HEADER=x-forwarded-host

volumes:
  caddy-data:
  caddy-config:
```

### Caddyfile
```
{$PADPLUS_DOMAIN:localhost} {
    reverse_proxy padplus:3000
}
```

### DEPLOY.md (Quick-Start Structure)
```markdown
# Deploying PadPlus

## Quick Start (Docker)
docker run -v padplus-data:/app/data -p 3000:3000 padplus

## Docker Compose
docker compose up -d

## With HTTPS (Production)
1. Edit Caddyfile with your domain
2. docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| ORIGIN | http://localhost:3000 | App URL (for CSRF) |
| BODY_SIZE_LIMIT | 10M | Max upload size |
| DB_PATH | ./data/padplus.db | SQLite database path |
| LOG_LEVEL | info | Log verbosity |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker-compose` (v1, Python) | `docker compose` (v2, Go plugin) | Docker Compose v2, 2022 | Use `docker compose` (no hyphen) in all docs |
| Alpine for small images | Debian slim for native deps | Ongoing | ~90MB larger but avoids native module pain |
| `npm install --production` | `npm ci --omit=dev` | npm 8+ | `ci` is deterministic, `--omit=dev` replaces `--production` |
| Custom entrypoint scripts | Docker ENV + app defaults | Current best practice | Fewer moving parts; env vars override defaults |
| PM2 inside container | Direct `node` + Docker restart | Docker best practice | One process per container; Docker handles lifecycle |

**Deprecated/outdated:**
- `docker-compose` v1 (Python): Use `docker compose` v2 (built-in plugin)
- `npm install --production`: Use `npm ci --omit=dev`
- `node:lts-slim` without Debian codename: Pin to `node:22-bookworm-slim` for reproducibility

## Open Questions

1. **Volume path: `/data` vs `/app/data`**
   - What we know: CONTEXT.md says "single `/data` volume mount" with the one-liner `docker run -v padplus-data:/data`. But the app resolves paths from `process.cwd()` (WORKDIR `/app`), meaning `./data/` = `/app/data/`.
   - What's unclear: Whether to set WORKDIR to `/` (so `/data` works) or use `/app` (so `/app/data` works).
   - Recommendation: Use WORKDIR `/app` and mount volume at `/app/data`. This keeps the standard Node.js Docker convention. Update the one-liner to `docker run -v padplus-data:/app/data -p 3000:3000 padplus`. The alternative (symlinking `/data` to `/app/data`) adds complexity.

2. **Non-root user name: `padplus` vs `node`**
   - What we know: CONTEXT.md specifies a `padplus` user. Node.js Docker images include a built-in `node` user (uid 1000).
   - What's unclear: Whether the user cares about the specific name or just wants non-root execution.
   - Recommendation: Use the built-in `node` user. Creating a custom `padplus` user is extra work for identical security benefit. If the user specifically wants `padplus`, add `RUN groupadd -r padplus && useradd -r -g padplus padplus` before the USER directive.

3. **Upload path configurability**
   - What we know: DB_PATH is configurable via env var. Upload paths in `images/+server.ts` and `images/[imageId]/+server.ts` are hardcoded to `process.cwd() + 'data/uploads/'` -- not configurable via env var.
   - What's unclear: Whether to add UPLOAD_DIR env var support (CONTEXT.md lists it as a desired env var).
   - Recommendation: Add UPLOAD_DIR env var support to the image upload routes if the phase scope allows it. This is a small change (3 files) that significantly improves Docker flexibility. If not, document that uploads always go to `$CWD/data/uploads/`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.x |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/docker.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03a | Single command starts accessible app | e2e | `npx playwright test tests/docker.spec.ts -g "accessible after docker" --project=chromium` | No -- Wave 0 |
| INFRA-03b | Data persists across container restarts | e2e | `npx playwright test tests/docker.spec.ts -g "data persists" --project=chromium` | No -- Wave 0 |
| INFRA-03c | Health check endpoint responds | integration | `curl -f http://localhost:3000/health` | No -- Wave 0 |
| INFRA-03d | WebSocket works through Docker | e2e | `npx playwright test tests/docker.spec.ts -g "websocket" --project=chromium` | No -- Wave 0 |

**Note on Docker E2E tests:** These tests require a running Docker container rather than the dev server. The Playwright config's `webServer` block won't work for Docker tests. Two approaches:
1. **Script-based:** Shell script that builds image, starts container, runs Playwright against `localhost:3000`, then cleans up. Simple but not cross-platform.
2. **Manual verification:** Build and run the container manually, then run specific Playwright tests against the running container. More practical for a one-time deployment phase.

Recommendation: Use approach 1 with a `test-docker.sh` script. The CONTEXT.md mentions Playwright E2E tests as required.

### Sampling Rate
- **Per task commit:** `curl -f http://localhost:3000/health` (quick smoke test)
- **Per wave merge:** `npx playwright test --project=chromium` (full suite against Docker container)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/docker.spec.ts` -- covers INFRA-03a, INFRA-03b, INFRA-03d
- [ ] `src/routes/health/+server.ts` -- health check endpoint (INFRA-03c)
- [ ] `test-docker.sh` -- script to build, run container, execute tests, cleanup

## Sources

### Primary (HIGH confidence)
- [Docker multi-stage build docs](https://docs.docker.com/build/building/multi-stage/) -- Dockerfile multi-stage pattern
- [SvelteKit adapter-node docs](https://svelte.dev/docs/kit/adapter-node) -- ORIGIN, PORT, BODY_SIZE_LIMIT, HOST_HEADER, PROTOCOL_HEADER env vars
- [Snyk: Choosing Node.js Docker image](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) -- Alpine vs Debian slim, native module implications, image size comparisons
- [sharp installation docs](https://sharp.pixelplumbing.com/install/) -- Platform-specific binary requirements
- Project codebase analysis -- `process.cwd()` usage in db.ts, images/+server.ts, images/[imageId]/+server.ts, server/index.js

### Secondary (MEDIUM confidence)
- [Docker Hub node image](https://hub.docker.com/_/node) -- node:22-bookworm-slim tag availability (22.22.x as of March 2026)
- [Node.js releases](https://nodejs.org/en/about/previous-releases) -- Node 22 LTS status, Node 24 Active LTS
- [Docker health check best practices](https://thelinuxcode.com/docker-healthcheck-how-containers-tell-you-theyre-still-alive-and-what-to-do-when-they-dont/) -- HEALTHCHECK parameters
- [Caddy reverse proxy quick-start](https://caddyserver.com/docs/quick-starts/reverse-proxy) -- Caddy Docker + auto HTTPS pattern
- [better-sqlite3 Alpine discussion](https://github.com/WiseLibs/better-sqlite3/discussions/1270) -- Why Alpine is problematic for native SQLite bindings
- [sharp Alpine issue #3900](https://github.com/lovell/sharp/issues/3900) -- Prebuilt binary failures on musl/Alpine

### Tertiary (LOW confidence)
- Docker image size estimates (~200-250MB) -- based on Snyk article data, actual size depends on dependency tree

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Dockerfile patterns, base image choice, and native dependency constraints are well-documented and verified from multiple sources
- Architecture: HIGH -- Volume mounting, env var configuration, and multi-stage builds are standard Docker patterns; codebase paths confirmed via grep
- Pitfalls: HIGH -- Every pitfall is based on observed codebase patterns (process.cwd() usage, WAL files) or documented library constraints (sharp platform binaries, SvelteKit ORIGIN)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (Docker and Node.js LTS are stable; 30-day window appropriate)
