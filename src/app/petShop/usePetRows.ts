import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address, type Hex } from 'viem'

import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { petCatalogForChain, resolvePetByAssetId, type PetDefinition } from './petCatalog'

export type PetRow = {
  pet: PetDefinition
  assetId: Hex
  asset: IndexerAssetEntity
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
    const rows: PetRow[] = []

    for (const asset of assets) {
      const pet = resolvePetByAssetId(asset.assetId as Hex, appConfig.chainKey)
      if (!pet) continue
      rows.push({ pet, assetId: asset.assetId as Hex, asset })
    }

    rows.sort((a, b) => {
      const ai = catalog.findIndex((p) => p.slug === a.pet.slug)
      const bi = catalog.findIndex((p) => p.slug === b.pet.slug)
      return ai - bi
    })

    return rows
  }, [assetsQuery.data, catalog])

  return { assetsQuery, petRows, catalog }
}
