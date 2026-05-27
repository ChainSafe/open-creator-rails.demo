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

/** Chain metadata for `wallet_addEthereumChain` (uses demo RPC URL, e.g. custom Anvil port). */
function anvilChainForWallet() {
  return {
    ...appConfig.chain,
    rpcUrls: {
      default: { http: [appConfig.rpcUrl] },
    },
  } as const
}

/**
 * Ensures the injected wallet is on the local Anvil chain (31337).
 * Adds the network in MetaMask if missing, then switches.
 */
export async function ensureLocalAnvilChain(walletClient: WalletClient): Promise<void> {
  const targetId = appConfig.chain.id
  const currentId = await walletClient.getChainId()
  if (currentId === targetId) return

  const chain = anvilChainForWallet()

  try {
    await walletClient.switchChain({ id: targetId })
    return
  } catch (switchError) {
    if (errorCode(switchError) !== 4902) throw switchError
  }

  await walletClient.addChain({ chain })
  await walletClient.switchChain({ id: targetId })
}
