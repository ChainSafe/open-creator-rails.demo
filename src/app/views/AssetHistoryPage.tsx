import { resolveOpenCreatorRailsIndexerGraphqlUrl } from '@open-creator-rails/sdk'
import { type ReactNode, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isHex, type Address } from 'viem'

import { blockExplorerAddressUrl } from '../blockExplorer'
import { appConfig } from '../config'
import styles from './AssetHistoryPage.module.scss'

type AssetEntity = {
  id: Address
  address: Address
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

function fmtTs(ts: bigint | undefined): string {
  if (!ts) return '—'
  const ms = Number(ts) * 1000
  if (!Number.isFinite(ms)) return ts.toString()
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function AddressValue({ address }: { address: string }) {
  const explorer = blockExplorerAddressUrl(address)
  if (explorer) {
    return (
      <a href={explorer} target="_blank" rel="noreferrer noopener" className={styles.detailLink}>
        {shortenAddress(address)}
        <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>
          open_in_new
        </span>
      </a>
    )
  }
  return <span className={styles.detailValue}>{address}</span>
}

export function AssetHistoryPage() {
  const params = useParams<{ assetId: string }>()

  const graphqlUrl = resolveOpenCreatorRailsIndexerGraphqlUrl(appConfig.indexerUrl)

  const assetId = useMemo(() => {
    const v = params.assetId
    if (!v) return null
    if (!isHex(v)) return null
    return v as `0x${string}`
  }, [params.assetId])

  const assetEntityQuery = useQuery({
    queryKey: ['indexer', 'assetByRegistryAssetId', graphqlUrl, assetId],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetId) throw new Error('Missing assetId')
      const query = `
        query AssetByRegistryAssetId($assetId: String!) {
          assets(where: { assetId: $assetId }, limit: 1) {
            items {
              id
              address
            }
          }
        }
      `
      const data = await indexerQuery<{ assets: { items: Array<{ id: string; address: string }> } }>(
        graphqlUrl,
        query,
        { assetId: assetId.toLowerCase() },
      )
      const first = data.assets.items[0]
      if (!first?.address) return null
      return { id: first.id as Address, address: first.address.toLowerCase() as Address } satisfies AssetEntity
    },
    enabled: Boolean(appConfig.indexerUrl && assetId),
  })

  const assetAddress = (assetEntityQuery.data?.address ?? null) as Address | null

  const serviceNameQuery = useQuery({
    queryKey: ['mockApi', 'assetName', assetAddress],
    queryFn: async () => {
      if (!assetAddress) return null
      const resp = await fetch(`${appConfig.mockApiUrl}/api/asset-name?assetAddress=${assetAddress}`)
      if (!resp.ok) return null
      const data = await resp.json()
      return data.name as string
    },
    enabled: Boolean(assetAddress),
  })

  const createdQuery = useQuery<AssetCreatedEvent[]>({
    queryKey: ['indexer', 'assetRegistry_AssetCreateds', graphqlUrl, assetId],
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
      }>(graphqlUrl, query, { assetId: assetId.toLowerCase() })
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
    queryKey: ['indexer', 'asset_SubscriptionAddeds', graphqlUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query SubscriptionAddeds($assetAddress: Address!) {
          asset_SubscriptionAddeds(where: { assetAddress: $assetAddress }, orderBy: "blockTimestamp", orderDirection: "asc") {
            items {
              id
              subscriber
              payer
              startTime
              endTime
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
            blockTimestamp: string
          }>
        }
      }>(graphqlUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_SubscriptionAddeds.items.map((e) => ({
        id: e.id,
        subscriber: e.subscriber,
        payer: e.payer as Address,
        startTime: BigInt(e.startTime),
        endTime: BigInt(e.endTime),
        nonce: 0n,
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const priceUpdatedQuery = useQuery<SubscriptionPriceUpdatedEvent[]>({
    queryKey: ['indexer', 'asset_SubscriptionPriceUpdateds', graphqlUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query SubscriptionPriceUpdateds($assetAddress: Address!) {
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
      }>(graphqlUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_SubscriptionPriceUpdateds.items.map((e) => ({
        id: e.id,
        newSubscriptionPrice: BigInt(e.newSubscriptionPrice),
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const ownershipQuery = useQuery<OwnershipTransferredEvent[]>({
    queryKey: ['indexer', 'asset_OwnershipTransferreds', graphqlUrl, assetAddress],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      if (!assetAddress) throw new Error('Missing asset address')
      const query = `
        query OwnershipTransferreds($assetAddress: Address!) {
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
      }>(graphqlUrl, query, { assetAddress: assetAddress.toLowerCase() })
      return data.asset_OwnershipTransferreds.items.map((e) => ({
        id: e.id,
        previousOwner: e.previousOwner as Address,
        newOwner: e.newOwner as Address,
        blockTimestamp: BigInt(e.blockTimestamp),
      }))
    },
    enabled: Boolean(appConfig.indexerUrl && assetAddress),
  })

  const creatorName = serviceNameQuery.data ?? 'Creator'
  const contractExplorer = assetAddress ? blockExplorerAddressUrl(assetAddress) : null

  if (assetId === null && params.assetId) {
    return (
      <div className={styles.page}>
        <p className={`${styles.status} ${styles.statusError}`}>Invalid asset id (must be 0x…)</p>
        <Link to="/" className={styles.backLink}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Back to Creators Hub
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Link to={assetId ? `/assets/${assetId}` : '/'} className={styles.backLink}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          arrow_back
        </span>
        Back to creator
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{creatorName} — On-chain history</h1>
        <p className={styles.subtitle}>
          Indexed events for this creator asset: deployment, subscriptions, price updates, and ownership changes.
        </p>
      </header>

      <div className={styles.metaPanel}>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Contract</span>
          {!appConfig.indexerUrl ? (
            <span className={styles.metaValue}>Set VITE_INDEXER_URL</span>
          ) : assetEntityQuery.isLoading ? (
            <span className={styles.metaValue}>Loading…</span>
          ) : assetEntityQuery.error ? (
            <span className={`${styles.metaValue} ${styles.statusError}`}>
              {(assetEntityQuery.error as Error).message}
            </span>
          ) : assetAddress && contractExplorer ? (
            <a
              href={contractExplorer}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.metaLink}
            >
              {assetAddress}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                open_in_new
              </span>
            </a>
          ) : (
            <span className={styles.metaValue}>{assetAddress ?? '(not indexed yet)'}</span>
          )}
        </div>
        {assetId ? (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Registry asset ID</span>
            <span className={styles.metaValue}>{assetId}</span>
          </div>
        ) : null}
      </div>

      <HistorySection
        title="Creation"
        icon="rocket_launch"
        hint="When this creator was registered on the asset registry."
        isLoading={createdQuery.isLoading}
        error={createdQuery.error}
        isEmpty={(createdQuery.data ?? []).length === 0}
        emptyMessage="No creation events indexed yet."
      >
        {(createdQuery.data ?? []).map((e) => (
          <li key={e.id} className={styles.eventCard}>
            <div className={styles.eventHeader}>
              <span className={styles.eventType}>Asset created</span>
              <time className={styles.eventTime} dateTime={new Date(Number(e.blockTimestamp) * 1000).toISOString()}>
                {fmtTs(e.blockTimestamp)}
              </time>
            </div>
            <div className={styles.eventDetails}>
              <DetailRow label="Block" value={e.blockNumber.toString()} />
              <DetailRow label="Asset" address={e.asset} />
              <DetailRow label="Owner" address={e.owner} />
              <DetailRow label="Payment token" address={e.tokenAddress} />
              <DetailRow label="Price (per second)" value={e.subscriptionPrice.toString()} />
            </div>
          </li>
        ))}
      </HistorySection>

      <HistorySection
        title="Subscriptions"
        icon="group"
        hint="On-chain SubscriptionAdded events (initial purchases)."
        isLoading={Boolean(assetAddress && subsAddedQuery.isLoading)}
        error={subsAddedQuery.error}
        isEmpty={Boolean(assetAddress && (subsAddedQuery.data ?? []).length === 0)}
        emptyMessage="No subscription events yet."
        waitingMessage={!assetAddress ? 'Waiting for asset address from indexer…' : undefined}
      >
        {(subsAddedQuery.data ?? []).map((e) => (
          <li key={e.id} className={styles.eventCard}>
            <div className={styles.eventHeader}>
              <span className={styles.eventType}>Subscription added</span>
              <time className={styles.eventTime} dateTime={new Date(Number(e.blockTimestamp) * 1000).toISOString()}>
                {fmtTs(e.blockTimestamp)}
              </time>
            </div>
            <div className={styles.eventDetails}>
              <DetailRow label="Subscriber ID" value={e.subscriber} />
              <DetailRow label="Payer" address={e.payer} />
              <DetailRow label="Start" value={fmtTs(e.startTime)} />
              <DetailRow label="End" value={fmtTs(e.endTime)} />
            </div>
          </li>
        ))}
      </HistorySection>

      <HistorySection
        title="Price changes"
        icon="payments"
        hint="Updates from the asset owner via setSubscriptionPrice."
        isLoading={Boolean(assetAddress && priceUpdatedQuery.isLoading)}
        error={priceUpdatedQuery.error}
        isEmpty={Boolean(assetAddress && (priceUpdatedQuery.data ?? []).length === 0)}
        emptyMessage="No price updates recorded."
        waitingMessage={!assetAddress ? 'Waiting for asset address from indexer…' : undefined}
      >
        {(priceUpdatedQuery.data ?? []).map((e) => (
          <li key={e.id} className={styles.eventCard}>
            <div className={styles.eventHeader}>
              <span className={styles.eventType}>Price updated</span>
              <time className={styles.eventTime} dateTime={new Date(Number(e.blockTimestamp) * 1000).toISOString()}>
                {fmtTs(e.blockTimestamp)}
              </time>
            </div>
            <div className={styles.eventDetails}>
              <DetailRow label="New price (per second)" value={e.newSubscriptionPrice.toString()} />
            </div>
          </li>
        ))}
      </HistorySection>

      <HistorySection
        title="Ownership"
        icon="swap_horiz"
        hint="Asset contract ownership transfers."
        isLoading={Boolean(assetAddress && ownershipQuery.isLoading)}
        error={ownershipQuery.error}
        isEmpty={Boolean(assetAddress && (ownershipQuery.data ?? []).length === 0)}
        emptyMessage="No ownership transfers."
        waitingMessage={!assetAddress ? 'Waiting for asset address from indexer…' : undefined}
      >
        {(ownershipQuery.data ?? []).map((e) => (
          <li key={e.id} className={styles.eventCard}>
            <div className={styles.eventHeader}>
              <span className={styles.eventType}>Ownership transferred</span>
              <time className={styles.eventTime} dateTime={new Date(Number(e.blockTimestamp) * 1000).toISOString()}>
                {fmtTs(e.blockTimestamp)}
              </time>
            </div>
            <div className={styles.eventDetails}>
              <DetailRow label="From" address={e.previousOwner} />
              <DetailRow label="To" address={e.newOwner} />
            </div>
          </li>
        ))}
      </HistorySection>
    </div>
  )
}

function HistorySection(props: {
  title: string
  icon: string
  hint: string
  isLoading: boolean
  error: unknown
  isEmpty: boolean
  emptyMessage: string
  waitingMessage?: string
  children: ReactNode
}) {
  const { title, icon, hint, isLoading, error, isEmpty, emptyMessage, waitingMessage, children } = props
  const ready = !isLoading && !error && !waitingMessage

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>{icon}</span>
        {title}
      </h2>
      <p className={styles.sectionHint}>{hint}</p>
      {waitingMessage ? <p className={styles.status}>{waitingMessage}</p> : null}
      {isLoading ? <p className={styles.status}>Loading…</p> : null}
      {error ? (
        <p className={`${styles.status} ${styles.statusError}`}>
          {(error as Error).message}
        </p>
      ) : null}
      {ready && isEmpty ? <p className={styles.emptySection}>{emptyMessage}</p> : null}
      {ready && !isEmpty ? <ul className={styles.eventList}>{children}</ul> : null}
    </section>
  )
}

function DetailRow(props: { label: string; value?: string; address?: string }) {
  const { label, value, address } = props
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      {address ? <AddressValue address={address} /> : <span className={styles.detailValue}>{value}</span>}
    </div>
  )
}
