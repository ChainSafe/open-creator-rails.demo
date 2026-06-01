import { type IndexerSubscription } from '@open-creator-rails/sdk'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { Address, Hex } from 'viem'
import { useAccount } from 'wagmi'

import { CreatorHubCard } from '../components/CreatorHubCard'
import { appConfig } from '../config'
import { fetchCreatorPublicMeta } from '../demoServicesClient'
import { createDemoIndexer } from '../indexerClient'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import hubStyles from './RegistryPage.module.scss'
import styles from './MySubscriptionsPage.module.scss'

type SubscriptionWithMeta = IndexerSubscription & {
  registryAssetId: Hex
  serviceName?: string
  avatarUrl?: string
}

function normalizeAssetAddress(value: string): Address {
  const normalized = value.includes('_') ? value.split('_').at(-1) ?? value : value
  return normalized as Address
}

function daysRemaining(endTimeSeconds: bigint | string): string {
  const end = typeof endTimeSeconds === 'string' ? BigInt(endTimeSeconds) : endTimeSeconds
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (end <= now) return 'Expired'
  const diff = Number(end - now)
  const days = Math.ceil(diff / 86400)
  if (days > 365) return 'Never Expires'
  return `${days} Day${days !== 1 ? 's' : ''} Left`
}

/** Same rule as indexer `Subscription.isActive`. */
function subscriptionRowIsActive(
  s: { isRevoked: boolean; startTime?: bigint; endTime?: bigint },
  now: bigint,
): boolean {
  if (s.startTime === undefined || s.endTime === undefined) return false
  return !s.isRevoked && s.startTime <= now && now < s.endTime
}

/** Latest nonce row per asset — older nonce rows are superseded history. */
function latestSubscriptionPerAsset(subs: SubscriptionWithMeta[]): SubscriptionWithMeta[] {
  const map = new Map<string, SubscriptionWithMeta>()
  for (const s of subs) {
    const key = s.assetAddress.toLowerCase()
    const prev = map.get(key)
    const nonce = s.nonce ?? 0n
    const prevNonce = prev?.nonce ?? 0n
    if (!prev || nonce > prevNonce) map.set(key, s)
  }
  return [...map.values()]
}

export function MySubscriptionsPage() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const sdk = useOcrSdk()

  const subsQuery = useQuery({
    queryKey: ['indexer', 'listSubscriptionsByUser', appConfig.indexerUrl, address],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Missing address')
      const ix = createDemoIndexer()
      const subs = await ix.listSubscriptionsByUser({
        user: address,
        subscriberId: DEMO_SUBSCRIBER_ID,
        activeOnly: false,
      })
      const enriched = await Promise.all(
        subs.map(async (s: IndexerSubscription): Promise<SubscriptionWithMeta> => {
          const assetAddress = normalizeAssetAddress(s.assetAddress)
          const registryAssetId = await sdk.Asset.getAssetId({ assetAddress })

          let serviceName: string | undefined
          let avatarUrl: string | undefined
          try {
            const meta = await fetchCreatorPublicMeta(assetAddress)
            if (meta) {
              serviceName = meta.name
              avatarUrl = meta.avatarUrl
            }
          } catch { /* ignore */ }

          return { ...s, assetAddress, registryAssetId, serviceName, avatarUrl }
        }),
      )
      return enriched
    },
    enabled: Boolean(address && sdk),
  })

  const now = BigInt(Math.floor(Date.now() / 1000))
  const subsByAsset = latestSubscriptionPerAsset(subsQuery.data ?? [])
  const activeSubs = subsByAsset.filter((s) => subscriptionRowIsActive(s, now))
  const expiredSubs = subsByAsset.filter((s) => !subscriptionRowIsActive(s, now))

  return (
    <div className={hubStyles.page}>
      <header className={hubStyles.pageHeader}>
        <h1 className={hubStyles.pageTitle}>My Subscriptions</h1>
        <p className={hubStyles.pageSubtitle}>
          Creators you support on-chain. Subscriptions show time remaining; expired subscriptions can be renewed anytime.
        </p>
      </header>

      {!address ? (
        <p className={hubStyles.status}>Connect wallet to view subscriptions.</p>
      ) : subsQuery.isLoading ? (
        <p className={hubStyles.status}>Loading…</p>
      ) : subsByAsset.length === 0 ? (
        <p className={hubStyles.status}>
          No subscriptions yet.{' '}
          <button type="button" className={styles.linkBtn} onClick={() => navigate('/')}>
            Browse Creators Hub
          </button>
        </p>
      ) : (
        <>
          {activeSubs.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Active</h2>
              <div className={hubStyles.grid}>
                {activeSubs.map((s) => (
                  <CreatorHubCard
                    key={s.id}
                    assetAddress={s.assetAddress}
                    creatorName={s.serviceName ?? 'Creator'}
                    avatarUrl={s.avatarUrl}
                    variant="active"
                    timeActiveLabel={s.endTime ? daysRemaining(s.endTime) : '—'}
                    onOpen={() => navigate(`/assets/${s.registryAssetId}`)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <p className={hubStyles.status}>No active subscriptions.</p>
          )}

          {expiredSubs.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Expired</h2>
              <div className={hubStyles.grid}>
                {expiredSubs.map((s) => (
                  <CreatorHubCard
                    key={s.id}
                    assetAddress={s.assetAddress}
                    creatorName={s.serviceName ?? 'Creator'}
                    avatarUrl={s.avatarUrl}
                    variant="expired"
                    expiredBadgeLabel={s.isRevoked ? 'Revoked' : 'Expired'}
                    timeActiveLabel={s.isRevoked ? 'Revoked' : 'Expired'}
                    onOpen={() => navigate(`/assets/${s.registryAssetId}`)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
