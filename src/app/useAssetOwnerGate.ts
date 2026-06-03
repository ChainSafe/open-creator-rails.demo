import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http } from 'viem'
import { useMemo } from 'react'
import { type Address } from 'viem'
import { useAccount } from 'wagmi'

import { appConfig } from './config'
import { createDemoIndexer } from './indexerClient'
import { registryOwnerAbi } from './registryOwnerAbi'

/**
 * Indexer: does the wallet own any asset in this registry?
 * On-chain: is the wallet the registry owner (can create assets)?
 * Admin Console: registry owner always; asset owners can manage their creators.
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

  const registryOwnerQuery = useQuery({
    queryKey: ['ocr', 'registryOwner', appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) throw new Error('Missing registry address')
      const client = createPublicClient({
        chain: appConfig.chain,
        transport: http(appConfig.rpcUrl),
      })
      return client.readContract({
        address: appConfig.registryAddress,
        abi: registryOwnerAbi,
        functionName: 'owner',
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  const isAssetOwner = useMemo(() => {
    if (!address || !assetsQuery.data) return false
    const lower = address.toLowerCase()
    return assetsQuery.data.some((a: IndexerAssetEntity) => a.owner?.toLowerCase() === lower)
  }, [address, assetsQuery.data])

  const isRegistryOwner = useMemo(() => {
    if (!address || !registryOwnerQuery.data) return false
    return address.toLowerCase() === (registryOwnerQuery.data as Address).toLowerCase()
  }, [address, registryOwnerQuery.data])

  /** Registry owner can add creators; asset owners manage their own assets. */
  const canAccessCreatorConsole = isRegistryOwner || isAssetOwner

  const gateReady =
    !appConfig.registryAddress ||
    ((!assetsQuery.isLoading && (assetsQuery.isSuccess || assetsQuery.isError)) &&
      (!registryOwnerQuery.isLoading &&
        (registryOwnerQuery.isSuccess || registryOwnerQuery.isError)))

  return {
    isAssetOwner,
    isRegistryOwner,
    canAccessCreatorConsole,
    gateReady,
    assetsQuery,
    registryOwnerQuery,
  }
}
