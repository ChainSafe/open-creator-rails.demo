import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useChainId, useConnect, useWalletClient } from 'wagmi'

import { appConfig } from './config'
import { ensureLocalAnvilChain, isWalletUserRejection } from './ensureLocalAnvilChain'
import { useToast } from './toast/useToast'

/** True when the app is built for local Anvil (`VITE_CHAIN=anvil`, e.g. `pnpm dev:local`). */
export const isLocalAnvilDev = appConfig.chainKey === 'anvil'

export function useLocalAnvilWallet() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { showToast } = useToast()
  const [isEnsuringChain, setIsEnsuringChain] = useState(false)
  const autoEnsureAttempted = useRef(false)

  const targetChainId = appConfig.chain.id
  const needsNetworkSwitch = isLocalAnvilDev && isConnected && chainId !== targetChainId

  const ensureChain = useCallback(async (): Promise<boolean> => {
    if (!isLocalAnvilDev || !walletClient) return true

    setIsEnsuringChain(true)
    try {
      await ensureLocalAnvilChain(walletClient)
      return true
    } catch (error) {
      if (isWalletUserRejection(error)) {
        showToast('Network switch cancelled in wallet', { variant: 'info' })
      } else {
        showToast(
          error instanceof Error ? error.message : 'Could not switch to local Anvil network',
          { variant: 'error' },
        )
      }
      return false
    } finally {
      setIsEnsuringChain(false)
    }
  }, [walletClient, showToast])

  const connectWallet = useCallback(() => {
    const connector = connectors[0]
    if (!connector) return

    connect(
      {
        connector,
        chainId: isLocalAnvilDev ? targetChainId : undefined,
      },
      {
        onError: (error) => {
          showToast(error.message, { variant: 'error' })
        },
      },
    )
  }, [connect, connectors, showToast, targetChainId])

  // Wallet already connected (e.g. refresh) but on the wrong network.
  useEffect(() => {
    if (!isLocalAnvilDev || !isConnected || !walletClient) {
      autoEnsureAttempted.current = false
      return
    }
    if (chainId === targetChainId) {
      autoEnsureAttempted.current = false
      return
    }
    if (autoEnsureAttempted.current) return
    autoEnsureAttempted.current = true
    void ensureChain()
  }, [chainId, ensureChain, isConnected, targetChainId, walletClient])

  const switchToAnvil = useCallback(() => {
    autoEnsureAttempted.current = false
    void ensureChain()
  }, [ensureChain])

  return {
    connectWallet,
    switchToAnvil,
    isConnecting: isConnecting || isEnsuringChain,
    needsNetworkSwitch,
    isLocalAnvilDev,
  }
}
