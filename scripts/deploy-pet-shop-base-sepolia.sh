#!/usr/bin/env bash
set -euo pipefail

export FOUNDRY_DISABLE_NIGHTLY_WARNING="${FOUNDRY_DISABLE_NIGHTLY_WARNING:-1}"

# Deploy OCR Pet Shop on Base Sepolia:
#   AssetRegistry + 21 pet assets priced in native USDC (5-minute period)
#
# Subscribers pay with Circle USDC on Base Sepolia — no custom TEST token deploy.
# Get test USDC: https://faucet.circle.com/ (select Base Sepolia)
#
# Asset ids match src/app/petShop/petCatalog.ts → pet_<slug>
# Labels live in scripts/pet-shop-asset-labels.txt
#
# Requirements:
#   - foundry (forge, cast, jq)
#   - DEPLOYER_PRIVATE_KEY (wallet funded with Base Sepolia ETH for gas)
#
# Usage:
#   DEPLOYER_PRIVATE_KEY=0x... ./scripts/deploy-pet-shop-base-sepolia.sh
#
# Optional env:
#   RPC_URL                  Base Sepolia RPC
#   USDC_ADDRESS             Payment token (default: Circle USDC on Base Sepolia)
#   REGISTRY_FEE_SHARE       Default 20
#   SUBSCRIPTION_DURATION    Period length in seconds (default: 300 = 5 minutes)
#   PERIOD_PRICE             Price per period in USDC atoms, 6 decimals (default: 100000 = $0.10)
#   DEPLOY_SLEEP             Seconds between asset txs (default: 4)
#   REGISTRY_ADDRESS         Resume: skip registry deploy, create missing assets only
#   START_BLOCK              Resume: indexer start block (default: captured at registry deploy)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$ROOT_DIR/.." && pwd)"
OCR_DIR="${OCR_DIR:-$WORKSPACE_DIR/open-creator-rails.sdk/open-creator-rails}"
LABELS_FILE="$ROOT_DIR/scripts/pet-shop-asset-labels.txt"
OUTPUT_DIR="$ROOT_DIR/scripts/deployments"

# Circle native USDC on Base Sepolia (6 decimals, EIP-2612 permit version "2")
DEFAULT_USDC="0x036CbD53842c5426634e7929541eC2318f3dCF7e"

if [ ! -d "$OCR_DIR/src" ]; then
  OCR_DIR="$WORKSPACE_DIR/open-creator-rails"
fi

if [ ! -d "$OCR_DIR/src" ]; then
  echo "ERROR: Contracts not found. Tried:"
  echo "  $WORKSPACE_DIR/open-creator-rails.sdk/open-creator-rails"
  echo "  $WORKSPACE_DIR/open-creator-rails"
  exit 1
fi

CHAIN_ID=84532
RPC_URL="${RPC_URL:-https://base-sepolia.core.chainstack.com/342e37eff7b6237ed3756cc511516c4d}"
PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY to a funded Base Sepolia wallet}"
USDC_ADDRESS="${USDC_ADDRESS:-$DEFAULT_USDC}"

REGISTRY_FEE_SHARE="${REGISTRY_FEE_SHARE:-20}"
SUBSCRIPTION_DURATION="${SUBSCRIPTION_DURATION:-300}"
PERIOD_PRICE="${PERIOD_PRICE:-100000}"
DEPLOY_SLEEP="${DEPLOY_SLEEP:-4}"
REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-}"
START_BLOCK="${START_BLOCK:-}"

cast_bool() {
  cast call "$@" --rpc-url "$RPC_URL" 2>/dev/null | tail -1 | tr -d '[:space:]'
}

cast_address() {
  cast call "$@" --rpc-url "$RPC_URL" 2>/dev/null | tail -1 | tr -d '[:space:]'
}

receipt_succeeded() {
  local status="${1//\"/}"
  case "$status" in
    1 | 0x1 | 0X1 | true) return 0 ;;
    0 | 0x0 | 0X0 | false) return 1 ;;
    *) return 2 ;;
  esac
}

wait_for_receipt() {
  local tx_hash="$1"
  local attempt receipt status result
  for attempt in $(seq 1 60); do
    if receipt="$(cast receipt "$tx_hash" --rpc-url "$RPC_URL" --json 2>/dev/null)"; then
      status="$(echo "$receipt" | jq -r '.status // empty')"
      result=2
      receipt_succeeded "$status" || result=$?
      if [ "$result" -eq 0 ]; then
        echo "$receipt"
        return 0
      fi
      if [ "$result" -eq 1 ]; then
        echo "ERROR: transaction reverted: $tx_hash" >&2
        return 1
      fi
    fi
    sleep 2
  done
  echo "ERROR: timed out waiting for receipt: $tx_hash" >&2
  return 1
}

