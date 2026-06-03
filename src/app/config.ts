import { getAddress, isHex } from 'viem'
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

/**
 * TestToken from `scripts/local-demo-seed.sh` (Anvil account #1 deployer, contract nonce 0).
 * Overridden by `VITE_TOKEN_ADDRESS` when set (e.g. `dev-local.sh` writes the live deploy address).
 */
export const ANVIL_DEFAULT_TOKEN_ADDRESS =
  '0x8464135c8F25Da09e49BC8782676a84730C318bC' as const

/** Normalizes env hex (e.g. `0X…` from copy-paste) to a checksummed address. */
function normalizeEnvAddress(value: string | undefined): `0x${string}` | undefined {
  const trimmed = trimEnv(value)
  if (!trimmed) return undefined
  const hex = trimmed.startsWith('0X') ? `0x${trimmed.slice(2)}` : trimmed
  if (!isHex(hex, { strict: false }) || hex.length !== 42) return undefined
  try {
    return getAddress(hex)
  } catch {
    return undefined
  }
}

function resolveTokenAddress(): `0x${string}` | undefined {
  const fromEnv = normalizeEnvAddress(import.meta.env.VITE_TOKEN_ADDRESS)
  if (fromEnv) return fromEnv
  if (chainKey === 'anvil') return ANVIL_DEFAULT_TOKEN_ADDRESS
  return undefined
}

export const appConfig = {
  chainKey,
  chain,
  rpcUrl:
    trimEnv(import.meta.env.VITE_RPC_URL) ??
    (chainKey === 'sepolia' ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545'),
  registryAddress: normalizeEnvAddress(import.meta.env.VITE_REGISTRY_ADDRESS),
  /** ERC-20 (permit) used when registry owner creates assets in Admin Console. */
  tokenAddress: resolveTokenAddress(),
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
  demoTransferOwnerAddress: normalizeEnvAddress(import.meta.env.VITE_DEMO_TRANSFER_OWNER_ADDRESS),
} as const
