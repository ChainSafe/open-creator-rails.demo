import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isHex, type Address } from 'viem'

import { createSdkIndexer } from '@open-creator-rails/sdk'
import { appConfig } from '../config'

function fmtTs(ts: bigint | undefined) {
  if (!ts) return '—'
  const ms = Number(ts) * 1000
  if (!Number.isFinite(ms)) return ts.toString()
  return new Date(ms).toISOString()
}

export function AssetHistoryPage() {
  const params = useParams<{ assetId: string }>()

  const assetId = useMemo(() => {
    const v = params.assetId
    if (!v) return null
    if (!isHex(v)) return null
    return v as `0x${string}`
  }, [params.assetId])

  const assetEntityQuery = useQuery({
    queryKey: ['indexer', 'assetEntityByAssetId', appConfig.indexerUrl, assetId],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetId) throw new Error('Missing assetId')
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return await ix.getAssetEntityByAssetId({ assetId })
    },
    enabled: Boolean(appConfig.indexerUrl && assetId),
  })

  const assetAddress = (assetEntityQuery.data?.id ?? null) as Address | null

  const createdQuery = useQuery({
    queryKey: ['indexer', 'assetRegistry_AssetCreateds', appConfig.indexerUrl, assetId],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetId) throw new Error('Missing assetId')
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return await ix.listAssetCreateds({ assetId })
    },
    enabled: Boolean(appConfig.indexerUrl && assetId),
  })

  const subsAddedQuery = useQuery({
    queryKey: ['indexer', 'asset_SubscriptionAddeds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return await ix.listAssetSubscriptionAddeds({ assetAddress })
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const priceUpdatedQuery = useQuery({
    queryKey: ['indexer', 'asset_SubscriptionPriceUpdateds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return await ix.listAssetSubscriptionPriceUpdateds({ assetAddress })
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const ownershipQuery = useQuery({
    queryKey: ['indexer', 'asset_OwnershipTransferreds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return await ix.listAssetOwnershipTransferreds({ assetAddress })
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  return (
    <div>
      <h1>Asset history</h1>
      <p>
        Asset ID hash: <code>{params.assetId ?? '(missing)'}</code>
      </p>
      <p>
        Indexer: <code>{appConfig.indexerUrl}</code>
      </p>

      <p>
        <Link to={assetId ? `/assets/${assetId}` : '/registry'}>← Back to asset</Link>
      </p>

      <p>
        Asset address:{' '}
        <code>
          {!appConfig.indexerUrl
            ? 'Set VITE_INDEXER_URL'
            : assetId === null
              ? 'Invalid asset id (must be 0x…)'
              : assetEntityQuery.isLoading
                ? 'Loading…'
                : assetEntityQuery.error
                  ? 'Error'
                  : assetEntityQuery.data?.id ?? '(not indexed yet)'}
        </code>
      </p>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2>Creation / provenance</h2>
      {createdQuery.isLoading ? <p>Loading…</p> : null}
      {createdQuery.error ? (
        <p>
          Error: <code>{(createdQuery.error as Error).message}</code>
        </p>
      ) : null}
      <ul>
        {(createdQuery.data ?? []).map((e) => (
          <li key={e.id}>
            <div>
              <strong>AssetCreated</strong> at <code>{fmtTs(e.blockTimestamp)}</code> (block{' '}
              <code>{e.blockNumber.toString()}</code>)
            </div>
            <div>
              asset: <code>{e.asset}</code>
            </div>
            <div>
              owner: <code>{e.owner}</code>
            </div>
            <div>
              token: <code>{e.tokenAddress}</code>
            </div>
            <div>
              price (per second): <code>{e.subscriptionPrice.toString()}</code>
            </div>
          </li>
        ))}
      </ul>

      <h2>Subscription history</h2>
      {!assetAddress ? <p>Waiting for asset address (indexer)…</p> : null}
      {subsAddedQuery.isLoading ? <p>Loading…</p> : null}
      {subsAddedQuery.error ? (
        <p>
          Error: <code>{(subsAddedQuery.error as Error).message}</code>
        </p>
      ) : null}
      <ul>
        {(subsAddedQuery.data ?? []).map((e) => (
          <li key={e.id}>
            <div>
              <strong>SubscriptionAdded</strong> at <code>{fmtTs(e.blockTimestamp)}</code>
            </div>
            <div>
              subscriberId: <code>{e.subscriber}</code>
            </div>
            <div>
              payer: <code>{e.payer}</code>
            </div>
            <div>
              start: <code>{e.startTime.toString()}</code> end: <code>{e.endTime.toString()}</code> nonce:{' '}
              <code>{e.nonce.toString()}</code>
            </div>
          </li>
        ))}
      </ul>

      <h2>Price changes</h2>
      {priceUpdatedQuery.isLoading ? <p>Loading…</p> : null}
      {priceUpdatedQuery.error ? (
        <p>
          Error: <code>{(priceUpdatedQuery.error as Error).message}</code>
        </p>
      ) : null}
      <ul>
        {(priceUpdatedQuery.data ?? []).map((e) => (
          <li key={e.id}>
            <div>
              <strong>SubscriptionPriceUpdated</strong> at <code>{fmtTs(e.blockTimestamp)}</code>
            </div>
            <div>
              new price (per second): <code>{e.newSubscriptionPrice.toString()}</code>
            </div>
          </li>
        ))}
      </ul>

      <h2>Ownership transfers</h2>
      {ownershipQuery.isLoading ? <p>Loading…</p> : null}
      {ownershipQuery.error ? (
        <p>
          Error: <code>{(ownershipQuery.error as Error).message}</code>
        </p>
      ) : null}
      <ul>
        {(ownershipQuery.data ?? []).map((e) => (
          <li key={e.id}>
            <div>
              <strong>OwnershipTransferred</strong> at <code>{fmtTs(e.blockTimestamp)}</code>
            </div>
            <div>
              from <code>{e.previousOwner}</code> to <code>{e.newOwner}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

