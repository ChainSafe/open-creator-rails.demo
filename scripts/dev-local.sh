#!/usr/bin/env bash
set -euo pipefail

# Starts the full local development environment in one command:
#   Anvil → seed → indexer → mock API → Vite
#
# Usage:
#   ./scripts/dev-local.sh
#   pnpm dev:local

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"
INDEXER_PORT="${INDEXER_PORT:-42069}"
MOCK_API_PORT="${MOCK_API_PORT:-4100}"

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

echo "═══════════════════════════════════════════════════════"
echo " Open Creator Rails — Local Dev Environment"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── 1. Start Anvil ──────────────────────────────────────────────────────────
echo "[1/5] Starting Anvil on port $ANVIL_PORT…"
anvil --chain-id 31337 --port "$ANVIL_PORT" &>/dev/null &
PIDS+=($!)

echo "       Waiting for Anvil to be ready…"
for i in $(seq 1 30); do
  if cast chain-id --rpc-url "$RPC_URL" &>/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Anvil did not start within 15s"
    exit 1
  fi
  sleep 0.5
done
echo "       Anvil ready ✓"
echo ""

# ─── 2. Seed contracts ───────────────────────────────────────────────────────
echo "[2/5] Seeding contracts (TestToken + AssetRegistry + 3 assets)…"
SEED_OUTPUT="$(./scripts/local-demo-seed.sh 2>&1)"

REGISTRY_ADDRESS="$(echo "$SEED_OUTPUT" | grep '^AssetRegistry:' | awk '{print $2}')"
if [ -z "$REGISTRY_ADDRESS" ]; then
  echo "ERROR: Could not parse registry address from seed output."
  echo "$SEED_OUTPUT"
  exit 1
fi

pick_seed_var() {
  local name="$1"
  echo "$SEED_OUTPUT" | grep "^${name}=" | tail -1 | cut -d= -f2-
}

DEMO_ASSET_OWNER_ADDRESS="$(pick_seed_var SEED_DEMO_ASSET_OWNER_ADDRESS)"
DEMO_ASSET_OWNER_PRIVATE_KEY="$(pick_seed_var SEED_DEMO_ASSET_OWNER_PRIVATE_KEY)"
DEMO_USER_ADDRESS="$(pick_seed_var SEED_DEMO_USER_ADDRESS)"
DEMO_USER_PRIVATE_KEY="$(pick_seed_var SEED_DEMO_USER_PRIVATE_KEY)"
DEMO_TRANSFER_OWNER_ADDRESS="$(pick_seed_var SEED_DEMO_TRANSFER_OWNER_ADDRESS)"
DEMO_TRANSFER_OWNER_PRIVATE_KEY="$(pick_seed_var SEED_DEMO_TRANSFER_OWNER_PRIVATE_KEY)"

echo "       Registry: $REGISTRY_ADDRESS"
echo "       Seed complete ✓"
echo ""

# ─── 3. Write .env.anvil ─────────────────────────────────────────────────────
cat > "$ROOT_DIR/.env.anvil" <<EOF
VITE_CHAIN=anvil
VITE_RPC_URL=$RPC_URL
VITE_INDEXER_URL=http://localhost:$INDEXER_PORT/graphql
VITE_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
VITE_MOCK_API_URL=http://localhost:$MOCK_API_PORT
VITE_DEMO_TRANSFER_OWNER_ADDRESS=$DEMO_TRANSFER_OWNER_ADDRESS
EOF
echo "       .env.anvil written ✓"
echo ""

# ─── 4. Start indexer ────────────────────────────────────────────────────────
echo "[3/5] Starting Ponder indexer on port $INDEXER_PORT…"
PONDER_LOG="$ROOT_DIR/open-creator-rails.indexer/.ponder/dev-local-ponder.log"
mkdir -p "$(dirname "$PONDER_LOG")"
: >"$PONDER_LOG"
# Run Ponder with indexer cwd + root. Ponder's dev server uses Vite from the repo
# root graph; `hono` / GraphQL deps are also declared at the demo root so resolution works.
(
  cd "$ROOT_DIR/open-creator-rails.indexer" || exit 1
  export VITE_REGISTRY_ADDRESS="$REGISTRY_ADDRESS"
  export PONDER_RPC_URL_31337="$RPC_URL"
  pnpm exec ponder dev \
    --root . \
    --config ../ponder.anvil.config.ts \
    --disable-ui
) >>"$PONDER_LOG" 2>&1 &
PONDER_PID=$!
PIDS+=("$PONDER_PID")