asset_exists() {
  local asset_id_hash="$1"
  [ "$(cast_bool "$registry_address" "viewAsset(bytes32)(bool)" "$asset_id_hash")" = "true" ]
}

get_asset_address() {
  local asset_id_hash="$1"
  local attempt addr
  for attempt in $(seq 1 60); do
    addr="$(cast_address "$registry_address" "getAsset(bytes32)(address)" "$asset_id_hash")"
    if [ -n "$addr" ] && [ "$addr" != "0x0000000000000000000000000000000000000000" ]; then
      echo "$addr"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: getAsset timed out for id hash $asset_id_hash" >&2
  return 1
}

if [ ! -f "$LABELS_FILE" ]; then
  echo "ERROR: Missing $LABELS_FILE"
  exit 1
fi

if [ $((PERIOD_PRICE % 100)) -ne 0 ]; then
  echo "ERROR: PERIOD_PRICE must be a multiple of 100 (contract requirement). Got: $PERIOD_PRICE"
  exit 1
fi

ASSET_LABELS=()
while IFS= read -r line; do
  case "$line" in
    ''|\#*) continue ;;
    *) ASSET_LABELS+=("$line") ;;
  esac
done < "$LABELS_FILE"
if [ "${#ASSET_LABELS[@]}" -eq 0 ]; then
  echo "ERROR: No asset labels in $LABELS_FILE"
  exit 1
fi

usdc_human="$(awk "BEGIN { printf \"%.6f\", $PERIOD_PRICE/1000000 }")"

echo "═══════════════════════════════════════════════════════"
echo " OCR Pet Shop — Base Sepolia Deployment (USDC)"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Chain:                 Base Sepolia ($CHAIN_ID)"
echo "RPC:                   $RPC_URL"
echo "Contracts:             $OCR_DIR"
echo "Payment token:         USDC $USDC_ADDRESS"
echo "Pets:                  ${#ASSET_LABELS[@]}"
echo "Period:                ${SUBSCRIPTION_DURATION}s ($(awk "BEGIN { printf \"%.1f\", $SUBSCRIPTION_DURATION/60 }") min)"
echo "Price / period:        $PERIOD_PRICE atoms (\$$usdc_human USDC)"
echo ""

deployer_address="$(cast wallet address --private-key "$PRIVATE_KEY")"
echo "Deployer: $deployer_address"

balance="$(cast balance "$deployer_address" --rpc-url "$RPC_URL")"
echo "ETH balance: $balance wei"
echo ""

if [ "$balance" = "0" ]; then
  echo "ERROR: Deployer has no ETH for gas. Fund via https://www.alchemy.com/faucets/base-sepolia"
  exit 1
fi

echo "Verifying USDC contract…"
usdc_code="$(cast code "$USDC_ADDRESS" --rpc-url "$RPC_URL")"
if [ "$usdc_code" = "0x" ]; then
  echo "ERROR: No contract at USDC_ADDRESS=$USDC_ADDRESS"
  exit 1
fi
usdc_name="$(cast call "$USDC_ADDRESS" "name()(string)" --rpc-url "$RPC_URL")"
usdc_decimals="$(cast call "$USDC_ADDRESS" "decimals()(uint8)" --rpc-url "$RPC_URL")"
echo "       $usdc_name ($usdc_decimals decimals)"
echo ""

echo "[1/3] Building contracts…"
pushd "$OCR_DIR" >/dev/null
git submodule update --init --recursive 2>/dev/null || true
forge build --quiet

if [ -n "$REGISTRY_ADDRESS" ]; then
  registry_address="$REGISTRY_ADDRESS"
  start_block="${START_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"
  echo "       Resuming registry: $registry_address"
  echo "       startBlock: $start_block"
else
  start_block="$(cast block-number --rpc-url "$RPC_URL")"
  echo "       startBlock: $start_block"
  echo ""
  echo "[2/3] Deploying AssetRegistry (feeShare=${REGISTRY_FEE_SHARE}%)…"
  registry_json="$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
    src/AssetRegistry.sol:AssetRegistry --broadcast --json --timeout 120 \
    --constructor-args "$REGISTRY_FEE_SHARE")"
  registry_address="$(echo "$registry_json" | jq -r '.deployedTo')"
  registry_tx="$(echo "$registry_json" | jq -r '.transactionHash')"
  echo "       AssetRegistry: $registry_address"
  wait_for_receipt "$registry_tx" >/dev/null
fi
echo ""

echo "[3/3] Creating ${#ASSET_LABELS[@]} pet assets (USDC payments)…"

ASSETS_JSON='[]'
token_address="$USDC_ADDRESS"

