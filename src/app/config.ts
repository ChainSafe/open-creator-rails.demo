import { anvil, baseSepolia, sepolia } from 'viem/chains'

/** Prefer static `import.meta.env.VITE_*` access so Vite always inlines env at build time. */
function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

type ChainKey = 'anvil' | 'sepolia' | 'base-sepolia'

function resolveChainKey(): ChainKey {
  const raw = trimEnv(import.meta.env.VITE_CHAIN)?.toLowerCase()
  if (raw === 'sepolia') return 'sepolia'
  if (raw === 'base-sepolia') return 'base-sepolia'
  return 'anvil'
}

const chainKey = resolveChainKey()

const chainMap = {
  anvil,
  sepolia,
  'base-sepolia': baseSepolia,
} as const

const chain = chainMap[chainKey]

const defaultRpcUrls: Record<ChainKey, string> = {
  anvil: 'http://127.0.0.1:8545',
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  'base-sepolia': 'https://base-sepolia-rpc.publicnode.com',
}

const defaultIndexerUrls: Record<ChainKey, string> = {
  anvil: 'http://localhost:42069/graphql',
  sepolia: 'https://indexer-api-production-c33d.up.railway.app/',
  'base-sepolia': 'https://indexer-api-production-c33d.up.railway.app/',
}

export const appConfig = {
  chainKey,
  chain,
  rpcUrl: trimEnv(import.meta.env.VITE_RPC_URL) ?? defaultRpcUrls[chainKey],
  registryAddress: trimEnv(import.meta.env.VITE_REGISTRY_ADDRESS) as `0x${string}` | undefined,
  indexerUrl: trimEnv(import.meta.env.VITE_INDEXER_URL) ?? defaultIndexerUrls[chainKey],
  mockApiUrl: trimEnv(import.meta.env.VITE_MOCK_API_URL) ?? 'http://localhost:4100',
} as const
