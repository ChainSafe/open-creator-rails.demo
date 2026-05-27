import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address } from 'viem'
import { useAccount } from 'wagmi'

import { appConfig } from './config'
import { createDemoIndexer } from './indexerClient'

/**
 * Shared indexer read for “does the connected wallet own any asset in the registry?”.
 * Used by AppLayout (nav) and Creator Console route guard — same queryKey dedupes in React Query.
 */
export function useAssetOwnerGate() {
  const { address } = useAccount()

  const assetsQuery = useQuery({
    queryKey: ['indexer', 'listAssetsByRegistry', appConfig.indexerUrl, appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) return []
      const ix = createDemoIndexer()
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  const isAssetOwner = useMemo(() => {
    if (!address || !assetsQuery.data) return false
    const lower = address.toLowerCase()
    return assetsQuery.data.some((a: IndexerAssetEntity) => a.owner?.toLowerCase() === lower)
  }, [address, assetsQuery.data])

  const gateReady =
    !appConfig.registryAddress ||
    (!assetsQuery.isLoading && (assetsQuery.isSuccess || assetsQuery.isError))

  return { isAssetOwner, gateReady, assetsQuery }
}
