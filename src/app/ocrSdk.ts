import { OcrSdk } from '@open-creator-rails/sdk'
import { createPublicClient, http, type Address } from 'viem'
import { anvil } from 'viem/chains'
import { useMemo } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'

import { appConfig } from './config'

/** RPC client for reads when wagmi has not selected a chain yet (e.g. wallet disconnected). */
function useAnvilPublicClient() {
  const fromWagmi = usePublicClient({ chainId: anvil.id })
  return useMemo(() => {
    if (fromWagmi) return fromWagmi
    return createPublicClient({
      chain: anvil,
      transport: http(appConfig.rpcUrl),
    })
  }, [fromWagmi])
}

export function useOcrSdk(): OcrSdk | null {
  const publicClient = useAnvilPublicClient()
  const { data: walletClient } = useWalletClient()

  // Recreate when wallet/RPC clients change. After upgrading the SDK submodule, do a full page reload
  // so this hook runs again with the updated `OcrSdk` class (constructor attaches `indexer`).
  return useMemo(() => {
    const registryAddress = appConfig.registryAddress as Address | undefined
    if (!registryAddress) return null

    return new OcrSdk({
      publicClient,
      walletClient: walletClient ?? undefined,
      registryAddress,
      indexerUrl: appConfig.indexerUrl,
    })
  }, [publicClient, walletClient])
}

