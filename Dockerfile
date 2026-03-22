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

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy production artifacts
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server

# Create /data directory and symlink so ./data/ resolves to /data volume
# This enables: docker run -v padplus-data:/data -p 8462:8462 padplus
RUN mkdir -p /data/uploads && ln -s /data /app/data

# Create non-root padplus user
RUN groupadd -r padplus && useradd -r -g padplus -d /app padplus \
    && chown -R padplus:padplus /data /app

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8462
ENV ORIGIN=http://localhost:8462
ENV BODY_SIZE_LIMIT=10M
ENV DB_PATH=./data/padplus.db
ENV UPLOAD_DIR=./data/uploads

# Switch to non-root user
USER padplus

EXPOSE 8462

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8462/health || exit 1

CMD ["node", "server/index.js"]
