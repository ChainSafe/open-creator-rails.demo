import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import { createSdkIndexer, type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { useOcrSdk } from '../ocrSdk'

export function RegistryPage() {
  const sdk = useOcrSdk()
  const ownerQuery = useQuery({
    queryKey: ['ocr', 'registryOwner', appConfig.registryAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return await sdk.AssetRegistry.owner()
    },
    enabled: Boolean(sdk),
  })

  const assetsQuery = useQuery({
    queryKey: ['indexer', 'listAssetsByRegistry', appConfig.indexerUrl, appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) throw new Error('Missing VITE_REGISTRY_ADDRESS')
      // Use createSdkIndexer here instead of sdk.indexer: the list query must not depend on
      // OcrSdk’s memoized instance (stale bundle / missing this.indexer makes sdk.indexer undefined
      // even when VITE_INDEXER_URL is set — same GraphQL as sdk.indexer).
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  return (
    <div>
      <h1>Creator profile (AssetRegistry)</h1>
      <p>
        This page will list assets under the configured registry and link to their details.
      </p>
      <p>
        Registry: <code>{appConfig.registryAddress ?? 'Missing VITE_REGISTRY_ADDRESS'}</code>
      </p>
      <p>
        Registry owner:{' '}
        <code>
          {!sdk
            ? 'Set VITE_REGISTRY_ADDRESS to enable SDK reads'
            : ownerQuery.isLoading
              ? 'Loading…'
              : ownerQuery.error
                ? 'Error'
                : ownerQuery.data}
        </code>
      </p>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2>Assets</h2>
      <p>
        Indexer: <code>{appConfig.indexerUrl}</code>
      </p>
      {assetsQuery.isLoading ? <p>Loading assets…</p> : null}
      {assetsQuery.error ? (
        <p>
          Indexer error: <code>{(assetsQuery.error as Error).message}</code>
        </p>
      ) : null}
      {!assetsQuery.isLoading && (assetsQuery.data?.length ?? 0) === 0 ? (
        <p>No assets found (run the local seed script + indexer; registry address must match the seeded registry).</p>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {(assetsQuery.data ?? []).map((a: IndexerAssetEntity) => (
          <li
            key={a.id}
            style={{
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <Link to={`/assets/${a.assetId}`}>{a.assetId}</Link> <span>→</span>{' '}
              <code>{a.id}</code>
            </div>
            <SubscribeToAssetButton assetId={a.assetId} compact />
          </li>
        ))}
      </ul>
    </div>
  )
}

