import { anvil, sepolia } from 'viem/chains'

/** Prefer static `import.meta.env.VITE_*` access so Vite always inlines env at build time. */
function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

function resolveChainKey() {
  const chain = trimEnv(import.meta.env.VITE_CHAIN)?.toLowerCase()
  return chain === 'sepolia' ? 'sepolia' : 'anvil'
}

const chainKey = resolveChainKey()
const chain = chainKey === 'sepolia' ? sepolia : anvil

export const appConfig = {
  chainKey,
  chain,
  rpcUrl:
    trimEnv(import.meta.env.VITE_RPC_URL) ??
    (chainKey === 'sepolia' ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545'),
  registryAddress: trimEnv(import.meta.env.VITE_REGISTRY_ADDRESS) as `0x${string}` | undefined,
  /** Always a non-empty URL so `OcrSdk` can attach `indexer` (empty env values must not become ""). */
  indexerUrl:
    trimEnv(import.meta.env.VITE_INDEXER_URL) ??
    (chainKey === 'sepolia' ? 'https://indexer-api-production-c33d.up.railway.app/' : 'http://localhost:42069/graphql'),
  mockApiUrl: trimEnv(import.meta.env.VITE_MOCK_API_URL) ?? 'http://localhost:4100',
  /** Optional: Google Sheet “Publish to web” CSV URL — read creator profiles by asset address. */
  demoServicesSheetUrl: trimEnv(import.meta.env.VITE_DEMO_SERVICES_SHEET_URL),
  /** Optional: Apps Script web app URL — append/update rows (see examples/google-apps-script-demo-services-append.gs). */
  demoServicesSheetWriteUrl: trimEnv(import.meta.env.VITE_DEMO_SERVICES_SHEET_WRITE_URL),
  /** Local dev: Anvil account #3 — pre-filled as Add Creator asset owner (transfer demo). */
  demoTransferOwnerAddress: trimEnv(import.meta.env.VITE_DEMO_TRANSFER_OWNER_ADDRESS) as
    | `0x${string}`
    | undefined,
} as const
