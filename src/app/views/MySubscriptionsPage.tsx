import { cancelSubscriptionDigest, subscriberHash, type IndexerSubscription } from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MouseEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Address, Hex } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import { useToast } from '../toast/ToastContext'
import styles from './MySubscriptionsPage.module.scss'

type SubscriptionWithMeta = IndexerSubscription & {
  registryAssetId: Hex
  serviceName?: string
  endpointUrl?: string
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

/** Same rule as indexer `Subscription.isActive` (open-creator-rails.indexer `api/subscription/resolvers.ts`). */
function subscriptionRowIsActive(s: { isRevoked: boolean; startTime: bigint; endTime: bigint }, now: bigint): boolean {
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

function stopRowNavWhenInteractive(e: MouseEvent<HTMLElement>) {
  const el = e.target as HTMLElement
  if (el.closest('button, input, label, a, [role="button"]')) {
    e.stopPropagation()
  }
}

export function MySubscriptionsPage() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [copyFlashId, setCopyFlashId] = useState<string | null>(null)

  const cancelMutation = useMutation({
    mutationFn: async (assetAddress: Address) => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      if (!walletClient) throw new Error('Wallet not ready')

      const sub = subscriberHash(DEMO_SUBSCRIBER_ID, address)
      const digest = cancelSubscriptionDigest(appConfig.chain.id, assetAddress, sub)
      const signature = await walletClient.signMessage({
        account: address,
        message: { raw: digest },
      })

      return sdk.Asset.cancelSubscription({
        assetAddress,
        subscriberId: DEMO_SUBSCRIBER_ID,
        signature: signature as Hex,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['indexer', 'listSubscriptionsByUser'] })
      await qc.invalidateQueries({ queryKey: ['ocr', 'subscriptionStatus'] })
    },
  })

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
          let endpointUrl: string | undefined
          try {
            const resp = await fetch(`${appConfig.mockApiUrl}/api/asset-name?assetAddress=${assetAddress}`)
            if (resp.ok) {
              const data = await resp.json()
              serviceName = data.name
              endpointUrl = data.endpointUrl
            }
          } catch { /* ignore */ }

          return { ...s, assetAddress, registryAssetId, serviceName, endpointUrl }
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
    <div className={styles.root}>
      {/* Page Header */}
      <header className={styles.pageHeader}>
        <h1>My Subscriptions</h1>
        <p className={styles.pageSubtitle}>
          Manage your active API subscriptions.
        </p>
      </header>

      {!address ? (
        <p className={styles.connectPrompt}>Connect wallet to view subscriptions.</p>
      ) : subsQuery.isLoading ? (
        <p className={styles.connectPrompt}>Loading…</p>
      ) : (
        <>
          {/* Active Subscriptions */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={`material-symbols-outlined ${styles.sectionIcon}`}>bolt</span>
              Active Subscriptions
            </h2>

            {activeSubs.length === 0 ? (
              <p className={styles.connectPrompt}>No active subscriptions.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableHeaderCell}>API Service</div>
                  <div className={styles.tableHeaderCell}>Base URL</div>
                  <div className={styles.tableHeaderCell}>Status</div>
                </div>
                {activeSubs.map((s) => (
                  <div
                    key={s.id}
                    className={styles.tableRow}
                    onClick={() => navigate(`/assets/${s.registryAssetId}`)}
                  >
                    <div>
                      <div className={styles.tableRowMobileLabel}>API Service</div>
                      <div className={styles.serviceName}>
                        {s.serviceName ?? s.assetAddress.slice(0, 10) + '…'}
                      </div>
                    </div>
                    <div>
                      <div className={styles.tableRowMobileLabel}>Base URL</div>
                      <div className={styles.baseUrl}>
                        <code
                          className={styles.baseUrlCode}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {s.endpointUrl ?? '—'}
                        </code>
                        <span
                          role="button"
                          tabIndex={0}
                          className={`material-symbols-outlined ${styles.copyIcon} ${copyFlashId === s.id ? styles.copyIconFlash : ''}`}
                          title="Copy URL"
                          onClick={(e) => {
                            e.stopPropagation()
                            const text = s.endpointUrl ?? s.assetAddress
                            void navigator.clipboard.writeText(text).then(
                              () => {
                                showToast('URL copied to clipboard', { variant: 'success' })
                                setCopyFlashId(s.id)
                                window.setTimeout(() => {
                                  setCopyFlashId((cur) => (cur === s.id ? null : cur))
                                }, 220)
                              },
                              () => {
                                showToast('Could not copy to clipboard', { variant: 'error' })
                              },
                            )
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              ;(e.currentTarget as HTMLElement).click()
                            }
                          }}
                        >
                          content_copy
                        </span>
                      </div>
                    </div>
                    <div className={styles.statusCell}>
                      <div className={styles.statusActive}>
                        <span>Active Rail</span>
                        <span className={styles.statusActiveSub}>{s.endTime ? daysRemaining(s.endTime) : '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Expired Subscriptions */}
          {expiredSubs.length > 0 && (
            <section className={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '8px' }}>
                <h2 className={styles.sectionTitle}>
                  <span className={`material-symbols-outlined ${styles.sectionIconMuted}`}>history</span>
                  Expired Subscriptions
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expiredSubs.map((s) => (
                  <div
                    key={s.id}
                    className={styles.expiredCard}
                    onClick={() => navigate(`/assets/${s.registryAssetId}`)}
                  >
                    <div className={styles.expiredCardInfo}>
                      <div className={styles.expiredCardName}>{s.serviceName ?? 'Service'}</div>
                      <code
                        className={styles.expiredCardUrl}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {s.endpointUrl ?? '—'}
                      </code>
                    </div>
                    <div
                      className={styles.expiredCardActions}
                      onClick={stopRowNavWhenInteractive}
                      onMouseDown={stopRowNavWhenInteractive}
                    >
                      <div className={styles.statusExpired}>{s.isRevoked ? 'Revoked' : 'Expired'}</div>
                      <button
                        type="button"
                        className={styles.resubBtn}
                        onClick={() => navigate(`/assets/${s.registryAssetId}`)}
                      >
                        Re-Subscribe
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {cancelMutation.error && (
        <p className={styles.cancelError}>
          Cancel error: <code>{(cancelMutation.error as Error).message}</code>
        </p>
      )}
    </div>
  )
}
