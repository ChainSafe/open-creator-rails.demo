import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isHex, type Address } from 'viem'

import { appConfig } from '../config'
import styles from './AssetHistoryPage.module.scss'

type AssetEntity = {
  id: Address
}

type AssetCreatedEvent = {
  id: string
  asset: Address
  owner: Address
  tokenAddress: Address
  subscriptionPrice: bigint
  blockNumber: bigint
  blockTimestamp: bigint
}

type SubscriptionAddedEvent = {
  id: string
  subscriber: string
  payer: Address
  startTime: bigint
  endTime: bigint
  nonce: bigint
  blockTimestamp: bigint
}

type SubscriptionPriceUpdatedEvent = {
  id: string
  newSubscriptionPrice: bigint
  blockTimestamp: bigint
}

type OwnershipTransferredEvent = {
  id: string
  previousOwner: Address
  newOwner: Address
  blockTimestamp: bigint
}

async function indexerQuery<T>(url: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!response.ok) throw new Error(`Indexer request failed with status ${response.status}`)
  const json = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> }
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? 'Indexer GraphQL error')
  if (!json.data) throw new Error('Indexer response missing data')
  return json.data
}

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
      const query = `
        query AssetEntityByAssetId($assetId: String!) {
          assetEntitys(where: { assetId: $assetId }, limit: 1) {
            items {
              id
            }
          }
        }
      `
      const data = await indexerQuery<{ assetEntitys: { items: Array<{ id: string }> } }>(
        appConfig.indexerUrl,
        query,
        { assetId: assetId.toLowerCase() },
      )
      const first = data.assetEntitys.items[0]
      if (!first?.id) return null
      return { id: first.id as Address } satisfies AssetEntity
    },
    enabled: Boolean(appConfig.indexerUrl && assetId),
  })

  const assetAddress = (assetEntityQuery.data?.id ?? null) as Address | null

  const createdQuery = useQuery<AssetCreatedEvent[]>({
    queryKey: ['indexer', 'assetRegistry_AssetCreateds', appConfig.indexerUrl, assetId],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetId) throw new Error('Missing assetId')
      const query = `
        query AssetCreateds($assetId: String!) {
          assetRegistry_AssetCreateds(where: { assetId: $assetId }, orderBy: "blockTimestamp", orderDirection: "asc") {
            items {
              id
              asset
              owner
              tokenAddress
              subscriptionPrice
              blockNumber
              blockTimestamp
            }
          }
        }
      `
      const data = await indexerQuery<{
        assetRegistry_AssetCreateds: {
          items: Array<{
            id: string
            asset: string
            owner: string
            tokenAddress: string
            subscriptionPrice: string
            blockNumber: string
            blockTimestamp: string
          }>
        }
      }>(appConfig.indexerUrl, query, { assetId: assetId.toLowerCase() })
      return data.assetRegistry_AssetCreateds.items.map((e) => ({
        id: e.id,
        asset: e.asset as Address,
        owner: e.owner as Address,
        tokenAddress: e.tokenAddress as Address,
        subscriptionPrice: BigInt(e.subscriptionPrice),
        blockNumber: BigInt(e.blockNumber),
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetId),
  })

  const subsAddedQuery = useQuery<SubscriptionAddedEvent[]>({
    queryKey: ['indexer', 'asset_SubscriptionAddeds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query SubscriptionAddeds($assetAddress: String!) {
          asset_SubscriptionAddeds(where: { assetAddress: $assetAddress }, orderBy: "blockTimestamp", orderDirection: "asc") {
            items {
              id
              subscriber
              payer
              startTime
              endTime
              nonce
              blockTimestamp
            }
          }
        }
      `
      const data = await indexerQuery<{
        asset_SubscriptionAddeds: {
          items: Array<{
            id: string
            subscriber: string
            payer: string
            startTime: string
            endTime: string
            nonce: string
            blockTimestamp: string
          }>
        }
      }>(appConfig.indexerUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_SubscriptionAddeds.items.map((e) => ({
        id: e.id,
        subscriber: e.subscriber,
        payer: e.payer as Address,
        startTime: BigInt(e.startTime),
        endTime: BigInt(e.endTime),
        nonce: BigInt(e.nonce),
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const priceUpdatedQuery = useQuery<SubscriptionPriceUpdatedEvent[]>({
    queryKey: ['indexer', 'asset_SubscriptionPriceUpdateds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query SubscriptionPriceUpdateds($assetAddress: String!) {
          asset_SubscriptionPriceUpdateds(where: { assetAddress: $assetAddress }, orderBy: "blockTimestamp", orderDirection: "asc") {
            items {
              id
              newSubscriptionPrice
              blockTimestamp
            }
          }
        }
      `
      const data = await indexerQuery<{
        asset_SubscriptionPriceUpdateds: {
          items: Array<{
            id: string
            newSubscriptionPrice: string
            blockTimestamp: string
          }>
        }
      }>(appConfig.indexerUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_SubscriptionPriceUpdateds.items.map((e) => ({
        id: e.id,
        newSubscriptionPrice: BigInt(e.newSubscriptionPrice),
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const ownershipQuery = useQuery<OwnershipTransferredEvent[]>({
    queryKey: ['indexer', 'asset_OwnershipTransferreds', appConfig.indexerUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query OwnershipTransferreds($assetAddress: String!) {
          asset_OwnershipTransferreds(where: { assetAddress: $assetAddress }, orderBy: "blockTimestamp", orderDirection: "asc") {
            items {
              id
              previousOwner
              newOwner
              blockTimestamp
            }
          }
        }
      `
      const data = await indexerQuery<{
        asset_OwnershipTransferreds: {
          items: Array<{
            id: string
            previousOwner: string
            newOwner: string
            blockTimestamp: string
          }>
        }
      }>(appConfig.indexerUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_OwnershipTransferreds.items.map((e) => ({
        id: e.id,
        previousOwner: e.previousOwner as Address,
        newOwner: e.newOwner as Address,
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
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

      <hr className={styles.sectionDivider} />

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