create_asset() {
  local human_id="$1"
  local asset_id_hash
  asset_id_hash="$(cast keccak "$human_id")"

  local receipt tx_hash asset_address
  if asset_exists "$asset_id_hash"; then
    asset_address="$(get_asset_address "$asset_id_hash")"
    printf '       %-28s %s (existing)\n' "$human_id" "$asset_address"
  else
    echo "       creating ${human_id}..." >&2
    cast send "$registry_address" \
      "createAsset(bytes32,uint256,uint256,address,address)" \
      "$asset_id_hash" "$PERIOD_PRICE" "$SUBSCRIPTION_DURATION" "$token_address" "$deployer_address" \
      --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
      --confirmations 1 \
      --timeout 600 \
      >/dev/null 2>&1
    asset_address="$(get_asset_address "$asset_id_hash")"
    printf '       %-28s %s\n' "$human_id" "$asset_address"
    sleep "$DEPLOY_SLEEP"
  fi

  ASSETS_JSON="$(echo "$ASSETS_JSON" | jq \
    --arg id "$human_id" \
    --arg hash "$asset_id_hash" \
    --arg addr "$asset_address" \
    --argjson price "$PERIOD_PRICE" \
    --argjson duration "$SUBSCRIPTION_DURATION" \
    --arg token "$token_address" \
    --arg owner "$deployer_address" \
    '. + [{
      address: $addr,
      assetId: $id,
      assetIdHash: $hash,
      subscriptionPrice: $price,
      subscriptionDuration: $duration,
      tokenAddress: $token,
      owner: $owner
    }]')"
}

for label in "${ASSET_LABELS[@]}"; do
  create_asset "$label"
done

popd >/dev/null

mkdir -p "$OUTPUT_DIR"

deployment_json="$OUTPUT_DIR/pet-shop-${CHAIN_ID}.json"
cat > "$deployment_json" <<EOF
{
  "chainId": $CHAIN_ID,
  "network": "base-sepolia",
  "startBlock": $start_block,
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$deployer_address",
  "paymentToken": {
    "symbol": "USDC",
    "address": "$USDC_ADDRESS",
    "decimals": $usdc_decimals
  },
  "registry": "$registry_address",
  "registryFeeShare": $REGISTRY_FEE_SHARE,
  "subscriptionDuration": $SUBSCRIPTION_DURATION,
  "periodPrice": $PERIOD_PRICE,
  "assets": $(echo "$ASSETS_JSON" | jq '.')
}
EOF

indexer_config_dir="$ROOT_DIR/open-creator-rails.indexer/config/deployments"
if [ -d "$indexer_config_dir" ]; then
  indexer_file="$indexer_config_dir/registries_${CHAIN_ID}.json"
  jq -n \
    --arg addr "$registry_address" \
    --argjson fee "$REGISTRY_FEE_SHARE" \
    --arg owner "$deployer_address" \
    --argjson assets "$ASSETS_JSON" \
    '[{
      address: $addr,
      registryFeeShare: $fee,
      owner: $owner,
      assets: $assets
    }]' > "$indexer_file"
  echo ""
  echo "Wrote indexer config: $indexer_file"
fi

env_snippet="$OUTPUT_DIR/pet-shop-${CHAIN_ID}.env"
cat > "$env_snippet" <<EOF
# Paste into .env.pet-shop after redeploying the indexer from startBlock $start_block
VITE_PET_SHOP_DEMO=true
VITE_CHAIN=base-sepolia
VITE_RPC_URL=$RPC_URL
VITE_REGISTRY_ADDRESS=$registry_address
# VITE_INDEXER_URL=<your Railway indexer after redeploy>
EOF

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Deployment complete"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Registry:     $registry_address"
echo "USDC:         $USDC_ADDRESS"
echo "Start block:  $start_block"
echo "Deployment:   $deployment_json"
echo "Env snippet:  $env_snippet"
echo ""
echo "Subscription presets (UI):"
echo "  5 min  → 1 period  → \$$usdc_human USDC"
echo "  10 min → 2 periods → \$$(awk "BEGIN { printf \"%.6f\", 2*$PERIOD_PRICE/1000000 }") USDC"
echo "  1 hour → 12 periods → \$$(awk "BEGIN { printf \"%.6f\", 12*$PERIOD_PRICE/1000000 }") USDC"
echo ""
echo "Testers need Base Sepolia ETH (gas) + USDC:"
echo "  ETH:  https://www.alchemy.com/faucets/base-sepolia"
echo "  USDC: https://faucet.circle.com/ (select Base Sepolia)"
echo ""
echo "Next steps:"
echo "  1. Update indexer ponder startBlock to $start_block and registries_${CHAIN_ID}.json"
echo "  2. Redeploy Railway indexer"
echo "  3. Copy $env_snippet → .env.pet-shop (set VITE_INDEXER_URL)"
echo "  4. pnpm dev:pet-shop"
echo ""
