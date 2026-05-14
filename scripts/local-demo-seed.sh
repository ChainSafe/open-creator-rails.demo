#!/usr/bin/env bash
set -euo pipefail

# Seeds a local Anvil chain with:
# - TestToken deployment (ERC20Permit)
# - One AssetRegistry
# - A few Assets
#
# Requirements:
# - anvil running on RPC_URL
# - foundry (cast, forge) + jq installed
#
# Usage:
#   ./scripts/local-demo-seed.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="$ROOT_DIR/open-creator-rails.sdk"
OCR_DIR="$SDK_DIR/open-creator-rails"
INDEXER_DIR="$ROOT_DIR/open-creator-rails.indexer"

# One-second subscription periods so integer "price" in this script behaves like wei per second.
SUBSCRIPTION_DURATION_SECONDS=1

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"

# Default Anvil private key #0
PRIVATE_KEY="${PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"

export RPC_URL PRIVATE_KEY

echo "Seeding local OCR demo…"
echo "RPC_URL=$RPC_URL"

pushd "$OCR_DIR" >/dev/null

echo "Initializing OCR submodules (contracts libs)…"
git submodule update --init --recursive

echo "Building contracts (Foundry)…"
forge build

registry_owner="$(cast wallet address --private-key "$PRIVATE_KEY")"

echo "Deploying TestToken (direct forge, without modifying submodule)…"
test_token_json="$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" src/TestToken.sol:TestToken --broadcast --json)"
token_address="$(echo "$test_token_json" | jq -r '.deployedTo')"
chain_id="$(cast chain-id --rpc-url "$RPC_URL")"

mkdir -p deployments
jq --arg chainId "$chain_id" --arg address "$token_address" \
  '.[$chainId] = $address' \
  deployments/token_addresses.json > /tmp/token_addresses.json 2>/dev/null || echo "{}" > /tmp/token_addresses.json

if [ "$(cat /tmp/token_addresses.json)" = "{}" ]; then
  echo "{}" > deployments/token_addresses.json
  jq --arg chainId "$chain_id" --arg address "$token_address" \
    '.[$chainId] = $address' \
    deployments/token_addresses.json > /tmp/token_addresses.json
fi
mv /tmp/token_addresses.json deployments/token_addresses.json

echo "TestToken: $token_address"

echo "Deploying AssetRegistry (direct forge)…"
# Constructor: registry fee share percent (0–100). Remainder goes to the asset creator.
registry_json="$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" src/AssetRegistry.sol:AssetRegistry --broadcast --json --constructor-args 20)"
registry_address="$(echo "$registry_json" | jq -r '.deployedTo')"

deployments_file="deployments/registries_${chain_id}.json"
if [ ! -f "$deployments_file" ]; then
  echo "[]" > "$deployments_file"
fi

jq --arg address "$registry_address" \
   --argjson registryFeeShare 20 \
   --arg owner "$registry_owner" \
   '. += [{address: $address, registryFeeShare: $registryFeeShare, owner: $owner, assets: []}]' \
   "$deployments_file" > /tmp/registries.json && mv /tmp/registries.json "$deployments_file"

echo "AssetRegistry: $registry_address"

echo ""
echo "To index these locally from this repo (without changing submodules):"
echo "  VITE_REGISTRY_ADDRESS=$registry_address PONDER_RPC_URL_31337=$RPC_URL \\"
echo "    pnpm -s exec ponder dev --root \"$INDEXER_DIR\" --config ../ponder.anvil.config.ts"

echo "Minting test tokens to registry owner: $registry_owner"
# mint 1,000,000 TEST with 6 decimals
cast send "$token_address" "mint(address,uint256)" "$registry_owner" 1000000000000 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

echo "Creating demo assets…"
create_asset() {
  local human_id="$1"
  local price_per_period="$2"
  local asset_id_hash
  asset_id_hash="$(cast keccak "$human_id")"

  receipt="$(cast send "$registry_address" "createAsset(bytes32,uint256,uint256,address,address)" "$asset_id_hash" "$price_per_period" "$SUBSCRIPTION_DURATION_SECONDS" "$token_address" "$registry_owner" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --json)"
  asset_address="$(echo "$receipt" | jq -r '.logs[0].address')"

  jq --argjson registryIndex 0 \
     --arg address "$asset_address" \
     --arg assetId "$human_id" \
     --arg assetIdHash "$asset_id_hash" \
     --argjson subscriptionPrice "$price_per_period" \
     --argjson subscriptionDuration "$SUBSCRIPTION_DURATION_SECONDS" \
     --arg tokenAddress "$token_address" \
     --arg owner "$registry_owner" \
     '.[$registryIndex].assets += [{address: $address, assetId: $assetId, assetIdHash: $assetIdHash, subscriptionPrice: $subscriptionPrice, subscriptionDuration: $subscriptionDuration, tokenAddress: $tokenAddress, owner: $owner}]' \
     "$deployments_file" > /tmp/registries_assets.json && mv /tmp/registries_assets.json "$deployments_file"

  echo "Asset: $asset_address (assetIdHash: $asset_id_hash)"
}

create_asset "demo_asset_1" 10
create_asset "demo_asset_2" 20
create_asset "demo_asset_3" 30

echo "Done. Start indexer in another terminal with:"
echo "  (cd \"$INDEXER_DIR\" && pnpm dev)"

popd >/dev/null
