import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address, type Hex } from 'viem'

import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { assetIdFromLabel, petCatalogForChain, type PetDefinition } from './petCatalog'

export type PetRow = {
  pet: PetDefinition
  assetId?: Hex
  asset?: IndexerAssetEntity
}

export function usePetRows() {
  const catalog = petCatalogForChain(appConfig.chainKey)

  const assetsQuery = useQuery({
    queryKey: ['indexer', 'listAssetsByRegistry', appConfig.indexerUrl, appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) throw new Error('Missing VITE_REGISTRY_ADDRESS')
      const ix = createDemoIndexer()
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  const petRows = useMemo(() => {
    const assets = assetsQuery.data ?? []

    return catalog.map((pet) => {
      if (!pet.assetLabel) {
        return { pet }
      }

      const assetId = assetIdFromLabel(pet.assetLabel)
      const asset = assets.find((a) => (a.assetId as Hex).toLowerCase() === assetId.toLowerCase())

      return {
        pet,
        assetId: asset ? (asset.assetId as Hex) : assetId,
        asset,
      }
    })
  }, [assetsQuery.data, catalog])

  const subscribableRows = useMemo(
    () => petRows.filter((row): row is PetRow & { assetId: Hex } => Boolean(row.assetId)),
    [petRows],
  )

  return { assetsQuery, petRows, subscribableRows, catalog }
}
