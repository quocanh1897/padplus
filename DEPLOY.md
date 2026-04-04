# Deploying PadPlus

## Quick Start (Docker Run)

```bash
docker run -d -v padplus-data:/data -p 8462:8462 padplus
```

Open [http://localhost:8462](http://localhost:8462) in your browser.

## Docker Compose

```bash
docker compose up -d
```

## With HTTPS (Production)

1. Edit `Caddyfile` -- replace `localhost` with your domain
2. Set `PADPLUS_DOMAIN` and `ORIGIN` in `docker-compose.proxy.yml`
3. Start with the proxy override:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
```

Caddy automatically provisions TLS certificates from Let's Encrypt.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8462` | Server port |
| `ORIGIN` | `http://localhost:8462` | App URL for CSRF protection. Must match your domain. |
| `BODY_SIZE_LIMIT` | `Infinity` | Max request body size (SvelteKit adapter-node limit) |
| `DB_PATH` | `./data/padplus.db` | SQLite database file path |
| `UPLOAD_DIR` | `./data/uploads` | Directory for uploaded images |
| `MAX_IMAGE_SIZE` | `5242880` | Max single image size in bytes (5MB) |
| `MAX_PAD_QUOTA` | `104857600` | Max total image storage per pad in bytes (100MB) |
| `MAX_FILE_SIZE` | `2147483648` | Max single file upload size in bytes (2GB) |
| `MAX_PAD_FILE_QUOTA` | `1073741824` | Max total file storage per pad in bytes (1GB) |
| `LOG_LEVEL` | `info` | Log verbosity |

## Data

All persistent data lives in a single `/data` volume:

- `padplus.db` -- SQLite database (with `-wal` and `-shm` companion files)
- `uploads/` -- Uploaded images organized by pad ID

**Important:** Never mount just the `.db` file. SQLite WAL mode requires the `-wal` and `-shm` files to be on the same filesystem. Always mount the entire `/data` directory.

### Backups

```bash
# Copy data out of the container
docker cp $(docker ps -q -f ancestor=padplus):/data ./backup

# Or if using named volumes
docker run --rm -v padplus-data:/data -v $(pwd):/backup alpine tar czf /backup/padplus-backup.tar.gz /data
```

## Updating

```bash
# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Building the Image

```bash
docker build -t padplus .
```

The image uses a multi-stage build (~200-250MB final size) and runs as a non-root `padplus` user.
