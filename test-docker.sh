#!/usr/bin/env bash
set -e

CONTAINER="padplus-e2e-test"
PORT=3198
IMAGE="padplus-e2e"

cleanup() {
  echo "[test-docker] Cleaning up..."
  docker stop "$CONTAINER" 2>/dev/null || true
  docker rm "$CONTAINER" 2>/dev/null || true
}

trap cleanup EXIT

echo "[test-docker] Building Docker image: $IMAGE"
docker build -t "$IMAGE" .

echo "[test-docker] Starting container: $CONTAINER on port $PORT"
docker run -d --name "$CONTAINER" -p "$PORT:3000" "$IMAGE"

echo "[test-docker] Waiting for health check (up to 30s)..."
elapsed=0
until curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; do
  if [ "$elapsed" -ge 30 ]; then
    echo "[test-docker] ERROR: Health check timed out after 30s"
    docker logs "$CONTAINER"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "[test-docker] Health check passed after ${elapsed}s"

echo "[test-docker] Running Playwright tests..."
DOCKER_TEST_URL="http://localhost:$PORT" npx playwright test tests/docker.spec.ts --project=chromium

echo "[test-docker] All tests passed!"
