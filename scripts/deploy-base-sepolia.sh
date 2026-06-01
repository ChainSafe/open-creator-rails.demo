#!/usr/bin/env bash
set -euo pipefail

# Deploys a fresh set of OCR contracts to Base Sepolia:
#   TestToken + AssetRegistry + demo Assets
#
# Requirements:
#   - foundry (forge, cast) installed
#   - DEPLOYER_PRIVATE_KEY env var set (funded with Base Sepolia ETH)
#   - RPC endpoint for Base Sepolia
#
# Usage:
#   DEPLOYER_PRIVATE_KEY=0x... ./scripts/deploy-base-sepolia.sh
#
# Output:
#   - Prints all deployed addresses
#   - Writes config/registries_84532.json for the indexer
#   - Prints the startBlock to use in ponder.config.ts

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$ROOT_DIR/.." && pwd)"
OCR_DIR="$WORKSPACE_DIR/open-creator-rails.sdk/open-creator-rails"

if [ ! -d "$OCR_DIR/src" ]; then
  echo "ERROR: Contracts not found at $OCR_DIR/src"
  echo "       Run: cd $OCR_DIR && git submodule update --init --recursive"
  exit 1
fi

CHAIN_ID=84532
RPC_URL="${RPC_URL:-https://base-sepolia.core.chainstack.com/342e37eff7b6237ed3756cc511516c4d}"
PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY to a funded Base Sepolia wallet}"

REGISTRY_FEE_SHARE=20
# Subscription duration: 30 days in seconds (realistic for demo)
SUBSCRIPTION_DURATION=$((30 * 24 * 60 * 60))

echo "═══════════════════════════════════════════════════════"
echo " Open Creator Rails — Base Sepolia Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Chain:    Base Sepolia ($CHAIN_ID)"
echo "RPC:      $RPC_URL"
echo ""

deployer_address="$(cast wallet address --private-key "$PRIVATE_KEY")"
echo "Deployer: $deployer_address"

balance="$(cast balance "$deployer_address" --rpc-url "$RPC_URL")"
echo "Balance:  $balance wei"
echo ""

if [ "$balance" = "0" ]; then
  echo "ERROR: Deployer has no ETH. Fund it via https://www.alchemy.com/faucets/base-sepolia"
  exit 1
fi

# ─── Build contracts ────────────────────────────────────────────────────────
echo "[1/4] Building contracts…"
pushd "$OCR_DIR" >/dev/null

git submodule update --init --recursive 2>/dev/null || true
forge build --quiet

# Record the current block before deploying (for startBlock)
start_block="$(cast block-number --rpc-url "$RPC_URL")"
echo "       Current block: $start_block (will use as startBlock)"
echo ""

# ─── Deploy TestToken ───────────────────────────────────────────────────────
echo "[2/4] Deploying TestToken…"
token_json="$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
  src/TestToken.sol:TestToken --broadcast --json --timeout 120)"
token_address="$(echo "$token_json" | jq -r '.deployedTo')"
echo "       TestToken: $token_address"
echo "       Waiting for confirmation…"
cast receipt "$( echo "$token_json" | jq -r '.transactionHash')" --rpc-url "$RPC_URL" >/dev/null 2>&1 || sleep 10
echo ""

# ─── Deploy AssetRegistry ───────────────────────────────────────────────────
echo "[3/4] Deploying AssetRegistry (feeShare=$REGISTRY_FEE_SHARE%)…"
registry_json="$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
  src/AssetRegistry.sol:AssetRegistry --broadcast --json --timeout 120 \
  --constructor-args "$REGISTRY_FEE_SHARE")"
registry_address="$(echo "$registry_json" | jq -r '.deployedTo')"
echo "       AssetRegistry: $registry_address"
echo "       Waiting for confirmation…"
cast receipt "$(echo "$registry_json" | jq -r '.transactionHash')" --rpc-url "$RPC_URL" >/dev/null 2>&1 || sleep 10
echo ""

