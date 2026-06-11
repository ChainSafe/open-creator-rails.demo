import { useCallback, useState } from 'react'
import { useAccount, useChainId, useConnect, useSwitchChain, useWalletClient } from 'wagmi'

import { appConfig } from './config'
import { ensureAppChain, isWalletUserRejection } from './ensureAppChain'
import { useToast } from './toast/useToast'

/** True when the app is built for local Anvil (`VITE_CHAIN=anvil`, e.g. `pnpm dev:local`). */
export const isLocalAnvilDev = appConfig.chainKey === 'anvil'

export function useLocalAnvilWallet() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { showToast } = useToast()
  const [isEnsuringChain, setIsEnsuringChain] = useState(false)

  const targetChainId = appConfig.chain.id
  const needsNetworkSwitch = isConnected && chainId !== targetChainId

  const switchToTargetChain = useCallback(async (): Promise<boolean> => {
    setIsEnsuringChain(true)
    try {
      await switchChainAsync({ chainId: targetChainId })
      return true
    } catch (error) {
      if (!walletClient) {
        if (isWalletUserRejection(error)) {
          showToast('Network switch cancelled in wallet', { variant: 'info' })
        } else {
          showToast(
            error instanceof Error ? error.message : `Could not switch to ${appConfig.chain.name}`,
            { variant: 'error' },
          )
        }
        return false
      }

      try {
        await ensureAppChain(walletClient)
        return true
      } catch (fallbackError) {
        if (isWalletUserRejection(fallbackError)) {
          showToast('Network switch cancelled in wallet', { variant: 'info' })
        } else {
          showToast(
            fallbackError instanceof Error
              ? fallbackError.message
              : `Could not switch to ${appConfig.chain.name}`,
            { variant: 'error' },
          )
        }
        return false
      }
    } finally {
      setIsEnsuringChain(false)
    }
  }, [switchChainAsync, targetChainId, walletClient, showToast])

  const connectWallet = useCallback(() => {
    const connector = connectors[0]
    if (!connector) return

    connect(
      {
        connector,
        chainId: targetChainId,
      },
      {
        onSuccess: async (data) => {
          if (data.chainId !== targetChainId) {
            await switchToTargetChain()
          }
        },
        onError: (error) => {
          showToast(error.message, { variant: 'error' })
        },
      },
    )
  }, [connect, connectors, showToast, switchToTargetChain, targetChainId])

  return {
    connectWallet,
    /** @deprecated use switchToTargetChain */
    switchToAnvil: switchToTargetChain,
    switchToTargetChain,
    isConnecting: isConnecting || isEnsuringChain || isSwitchingChain,
    needsNetworkSwitch,
    isLocalAnvilDev,
    targetChainName: appConfig.chain.name,
  }
}
