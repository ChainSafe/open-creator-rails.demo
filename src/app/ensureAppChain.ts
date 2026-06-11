import type { WalletClient } from 'viem'
import { UserRejectedRequestError } from 'viem'

import { appConfig } from './config'

function errorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  if ('code' in error && typeof (error as { code: unknown }).code === 'number') {
    return (error as { code: number }).code
  }
  return undefined
}

export function isWalletUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  const code = errorCode(error)
  return code === 4001
}

/** Chain metadata for `wallet_addEthereumChain` (uses app RPC URL). */
function appChainForWallet() {
  return {
    ...appConfig.chain,
    rpcUrls: {
      default: { http: [appConfig.rpcUrl] },
    },
  } as const
}

/**
 * Ensures the injected wallet is on the configured app chain.
 * Adds the network in MetaMask if missing (4902), then switches.
 */
export async function ensureAppChain(walletClient: WalletClient): Promise<void> {
  const targetId = appConfig.chain.id
  const currentId = await walletClient.getChainId()
  if (currentId === targetId) return

  const chain = appChainForWallet()

  try {
    await walletClient.switchChain({ id: targetId })
    return
  } catch (switchError) {
    if (errorCode(switchError) !== 4902) throw switchError
  }

  await walletClient.addChain({ chain })
  await walletClient.switchChain({ id: targetId })
}
