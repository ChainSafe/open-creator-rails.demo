/** Prefer static `import.meta.env.VITE_*` access so Vite always inlines env at build time. */
function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

export const appConfig = {
  rpcUrl: trimEnv(import.meta.env.VITE_RPC_URL) ?? 'http://127.0.0.1:8545',
  registryAddress: trimEnv(import.meta.env.VITE_REGISTRY_ADDRESS) as `0x${string}` | undefined,
  /** Always a non-empty URL so `OcrSdk` can attach `indexer` (empty env values must not become ""). */
  indexerUrl: trimEnv(import.meta.env.VITE_INDEXER_URL) ?? 'http://localhost:42069/graphql',
} as const
