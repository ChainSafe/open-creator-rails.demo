import { appConfig } from './config'

/** Block explorer base URL for the configured chain, if any. */
export function blockExplorerBaseUrl(): string | null {
  const custom = import.meta.env.VITE_BLOCK_EXPLORER_URL as string | undefined
  if (custom?.trim()) return custom.trim().replace(/\/$/, '')

  if (appConfig.chainKey === 'sepolia') return 'https://sepolia.etherscan.io'
  return null
}

export function blockExplorerAddressUrl(address: string): string | null {
  const base = blockExplorerBaseUrl()
  if (!base) return null
  return `${base}/address/${address}`
}
