# Open Creator Rails Demo (Patreon-style)

This is a minimal Patreon-style demo app:
- **AssetRegistry** = the "creator backend"
- **Assets** = gated offerings created via the registry
- **Subscribers** = users who subscribe via a permit-based token payment (EIP-2612)
- **Mock API** = local service that returns a demo content URL only to subscribed users (reads `registries_*.json` for labels/URLs)

The UI is intentionally simple.

---

## Local development — complete setup

### Prerequisites
- Node.js v22+
- pnpm
- Foundry (`anvil`, `cast`, `forge`)
- `jq`

### Quick start

```bash
pnpm install:all
pnpm dev:local
```

`pnpm install:all` runs root `pnpm install` (workspace + SDK `postinstall` build) and then installs dependencies under `open-creator-rails.indexer`.

`pnpm dev:local` starts Anvil, seeds contracts, starts the indexer, launches the mock API, and opens the Vite dev server. Press Ctrl+C to stop everything.

When startup finishes, the terminal prints **two Anvil private keys** you can import into MetaMask (add network **Localhost 8545**, chain ID **31337**):

| Role | Address | Private key |
|------|---------|-------------|
| **Asset owner** — deploys contracts, owns the three demo assets, receives minted TEST | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Regular user** — same TEST mint as the owner (for subscribing as a non-owner) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

Both keys are well-known Anvil defaults; use them **only on local Anvil**, never on a public network. The seed script also prints these keys right after minting.

If you prefer to run each service manually (e.g. for debugging), follow the step-by-step instructions below.

### Overview

You will run **5 processes** in separate terminals:

| # | Process | Port | Purpose |
|---|---------|------|---------|
| 1 | Anvil | 8545 | Local EVM chain |
| 2 | Seed script | — | Deploys contracts + mints tokens (one-shot) |
| 3 | Ponder indexer | 42069 | Indexes on-chain events → GraphQL |
| 4 | Mock API | 4100 | Subscription check + demo gated URL |
| 5 | Vite dev server | 5173 | Frontend app |

---

### Step 1 — Install dependencies

```bash
pnpm install:all
```

This runs root `pnpm install` (see `pnpm-workspace.yaml`: the demo app and `open-creator-rails.sdk` are linked as a workspace; `postinstall` compiles the SDK to `dist/`) and then `pnpm install` in `open-creator-rails.indexer`.

For a **production build** of the demo UI after that: `pnpm build`. For ABI sync in the indexer: `pnpm -C open-creator-rails.indexer run setup` (requires Foundry in that package’s `open-creator-rails` submodule).

If you only need one side of the repo, you can run `pnpm install` at the root and/or `pnpm -C open-creator-rails.indexer install` separately.

---

### Step 2 — Start local chain (Anvil)

**Terminal 1:**

```bash
anvil --chain-id 31337 --port 8545
```

Leave it running. Anvil provides 10 pre-funded accounts; the seed script uses account #1 (`0x70997...`).

---

### Step 3 — Seed contracts + assets

**Terminal 2:**

```bash
./scripts/local-demo-seed.sh
```