echo "       Waiting for HTTP server (/health; first build can take 1–2 min)…"
echo "       Ponder log: $PONDER_LOG"
for i in $(seq 1 120); do
  if ! kill -0 "$PONDER_PID" 2>/dev/null; then
    echo "ERROR: Ponder exited before the server came up. Last log lines:"
    tail -60 "$PONDER_LOG" 2>/dev/null || true
    echo ""
    echo "       Common fixes: run pnpm approve-builds (esbuild), then pnpm install again;"
    echo "       or rm -rf ./open-creator-rails.indexer/.ponder and retry."
    exit 1
  fi
  # Ponder serves /health as soon as the dev HTTP server is listening (before GraphQL backfill).
  if curl -sf "http://127.0.0.1:$INDEXER_PORT/health" &>/dev/null; then
    break
  fi
  if [ "$i" -eq 120 ]; then
    echo "ERROR: Indexer did not open port $INDEXER_PORT within 120s"
    tail -60 "$PONDER_LOG" 2>/dev/null || true
    echo "       Try: rm -rf ./open-creator-rails.indexer/.ponder"
    exit 1
  fi
  sleep 1
done
echo "       Indexer ready at http://localhost:$INDEXER_PORT/graphql ✓"
echo ""

# ─── 5. Start mock API ───────────────────────────────────────────────────────
echo "[4/5] Starting mock API on port $MOCK_API_PORT…"
SERVICES_JSON="$ROOT_DIR/mock-api/services.json"
if [ ! -f "$SERVICES_JSON" ] || [ ! -w "$SERVICES_JSON" ]; then
  rm -f "$SERVICES_JSON" 2>/dev/null
  echo '{}' > "$SERVICES_JSON"
fi
MOCK_API_PORT="$MOCK_API_PORT" \
INDEXER_URL="http://localhost:$INDEXER_PORT/graphql" \
RPC_URL="$RPC_URL" \
node mock-api/server.mjs &>/dev/null &
PIDS+=($!)

sleep 1
if curl -sf "http://localhost:$MOCK_API_PORT/api/health" &>/dev/null; then
  echo "       Mock API ready at http://localhost:$MOCK_API_PORT ✓"
else
  echo "       WARNING: Mock API may not have started correctly"
fi
echo ""

# ─── 6. Start Vite ───────────────────────────────────────────────────────────
echo "[5/5] Starting Vite dev server…"
echo ""
echo "═══════════════════════════════════════════════════════"
echo " All services running:"
echo "   Anvil:      http://127.0.0.1:$ANVIL_PORT"
echo "   Indexer:    http://localhost:$INDEXER_PORT/graphql"
echo "   Mock API:   http://localhost:$MOCK_API_PORT"
echo "   Frontend:   http://localhost:5173"
echo ""
echo "   Registry:   $REGISTRY_ADDRESS"
echo ""
if [ -n "$DEMO_ASSET_OWNER_PRIVATE_KEY" ] && [ -n "$DEMO_USER_PRIVATE_KEY" ]; then
  echo "───────────────────────────────────────────────────────"
  echo " MetaMask (Localhost 8545, chain ID 31337)"
  echo " Copy a private key below to import an account."
  echo "───────────────────────────────────────────────────────"
  echo ""
  echo "  Asset owner (owns demo assets; has TEST):"
  echo "    Private key: $DEMO_ASSET_OWNER_PRIVATE_KEY"
  echo "    Address:     $DEMO_ASSET_OWNER_ADDRESS"
  echo ""
  echo "  Regular user (TEST minted for subscriptions):"
  echo "    Private key: $DEMO_USER_PRIVATE_KEY"
  echo "    Address:     $DEMO_USER_ADDRESS"
  echo ""
  echo "  Transfer owner demo (Add Creator asset owner / transfer target):"
  echo "    Private key: $DEMO_TRANSFER_OWNER_PRIVATE_KEY"
  echo "    Address:     $DEMO_TRANSFER_OWNER_ADDRESS"
  echo ""
  echo "───────────────────────────────────────────────────────"
else
  echo " NOTE: Could not parse demo wallet keys from seed output."
  echo "       Run ./scripts/local-demo-seed.sh alone to see keys."
  echo ""
fi
echo " Press Ctrl+C to stop everything."
echo "═══════════════════════════════════════════════════════"
echo ""

pnpm dev:anvil
