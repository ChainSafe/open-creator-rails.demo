import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { type Address } from 'viem'

import { CreatorHubCard } from '../components/CreatorHubCard'
import type { CreatorPublicMeta } from '../creatorProfile'
import { appConfig } from '../config'
import { fetchCreatorPublicMeta } from '../demoServicesClient'
import { createDemoIndexer } from '../indexerClient'
import styles from './RegistryPage.module.scss'

export function RegistryPage() {
  const navigate = useNavigate()
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
    enabled: Boolean(assetsQuery.data?.length),
  })

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Creators Hub</h1>
        <p className={styles.pageSubtitle}>
          Subscribre to creators to unlock their content.
        </p>
      </header>

      {assetsQuery.isLoading ? <p className={styles.status}>Loading creators…</p> : null}
      {assetsQuery.error ? (
        <p className={styles.status}>
          Indexer error: <code>{(assetsQuery.error as Error).message}</code>
        </p>
      ) : null}
      {!assetsQuery.isLoading && (assetsQuery.data?.length ?? 0) === 0 ? (
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
    </div>
  )
}