This deploys:
- `TestToken` (ERC20Permit, 6 decimals)
- `AssetRegistry` (20% registry fee)
- 3 demo assets (`demo_asset_1`, `demo_asset_2`, `demo_asset_3`)
- Mints 1,000,000 TEST (6 decimals) to the **asset owner** (Anvil account #1) and the same amount to a **demo regular user** (Anvil account #2) for subscription flows

**Important — note the output.** It prints:
```
AssetRegistry: 0x<REGISTRY_ADDRESS>
Asset: 0x<ASSET_1_ADDRESS> (assetIdHash: 0x...)
Asset: 0x<ASSET_2_ADDRESS> (assetIdHash: 0x...)
Asset: 0x<ASSET_3_ADDRESS> (assetIdHash: 0x...)
```

It also prints **MetaMask-friendly private keys** for the asset owner and the demo regular user (see the Quick start table above).

The script writes all addresses into:
`open-creator-rails.sdk/open-creator-rails/deployments/registries_31337.json`

---

### Step 4 — Start the indexer

**Terminal 3:**

```bash
export VITE_REGISTRY_ADDRESS=0x<REGISTRY_ADDRESS_FROM_STEP_3>
export PONDER_RPC_URL_31337=http://127.0.0.1:8545
# Run from repo root: use indexer as the package root so hono and other indexer deps resolve.
pnpm -C ./open-creator-rails.indexer -s exec ponder dev \
  --root . \
  --config ../ponder.anvil.config.ts
```

Wait until it says indexing is complete. GraphQL is then available at `http://localhost:42069/graphql`.

**Verify** (optional):
```bash
curl -s http://localhost:42069/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ assetEntitys(limit: 10) { items { id assetId owner } } }"}'
```

**Troubleshooting:**
- If **`pnpm dev:local`** hangs on “Waiting for HTTP server”, tail the log: `tail -f open-creator-rails.indexer/.ponder/dev-local-ponder.log`. If you see **`Failed to load url hono`**, run **`pnpm install`** at the repo root (the demo declares `hono` / GraphQL packages so Ponder’s Vite can resolve them), then **`pnpm install:all`** again. If the log shows esbuild / native module errors, run **`pnpm approve-builds`**, then reinstall.
- If Ponder prints `Port in use`, note the actual port and update `VITE_INDEXER_URL` in `.env.anvil`.
- If you see `RuntimeError: Aborted()` from PGLite, delete the stale DB and restart:
  ```bash
  rm -rf ./open-creator-rails.indexer/.ponder
  ```

---

### Step 5 — Start the mock API

**Terminal 4:**

```bash
pnpm dev:mock-api
```

This starts a Node server on `http://localhost:4100` that:
1. Receives `GET /api/gated-urls?assetAddress=0x...&user=0x...`
2. Queries the Ponder indexer for an active subscription
3. If subscribed → returns `{ "name", "url" }`; if not → `403`

Names and URL paths for **seeded** demo assets come from `open-creator-rails.sdk/open-creator-rails/deployments/registries_<chainId>.json` (written by the seed script). Routes created from **Creator Console** call `POST /api/register-service`, which writes **`mock-api/services.json`** (gitignored): each key is a **lowercase asset contract address**, each value is **`{ "name", "url" }`** for the gated API response.

**Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/gated-urls?assetAddress=...&user=...` | Returns `{ "name", "url" }` if subscribed, else `403` |
| `GET /api/assets` | Lists merged metadata by asset address |
| `POST /api/register-service` | Body: `assetAddress`, `name`, `endpointUrl` — optional `assetIdHash` is logged only |
| `GET /api/health` | Health check |

**Environment variables** (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_API_PORT` | `4100` | Server port |
| `INDEXER_URL` | `http://localhost:42069/graphql` | Ponder GraphQL endpoint |
| `RPC_URL` | `http://127.0.0.1:8545` | JSON-RPC for on-chain subscription check when the indexer lags |
| `SUBSCRIBER_ID` | `demo` | Must match `DEMO_SUBSCRIBER_ID` in the frontend |
| `CHAIN_ID` | `31337` | Chain id used to pick `registries_<CHAIN_ID>.json` |

---

### Step 6 — Configure and run the frontend

**Update `.env.anvil`** with the registry address from step 3:

```bash
VITE_CHAIN=anvil
VITE_RPC_URL=http://127.0.0.1:8545
VITE_INDEXER_URL=http://localhost:42069/graphql
VITE_REGISTRY_ADDRESS=0x<REGISTRY_ADDRESS_FROM_STEP_3>
VITE_MOCK_API_URL=http://localhost:4100
```

**Terminal 5:**

```bash
pnpm dev:anvil
```

Open `http://localhost:5173` in your browser.

---

### Step 7 — Use the app

1. **Connect wallet** — use MetaMask with one of Anvil's default accounts (import private key `0xac0974...` or `0x59c699...`).
2. **Browse assets** — the Creator Profile page lists the 3 seeded assets.
3. **Subscribe** — navigate to an asset and subscribe (the permit flow approves + pays in one signature).
4. **See gated URLs** — once subscribed, the Asset page fetches from the mock API and displays the unlocked URLs.
5. **Cancel** — cancel your subscription; the gated URLs disappear (mock API returns `403`).

---

## Sepolia development

The repo also includes `.env.sepolia` for the hosted Sepolia demo configuration:

```bash
pnpm dev:sepolia
```

Edit `.env.sepolia` for different Sepolia RPC/indexer/registry settings.

---

## All scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:local` | **Start everything** (Anvil + seed + indexer + mock API + frontend) |
| `pnpm dev:anvil` | Frontend dev server (local Anvil) |
| `pnpm dev:sepolia` | Frontend dev server (Sepolia) |
| `pnpm dev:mock-api` | Mock API server (subscription-gated demo URL) |
| `pnpm build` / `pnpm build:anvil` / `pnpm build:sepolia` | Production builds |
| `pnpm lint` | ESLint |
| `pnpm preview` | Serve production build locally |
| `./scripts/local-demo-seed.sh` | Deploy contracts + seed data on Anvil |

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  Vite (5173) │     │   Anvil RPC (8545)  │
│  (React UI) │     └──────────────┘     └─────────────────────┘
│             │                                     │
│  subscribe ─┼───── ERC-2612 permit tx ───────────▶│
│             │                                     │
│  gated URLs─┼──▶ ┌─────────────────────┐         │
│             │    │ Mock API (4100)      │         │
└─────────────┘    │                     │         │
                   │  check subscription─┼──▶ ┌────┴────────────┐
                   │  return URLs        │    │ Ponder (42069)   │
                   └─────────────────────┘    │ (GraphQL indexer)│
                                              └─────────────────┘
```

1. **User subscribes** via the frontend (ERC-2612 permit → `AssetRegistry.subscribe`)
2. **Ponder** indexes the `SubscriptionAdded` event
3. **Frontend** calls the **mock API** with `assetAddress` + `user`
4. **Mock API** queries the indexer for an active subscription → returns gated URLs or `403`

---

## Project structure

```
├── mock-api/
│   ├── server.mjs                   # Local mock API (gated demo URL)
│   └── services.json                # Runtime: asset address → { name, url } (gitignored)
├── open-creator-rails.sdk/          # SDK submodule (contracts + TS client)
├── open-creator-rails.indexer/      # Ponder indexer submodule
├── scripts/
│   └── local-demo-seed.sh           # Deploys contracts on local Anvil
├── src/
│   └── app/                         # React frontend
├── .env.anvil                       # Local dev env vars
├── .env.sepolia                     # Sepolia env vars
└── ponder.anvil.config.ts           # Local Ponder config (chain 31337)
```
