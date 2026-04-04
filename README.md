# PadPlus

A speed-first, self-hosted notepad. Navigate to any URL and start typing — text loads before JavaScript, images paste from clipboard, and multiple users can edit together in real time.

Built to replace Etherpad and Dontpad with something faster, prettier, and easier to deploy.

## Features

**Instant text** — Content renders server-side. The page is readable before JavaScript finishes loading.

**Image paste** — Copy an image, paste it into a pad. Images are optimized to WebP, lazy-loaded, and never block text rendering. Drag to reorder, click to enlarge.

**Three collaboration modes** per pad:
- **Last-save-wins** — Simple and fast. Version conflicts show a warning banner.
- **Auto-merge** — Concurrent edits to different sections are merged automatically using three-way diff.
- **Real-time** — Live keystroke sync via WebSocket with Yjs CRDT. Handles disconnects gracefully.

**Zero friction** — No accounts, no signup. Every URL path is a pad. Navigate to `/meeting-notes` and it exists.

**Self-hosted** — Single Docker command. SQLite database, local filesystem for images, no external dependencies.

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

Or without Compose:

```bash
docker build -t padplus .
docker run -d -v padplus-data:/data -p 3000:3000 padplus
```

### From Source

```bash
npm install
npm run build
npm start
```

The app runs at `http://localhost:3000`. Data is stored in `./data/`.

### Development

```bash
npm install
npm run dev
```

Dev server at `http://localhost:5173` with hot reload and WebSocket support.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ORIGIN` | `http://localhost:3000` | App URL (for CSRF protection) |
| `DB_PATH` | `./data/padplus.db` | SQLite database file path |
| `UPLOAD_DIR` | `./data/uploads` | Image storage directory |
| `BODY_SIZE_LIMIT` | `Infinity` | Max request body size |
| `MAX_FILE_SIZE` | `2147483648` | Max single file upload size in bytes (2GB) |

See [DEPLOY.md](DEPLOY.md) for full deployment docs including HTTPS setup with Caddy, backup instructions, and all environment variables.

## Tech Stack

- [SvelteKit](https://svelte.dev/docs/kit) with SSR via adapter-node
- [Svelte 5](https://svelte.dev) with runes
- [SQLite](https://www.sqlite.org/) (better-sqlite3, WAL mode)
- [Yjs](https://yjs.dev/) + y-websocket for real-time collaboration
- [sharp](https://sharp.pixelplumbing.com/) for image optimization
- [node-diff3](https://github.com/bhousel/node-diff3) for three-way merge
- [Playwright](https://playwright.dev/) for E2E testing

## License

MIT