# ─── Create demo assets ─────────────────────────────────────────────────────
echo "[4/4] Creating demo assets…"

create_asset() {
  local human_id="$1"
  local price="$2"
  local asset_id_hash
  asset_id_hash="$(cast keccak "$human_id")"

  local receipt
  receipt="$(cast send "$registry_address" \
    "createAsset(bytes32,uint256,uint256,address,address)" \
    "$asset_id_hash" "$price" "$SUBSCRIPTION_DURATION" "$token_address" "$deployer_address" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --json)"

  local asset_address
  asset_address="$(echo "$receipt" | jq -r '.logs[0].address')"
  echo "       Asset '$human_id': $asset_address (price: $price, hash: $asset_id_hash)"

  sleep 5
  echo "$asset_address"
}

ASSET_1="$(create_asset "weather_api" 5000000)"
ASSET_2="$(create_asset "stock_data_feed" 10000000)"
ASSET_3="$(create_asset "ai_image_gen" 15000000)"

popd >/dev/null

# ─── Write indexer config ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " Deployment Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Registry:     $registry_address"
echo "TestToken:    $token_address"
echo "Assets:       $ASSET_1, $ASSET_2, $ASSET_3"
echo "Start Block:  $start_block"
echo ""

INDEXER_CONFIG_DIR="$ROOT_DIR/open-creator-rails.indexer/config/deployments"
if [ -d "$INDEXER_CONFIG_DIR" ]; then
  config_file="$INDEXER_CONFIG_DIR/registries_${CHAIN_ID}.json"
  cat > "$config_file" <<EOF
[
  {
    "address": "$registry_address",
    "registryFeeShare": $REGISTRY_FEE_SHARE,
    "owner": "$deployer_address",
    "assets": [
      {
        "address": "$ASSET_1",
        "assetId": "weather_api",
        "assetIdHash": "$(cast keccak "weather_api")",
        "subscriptionPrice": 5000000,
        "subscriptionDuration": $SUBSCRIPTION_DURATION,
        "tokenAddress": "$token_address",
        "owner": "$deployer_address"
      },
      {
        "address": "$ASSET_2",
        "assetId": "stock_data_feed",
        "assetIdHash": "$(cast keccak "stock_data_feed")",
        "subscriptionPrice": 10000000,
        "subscriptionDuration": $SUBSCRIPTION_DURATION,
        "tokenAddress": "$token_address",
        "owner": "$deployer_address"
      },
      {
        "address": "$ASSET_3",
        "assetId": "ai_image_gen",
        "assetIdHash": "$(cast keccak "ai_image_gen")",
        "subscriptionPrice": 15000000,
        "subscriptionDuration": $SUBSCRIPTION_DURATION,
        "tokenAddress": "$token_address",
        "owner": "$deployer_address"
      }
    ]
  }
]
EOF
  echo "Wrote: $config_file"
else
  echo "NOTE: Indexer config dir not found at $INDEXER_CONFIG_DIR"
  echo "      Manually update registries_84532.json with the above addresses."
fi

echo ""
echo "───────────────────────────────────────────────────────"
echo " Next Steps:"
echo "───────────────────────────────────────────────────────"
echo ""
echo "1. Update ponder.config.ts startBlock for baseSepolia to: $start_block"
echo ""
echo "2. Set Railway env vars:"
echo "   VITE_REGISTRY_ADDRESS=$registry_address"
echo "   VITE_RPC_URL=$RPC_URL"
echo "   VITE_CHAIN=base-sepolia"
echo ""
echo "3. Tell Arun to redeploy the indexer with:"
echo "   - Updated registries_84532.json (written above)"
echo "   - startBlock: $start_block in ponder.config.ts"
echo "   - PONDER_RPC_URL_84532=$RPC_URL"
echo ""
echo "Done."
