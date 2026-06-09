import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { type Address } from 'viem'

import { CreatorHubCard } from '../components/CreatorHubCard'
import { PetCard } from '../components/PetCard'
import { PetShopPaymentPicker } from '../components/PetShopPaymentPicker'
import type { CreatorPublicMeta } from '../creatorProfile'
import { appConfig } from '../config'
import { fetchCreatorPublicMeta } from '../demoServicesClient'
import { createDemoIndexer } from '../indexerClient'
import { usePetRows } from '../petShop/usePetRows'
import styles from './RegistryPage.module.scss'

export function RegistryPage() {
  const navigate = useNavigate()
  const petShop = appConfig.petShopDemo
  const { assetsQuery: petAssetsQuery, petRows } = usePetRows()

  const assetsQuery = useQuery({
    queryKey: ['indexer', 'listAssetsByRegistry', appConfig.indexerUrl, appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) throw new Error('Missing VITE_REGISTRY_ADDRESS')
      const ix = createDemoIndexer()
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress) && !petShop,
  })

  const publicMetaQuery = useQuery<Record<string, CreatorPublicMeta>>({
    queryKey: ['mockApi', 'creatorPublicMeta', assetsQuery.data?.map((a) => a.id).join(',')],
    queryFn: async () => {
      const assets = assetsQuery.data ?? []
      const meta: Record<string, CreatorPublicMeta> = {}
      await Promise.all(
        assets.map(async (a) => {
          const entry = await fetchCreatorPublicMeta(a.id)
          if (entry) meta[a.id.toLowerCase()] = entry
        }),
      )
      return meta
    },
    enabled: Boolean(assetsQuery.data?.length) && !petShop,
  })

  const hubAssetsQuery = petShop ? petAssetsQuery : assetsQuery

  return (
    <div className={petShop ? `${styles.page} ${styles.pagePetHub}` : styles.page}>
      <header className={petShop ? styles.petHubHero : styles.pageHeader}>
        {petShop ? (
          <>
            <p className={styles.petHubKicker}>Rent-A-Pet</p>
            <h1 className={styles.petHubTitle}>Adopt a farm friend</h1>
            <p className={styles.petHubSubtitle}>
              Subscribe on-chain, then visit My Little Farm to watch your animals appear.
            </p>
            <PetShopPaymentPicker />
          </>
        ) : (
          <>
            <h1 className={styles.pageTitle}>Creators Hub</h1>
            <p className={styles.pageSubtitle}>Subscribe to creators to unlock their content.</p>
          </>
        )}
      </header>

      {hubAssetsQuery.isLoading ? (
        <p className={styles.status}>{petShop ? 'Loading pets…' : 'Loading creators…'}</p>
      ) : null}
      {hubAssetsQuery.error ? (
        <p className={styles.status}>
          Indexer error: <code>{(hubAssetsQuery.error as Error).message}</code>
        </p>
      ) : null}

      {petShop ? (
        <>
          <div className={styles.petGrid}>
            {petRows.map(({ pet, assetId }) => (
              <PetCard key={pet.slug} pet={pet} assetId={assetId} />
            ))}
          </div>
        </>
      ) : (
        <>
          {!hubAssetsQuery.isLoading && (assetsQuery.data?.length ?? 0) === 0 ? (
            <p className={styles.status}>No creators available yet.</p>
          ) : null}
          <div className={styles.grid}>
            {(assetsQuery.data ?? []).map((a: IndexerAssetEntity) => {
              const entry = publicMetaQuery.data?.[a.id.toLowerCase()]
              return (
                <CreatorHubCard
                  key={a.id}
                  assetAddress={a.id as Address}
                  creatorName={entry?.name ?? 'Creator'}
                  avatarUrl={entry?.avatarUrl}
                  onOpen={() => navigate(`/assets/${a.assetId}`)}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
