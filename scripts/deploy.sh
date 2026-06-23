#!/usr/bin/env bash
set -euo pipefail

# deploy.sh — Polytopia Clone deploy script
#   Kills stale processes on port 3001, rebuilds, restarts systemd service.
#   Idempotent — safe to run multiple times.

PORT=3001
SERVICE="polytopia-clone"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM="npm"

echo "=== polytopia-clone deploy ==="
echo "Repo: $REPO_DIR"

# Step 1: Kill any process on port 3001 (stale or otherwise)
echo "--- Step 1: Checking port $PORT ---"
EXISTING_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$EXISTING_PIDS" ]; then
  echo "Killing process(es) on port $PORT: $EXISTING_PIDS"
  kill -TERM $EXISTING_PIDS 2>/dev/null || true
  sleep 1
  # Force kill if still alive
  STILL_ALIVE=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$STILL_ALIVE" ]; then
    echo "Force killing: $STILL_ALIVE"
    kill -KILL $STILL_ALIVE 2>/dev/null || true
    sleep 1
  fi
  echo "Port $PORT is free."
else
  echo "Port $PORT is already free."
fi

# Step 2: Build
echo "--- Step 2: Building ---"
cd "$REPO_DIR"
$NPM run build 2>&1

# Step 3: Restart systemd service
echo "--- Step 3: Restarting $SERVICE service ---"
systemctl --user daemon-reload 2>/dev/null || true
systemctl --user restart "$SERVICE"

# Step 4: Wait and verify
echo "--- Step 4: Verifying ---"
sleep 3

# Check service status
if systemctl --user is-active --quiet "$SERVICE"; then
  echo "✅ Service $SERVICE is active."
else
  echo "❌ Service $SERVICE is NOT active."
  systemctl --user status "$SERVICE" --no-pager | tail -10
  exit 1
fi

# Check port 3001 has exactly one node process
PROCESS_COUNT=$(ss -tlnp | grep ":$PORT " | grep -c "node" || true)
echo "Node processes on port $PORT: $PROCESS_COUNT"
if [ "$PROCESS_COUNT" -eq 1 ]; then
  echo "✅ Exactly one node process serving on port $PORT."
else
  echo "⚠️  Expected 1 node process, got $PROCESS_COUNT"
  ss -tlnp | grep ":$PORT " || echo "  (no processes found)"
fi

# Verify HTTP response
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:$PORT/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Site responds with HTTP 200."
else
  echo "⚠️  Site returned HTTP $HTTP_CODE (may be loading)"
fi

echo "=== Deploy complete ==="
