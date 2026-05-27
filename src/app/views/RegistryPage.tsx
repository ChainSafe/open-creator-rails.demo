import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Address } from 'viem'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import styles from './RegistryPage.module.scss'

function stopCardNavWhenInteractive(e: MouseEvent<HTMLElement>) {
  const el = e.target as HTMLElement
  if (el.closest('button, input, label, a, [role="button"]')) {
    e.stopPropagation()
  }
}

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

  const serviceNamesQuery = useQuery<Record<string, string>>({
    queryKey: ['mockApi', 'assetNames', assetsQuery.data?.map((a) => a.id).join(',')],
    queryFn: async () => {
      const assets = assetsQuery.data ?? []
      const names: Record<string, string> = {}
      await Promise.all(
        assets.map(async (a) => {
          try {
            const resp = await fetch(`${appConfig.mockApiUrl}/api/asset-name?assetAddress=${a.id}`)
            if (resp.ok) {
              const data = await resp.json()
              names[a.id.toLowerCase()] = data.name
            }
          } catch { /* ignore */ }
        }),
      )
      return names
    },
    enabled: Boolean(assetsQuery.data?.length),
  })

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Marketplace</h1>
        <p className={styles.pageSubtitle}>Browse and subscribe to API services published by creators.</p>
      </header>

      {assetsQuery.isLoading ? <p>Loading APIs…</p> : null}
      {assetsQuery.error ? (
        <p>Indexer error: <code>{(assetsQuery.error as Error).message}</code></p>
      ) : null}
      {!assetsQuery.isLoading && (assetsQuery.data?.length ?? 0) === 0 ? (
        <p>No APIs available yet.</p>
      ) : null}

      <ul className={styles.assetList}>
        {(assetsQuery.data ?? []).map((a: IndexerAssetEntity) => {
          const name = serviceNamesQuery.data?.[a.id.toLowerCase()]
          return (
            <li
              key={a.id}
              className={styles.assetCard}
              onClick={() => navigate(`/assets/${a.assetId}`)}
            >
              <div className={styles.assetCardAccent} />
              <div className={styles.assetCardMain}>
                <span className={styles.assetCardName}>{name ?? 'Loading…'}</span>
                <span className={styles.assetCardId}>{a.id}</span>
              </div>
              <div
                className={styles.assetCardSubscribe}
                onClick={stopCardNavWhenInteractive}
                onMouseDown={stopCardNavWhenInteractive}
              >
                <SubscribeToAssetButton assetId={a.assetId} compact />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
