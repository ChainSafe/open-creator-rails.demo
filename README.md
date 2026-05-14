# Open Creator Rails Demo (Patreon-style)

This is a minimal Patreon-style demo app:
- **AssetRegistry** = the “creator backend”
- **Assets** = gated offerings created via the registry
- **Subscribers** = users who subscribe via a permit-based token payment (EIP-2612)

The UI is intentionally simple.

## Local development (populated Anvil + indexer)

### Prerequisites
- Node.js v22+
- pnpm
- Foundry (`anvil`, `cast`, `forge`)
- `jq`

### 1) Install dependencies
```bash
pnpm install --no-frozen-lockfile
```

### 2) Start local chain (Anvil)
```bash
anvil --chain-id 31337 --port 8545
```

### 3) Seed demo contracts + assets (populates the chain)
In a new terminal:
```bash
./scripts/local-demo-seed.sh
```

This deploys:
- `TestToken` (ERC20Permit, 6 decimals)
- `AssetRegistry`
- 3 demo assets
- mints test tokens to the default Anvil account

Note: the seed script deploys with Foundry and writes addresses into
`open-creator-rails.sdk/open-creator-rails/deployments/` (see that repo’s README for the JSON layout).

### 4) Start the indexer (Anvil local indexing)
After the chain is seeded, start the indexer so it can ingest the deployments/events and power the UI lists:
- **Creator (Registry) page** asset list
- **Your Assets** list
- **Your Subscriptions** list

This repo includes a local Anvil Ponder config (`ponder.anvil.config.ts`) so you don’t need to modify the submodule’s Sepolia-only config.

Install the indexer’s dependencies once (from this repo root):

```bash
pnpm -C open-creator-rails.indexer install
```

In a new terminal, run this exactly (replace the registry address with the one printed by the seed script):
```bash
export VITE_REGISTRY_ADDRESS=0x71C95911E9a5D330f4D621842EC243EE1343292e
export PONDER_RPC_URL_31337=http://127.0.0.1:8545
INDEXER_ROOT="./open-creator-rails.indexer"
pnpm -s exec ponder dev \
  --root "$INDEXER_ROOT" \
  --config ../ponder.anvil.config.ts
```

That command is the **Anvil indexer**. It will print logs for chain `31337` and start GraphQL on `http://localhost:42069/graphql`.

Verify indexing (in another terminal) — Ponder exposes the list field as `assetEntitys` (note the spelling):
```bash
curl -s http://localhost:42069/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"query { assetEntitys(limit: 1000) { items { id assetId registryAddress owner } } }"}'
```

The demo lists assets via `@open-creator-rails/sdk` (`OcrSdk.indexer.listAssetsByRegistry`) and subscriptions via `indexer.listSubscriptionsByUser`, which use the same GraphQL API.

The indexer GraphQL will be available at `http://localhost:42069/graphql`.

If Ponder prints `Port in use` and starts on a different port (e.g. `42070`), use the port it prints and set:
`VITE_INDEXER_URL=http://localhost:<port>/graphql`.

Troubleshooting:
- **`RuntimeError: Aborted()` from `@electric-sql/pglite` / `InitWalRecovery` / `pg_initdb`:** Ponder’s embedded DB (PGLite) did not finish starting—often **corrupted or stale files** under `.ponder` after a crash, killed process, or upgrade. The UI can sit at **“Indexing … 0%”** forever because **backfill never begins** until the DB opens. **Stop Ponder**, delete the dev DB, then start again:

```bash
rm -rf ./open-creator-rails.indexer/.ponder
```

Then re-run the indexer `ponder dev` command above.

### 5) Configure the frontend
Create a `.env.anvil` in this repo root, or update the one already checked in:
```bash
VITE_CHAIN=anvil
VITE_RPC_URL=http://127.0.0.1:8545
VITE_INDEXER_URL=http://localhost:42069/graphql
VITE_REGISTRY_ADDRESS=0xYourRegistryAddress
```

To get the registry address, use the output from `./scripts/local-demo-seed.sh` (it prints the `AssetRegistry: 0x...` line).

`VITE_WALLETCONNECT_PROJECT_ID` is optional. If omitted, the demo still works with injected wallets (MetaMask).

### 6) Run the app
```bash
pnpm dev:anvil
```

## Sepolia development

The repo also includes `.env.sepolia` for the hosted Sepolia demo configuration. Run:

```bash
pnpm dev:sepolia
```

If you need different Sepolia RPC/indexer/registry settings, edit `.env.sepolia` instead of changing the local Anvil file.

## Scripts
- `./scripts/local-demo-seed.sh`: deploys and seeds local Anvil with a registry + assets.

## Useful commands
```bash
pnpm build
pnpm build:anvil
pnpm build:sepolia
pnpm lint
pnpm preview
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
