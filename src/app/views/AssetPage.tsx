import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  cancelSubscriptionDigest,
  indexerAssetEntityId,
  resolveOpenCreatorRailsIndexerGraphqlUrl,
  subscriberHash,
} from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatUnits, isAddress, isHex, parseUnits, type Address, type Hex } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { assetCoverImageUrl } from '../assetCoverImage'
import { blockExplorerAddressUrl } from '../blockExplorer'
import type { CreatorGatedContent } from '../creatorProfile'
import { fetchCreatorPublicMeta } from '../demoServicesClient'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { erc20MetadataAbi } from '../erc20Permit'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import { youtubeEmbedUrl } from '../youtubeEmbed'
import styles from './AssetPage.module.scss'

type AssetSubscriberRow = {
  subscriber: Hex
  payer: Address
}

function formatBillingPeriod(seconds: bigint): string {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return '—'
  if (s % 86400 === 0) {
    const days = s / 86400
    return days === 1 ? '1 day' : `${days} days`
  }
  return s === 1 ? '1 second' : `${s} seconds`
}

async function indexerGraphql<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
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

export function AssetPage() {
  const params = useParams<{ assetId: string }>()
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: appConfig.chain.id })
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })

  const [ownerPricePerDayInput, setOwnerPricePerDayInput] = useState('')
  const [newOwnerAddressInput, setNewOwnerAddressInput] = useState('')
  const [claimingFeeTarget, setClaimingFeeTarget] = useState<string | null>(null)

  const assetId = useMemo(() => {
    const v = params.assetId
    if (!v) return null
    if (!isHex(v)) return null
    return v as `0x${string}`
  }, [params.assetId])

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetId) throw new Error('Missing assetId')
      return await sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId),
  })

  const creatorPublicQuery = useQuery({
    queryKey: ['mockApi', 'creatorPublicMeta', assetAddressQuery.data],
    queryFn: async () => {
      const assetAddress = assetAddressQuery.data
      if (!assetAddress) return null
      return fetchCreatorPublicMeta(assetAddress)
    },
    enabled: Boolean(assetAddressQuery.data),
  })

  const ownerQuery = useQuery({
    queryKey: ['ocr', 'assetOwner', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return await sdk.Asset.owner({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const tokenAddressQuery = useQuery({
    queryKey: ['ocr', 'assetToken', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return await sdk.Asset.getTokenAddress({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['ocr', 'assetPageTokenMeta', tokenAddressQuery.data],
    queryFn: async () => {
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!publicClient) throw new Error('Public client not ready')
      const [name, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20MetadataAbi,
          functionName: 'name',
          args: [],
        }),
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20MetadataAbi,
          functionName: 'decimals',
          args: [],
        }),
      ])
      const d = typeof decimals === 'bigint' ? Number(decimals) : (decimals as number)
      return { name: name as string, decimals: d }
    },
    enabled: Boolean(tokenAddressQuery.data && publicClient),
  })

  const ownerReferencePriceQuery = useQuery({
    queryKey: ['ocr', 'ownerReferencePrice', assetAddressQuery.data, '1d'],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      const assetAddress = assetAddressQuery.data
      const count = await countPeriodsCoveringSeconds(sdk, assetAddress, 86400n)
      return await sdk.Asset.getSubscriptionPrice({ assetAddress, count })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const isAssetOwner =
    Boolean(address && assetAddressQuery.data && ownerQuery.data) &&
    address!.toLowerCase() === (ownerQuery.data as Address).toLowerCase()

  useEffect(() => {
    if (!isAssetOwner) return
    const ref = ownerReferencePriceQuery.data
    const meta = tokenMetaQuery.data
    if (ref == null || meta == null) return
    setOwnerPricePerDayInput(formatUnits(ref, meta.decimals))
  }, [isAssetOwner, assetAddressQuery.data, ownerReferencePriceQuery.data, tokenMetaQuery.data])

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddressQuery.data, address],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      if (!address) throw new Error('Missing address')
      return await sdk.Asset.getSubscriptionStatus({
        assetAddress: assetAddressQuery.data,
        subscriberId: DEMO_SUBSCRIBER_ID,
        user: address,
        source: 'auto',
      })
    },
    enabled: Boolean(sdk && assetAddressQuery.data && address),
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      if (!walletClient) throw new Error('Wallet not ready')
      const assetAddress = assetAddressQuery.data
      if (!assetAddress) throw new Error('Missing asset address')

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
      await qc.invalidateQueries({ queryKey: ['ocr', 'subscriptionStatus'] })
      await qc.invalidateQueries({ queryKey: ['indexer', 'listSubscriptionsByUser'] })
      await qc.invalidateQueries({ queryKey: ['mockApi', 'gatedContent'] })
    },
  })

  const updateSubscriptionPriceMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!address) throw new Error('Connect wallet')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      const meta = tokenMetaQuery.data
      if (!meta) throw new Error('Token metadata not loaded')

      const units = parseUnits(ownerPricePerDayInput.trim(), meta.decimals)
      const newSubscriptionPrice = units / 86400n
      if (newSubscriptionPrice <= 0n) {
        throw new Error('Price per day is too low (must cover one on-chain period per second of a day)')
      }

      return sdk.Asset.setSubscriptionPrice({
        assetAddress: assetAddressQuery.data,
        newSubscriptionPrice,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ocr', 'ownerReferencePrice'] })
      await qc.invalidateQueries({ queryKey: ['ocr', 'assetPrice'] })
      await qc.invalidateQueries({ queryKey: ['ocr', 'myAssets', 'price'] })
      await qc.invalidateQueries({ queryKey: ['indexer'] })
    },
  })

  const assetSubscribersQuery = useQuery<AssetSubscriberRow[]>({
    queryKey: ['indexer', 'assetSubscribers', appConfig.indexerUrl, assetAddressQuery.data],
    queryFn: async () => {
      if (!appConfig.indexerUrl) throw new Error('Missing VITE_INDEXER_URL')
      const assetAddress = assetAddressQuery.data
      if (!assetAddress) throw new Error('Missing asset address')

      const graphqlUrl = resolveOpenCreatorRailsIndexerGraphqlUrl(appConfig.indexerUrl)
      const assetEntityId = indexerAssetEntityId(appConfig.chain.id, assetAddress)
      const query = `
        query AssetSubscriptions($assetId: String!) {
          subscriptions(where: { assetId: $assetId }, limit: 200, orderBy: "nonce", orderDirection: "desc") {
            items {
              subscriber
              payer
            }
          }
        }
      `
      const data = await indexerGraphql<{
        subscriptions: { items: Array<{ subscriber: string; payer: string }> }
      }>(graphqlUrl, query, { assetId: assetEntityId })

      const seen = new Set<string>()
      const rows: AssetSubscriberRow[] = []
      for (const item of data.subscriptions.items) {
        const key = item.subscriber.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({
          subscriber: item.subscriber as Hex,
          payer: item.payer as Address,
        })
      }
      return rows
    },
    enabled: Boolean(isAssetOwner && appConfig.indexerUrl && assetAddressQuery.data),
  })

  const subscriptionDurationQuery = useQuery({
    queryKey: ['ocr', 'subscriptionDuration', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return sdk.Asset.getSubscriptionDuration({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(sdk && assetAddressQuery.data && isAssetOwner),
  })

  const claimCreatorFeesMutation = useMutation({
    mutationFn: async (subscribers: readonly Hex[]) => {
      if (!sdk) throw new Error('SDK not ready')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      if (subscribers.length === 0) throw new Error('No subscribers to claim for')

      return sdk.Asset.claimCreatorFeeBatch({
        assetAddress: assetAddressQuery.data,
        subscribers,
      })
    },
    onMutate: (subscribers) => {
      setClaimingFeeTarget(subscribers.length === 1 ? subscribers[0]! : 'all')
    },
    onSettled: () => {
      setClaimingFeeTarget(null)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['indexer'] })
    },
  })

  const transferOwnershipMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!address) throw new Error('Connect wallet')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')

      const trimmed = newOwnerAddressInput.trim()
      if (!isAddress(trimmed)) {
        throw new Error('Enter a valid Ethereum address (0x…)')
      }
      const newOwner = trimmed as Address
      if (ownerQuery.data && newOwner.toLowerCase() === ownerQuery.data.toLowerCase()) {
        throw new Error('New owner is the same as the current owner')
      }

      return sdk.Asset.transferOwnership({
        assetAddress: assetAddressQuery.data,
        newOwner,
      })
    },
    onSuccess: async () => {
      setNewOwnerAddressInput('')
      await qc.invalidateQueries({ queryKey: ['ocr', 'assetOwner'] })
      await qc.invalidateQueries({ queryKey: ['indexer'] })
    },
  })

  const gatedContentQuery = useQuery<CreatorGatedContent | null>({
    queryKey: ['mockApi', 'gatedContent', assetAddressQuery.data, address],
    queryFn: async () => {
      const assetAddress = assetAddressQuery.data
      if (!assetAddress || !address) return null
      const url = `${appConfig.mockApiUrl}/api/gated-urls?assetAddress=${assetAddress}&user=${address}`
      const resp = await fetch(url)
      if (resp.status === 403) return null
      if (!resp.ok) throw new Error(`Mock API error: ${resp.status}`)
      return (await resp.json()) as CreatorGatedContent
    },
    enabled: Boolean(statusQuery.data?.isActive && assetAddressQuery.data && address),
  })

  const isSubscribed = Boolean(address && statusQuery.data?.isActive)
  const creatorName =
    creatorPublicQuery.data?.name ?? gatedContentQuery.data?.name ?? 'Creator'
  const assetAddress = assetAddressQuery.data
  const explorerUrl = assetAddress ? blockExplorerAddressUrl(assetAddress) : null
  const embedUrl = gatedContentQuery.data?.videoUrl
    ? youtubeEmbedUrl(gatedContentQuery.data.videoUrl)
    : null

  const fallbackCoverUrl = assetAddress ? assetCoverImageUrl(assetAddress, 640, 360) : null
  const publicAvatarUrl = creatorPublicQuery.data?.avatarUrl
  const portraitUrl = publicAvatarUrl ?? fallbackCoverUrl
  const lockedPreviewUrl = publicAvatarUrl ?? fallbackCoverUrl

  if (assetId === null && params.assetId) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Invalid asset id (must be 0x…)</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {isSubscribed ? (
        <div className={styles.statusBar} role="status">
          <div className={styles.statusBarLabel}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            Subscription Active
          </div>
        </div>
      ) : null}

      <header className={styles.creatorHeader}>
        <div className={styles.creatorIdentity}>
          {portraitUrl ? (
            <div className={styles.portraitFrame}>
              <img src={portraitUrl} alt={creatorName} className={styles.portrait} />
            </div>
          ) : null}
          <div>
            <h1 className={styles.creatorTitle}>{creatorName}</h1>
            {assetAddress ? (
              explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.assetLink}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    open_in_new
                  </span>
                  {assetAddress}
                </a>
              ) : (
                <span className={styles.assetAddressPlain}>{assetAddress}</span>
              )
            ) : assetAddressQuery.isLoading ? (
              <span className={styles.loading}>Loading asset…</span>
            ) : null}
          </div>
        </div>
      </header>

      {isAssetOwner && assetAddressQuery.data ? (
        <details className={styles.ownerDisclosure}>
          <summary className={styles.ownerDisclosureSummary}>
            <span className={styles.ownerBadge}>Creator owner</span>
            <span className={styles.ownerDisclosureAction}>
              Manage creator
              <span
                className={`material-symbols-outlined ${styles.ownerDisclosureChevron}`}
                aria-hidden
              >
                expand_more
              </span>
            </span>
          </summary>

          <div className={styles.ownerPanelBody}>
            <p className={styles.ownerSectionLead}>
              Your wallet is the on-chain owner of this creator asset. Only you can update
              subscription pricing, transfer ownership, or claim your share of subscriber fees.
            </p>

            <h2 id="owner-section-title" className={styles.ownerPanelTitle}>
              Update subscription price
            </h2>
            <p className={styles.ownerHint}>
              Set how much subscribers pay per calendar day. They choose how many days to buy on
              subscribe.
            </p>
            <div className={styles.ownerForm}>
              <div className={styles.ownerField}>
                <label className={styles.ownerFieldLabel} htmlFor="owner-asset-price-per-day">
                  Price per day ({tokenMetaQuery.data?.name ?? 'token'})
                </label>
                <Input
                  id="owner-asset-price-per-day"
                  type="text"
                  inputMode="decimal"
                  value={ownerPricePerDayInput}
                  onChange={(e) => setOwnerPricePerDayInput(e.target.value)}
                  placeholder="0.00"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className={styles.ownerFormActions}>
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    !sdk ||
                    !walletClient ||
                    !tokenMetaQuery.data ||
                    updateSubscriptionPriceMutation.isPending ||
                    !ownerPricePerDayInput.trim()
                  }
                  onClick={() => updateSubscriptionPriceMutation.mutate()}
                >
                  {updateSubscriptionPriceMutation.isPending ? 'Updating…' : 'Update price on-chain'}
                </Button>
              </div>
            </div>
            {updateSubscriptionPriceMutation.data ? (
              <p className={styles.ownerSuccess}>
                Tx: <code>{updateSubscriptionPriceMutation.data}</code>
              </p>
            ) : null}
            {updateSubscriptionPriceMutation.error ? (
              <p className={styles.ownerError}>
                {(updateSubscriptionPriceMutation.error as Error).message}
              </p>
            ) : null}

            <div className={styles.ownerSubsectionDivider} role="separator" />

            <div className={styles.ownerSubsection}>
              <h2 className={styles.ownerPanelTitle}>Transfer creator owner</h2>
              <p className={styles.ownerHint}>
                Assign on-chain ownership to another wallet. The new owner can update price and
                claim fees; you will lose owner controls after the transaction confirms.
              </p>
              {ownerQuery.data ? (
                <p className={styles.ownerCurrent}>
                  Current owner: <code>{ownerQuery.data}</code>
                </p>
              ) : null}
              <div className={styles.ownerForm}>
                <div className={styles.ownerField}>
                  <label className={styles.ownerFieldLabel} htmlFor="owner-asset-new-owner">
                    New owner address
                  </label>
                  <Input
                    id="owner-asset-new-owner"
                    type="text"
                    value={newOwnerAddressInput}
                    onChange={(e) => setNewOwnerAddressInput(e.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div className={styles.ownerFormActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !sdk ||
                      !walletClient ||
                      transferOwnershipMutation.isPending ||
                      !newOwnerAddressInput.trim()
                    }
                    onClick={() => transferOwnershipMutation.mutate()}
                  >
                    {transferOwnershipMutation.isPending ? 'Transferring…' : 'Transfer ownership on-chain'}
                  </Button>
                </div>
              </div>
              {transferOwnershipMutation.data ? (
                <p className={styles.ownerSuccess}>
                  Tx: <code>{transferOwnershipMutation.data}</code>
                </p>
              ) : null}
              {transferOwnershipMutation.error ? (
                <p className={styles.ownerError}>
                  {(transferOwnershipMutation.error as Error).message}
                </p>
              ) : null}
            </div>

            <div className={styles.ownerSubsectionDivider} role="separator" />

            <div className={styles.ownerSubsection}>
              <h2 className={styles.ownerPanelTitle}>Claim creator fees</h2>
              <p className={styles.ownerHint}>
                Billing period:{' '}
                {subscriptionDurationQuery.isLoading
                  ? 'Loading…'
                  : subscriptionDurationQuery.data != null
                    ? formatBillingPeriod(subscriptionDurationQuery.data)
                    : '—'}
                . Creator fees unlock after each full period has elapsed.
              </p>
              {assetSubscribersQuery.isLoading ? (
                <p className={styles.loading}>Loading subscribers…</p>
              ) : assetSubscribersQuery.error ? (
                <p className={styles.ownerError}>
                  {(assetSubscribersQuery.error as Error).message}
                </p>
              ) : (assetSubscribersQuery.data ?? []).length === 0 ? (
                <p className={styles.ownerEmpty}>No subscribers indexed for this creator yet.</p>
              ) : (
                <ul className={styles.subscriberClaimList}>
                  {(assetSubscribersQuery.data ?? []).map((row) => {
                    const isClaiming =
                      claimCreatorFeesMutation.isPending &&
                      claimingFeeTarget === row.subscriber

                    return (
                      <li key={row.subscriber} className={styles.subscriberClaimRow}>
                        <code className={styles.subscriberClaimPayer}>{row.payer}</code>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!sdk || !walletClient || claimCreatorFeesMutation.isPending}
                          onClick={() => claimCreatorFeesMutation.mutate([row.subscriber])}
                        >
                          {isClaiming ? 'Claiming…' : 'Claim'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {claimCreatorFeesMutation.data ? (
                <p className={styles.ownerSuccess}>
                  Tx: <code>{claimCreatorFeesMutation.data}</code>
                </p>
              ) : null}
              {claimCreatorFeesMutation.error ? (
                <p className={styles.ownerError}>
                  {(claimCreatorFeesMutation.error as Error).message}
                </p>
              ) : null}
            </div>

            {assetId ? (
              <div className={styles.ownerPanelFooter}>
                <Link to={`/assets/${assetId}/history`} className={styles.ownerHistoryLink}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    history
                  </span>
                  View subscription history
                </Link>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {isSubscribed ? (
        <div className={styles.grid}>
          <div className={styles.mainCol}>
            {gatedContentQuery.isLoading ? <p className={styles.loading}>Loading content…</p> : null}
            {gatedContentQuery.error ? (
              <p className={styles.error}>{(gatedContentQuery.error as Error).message}</p>
            ) : null}
            {embedUrl ? (
              <div className={styles.videoPanel}>
                <iframe
                  className={styles.videoFrame}
                  src={embedUrl}
                  title={`${creatorName} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
            {gatedContentQuery.data?.article ? (
              <article className={styles.article}>
                <div className={styles.articleRule}>
                  <span className={styles.articleLabel}>Subscriber post</span>
                </div>
                <p className={styles.articleBody}>{gatedContentQuery.data.article}</p>
              </article>
            ) : !gatedContentQuery.isLoading ? (
              <p className={styles.loading}>No article available.</p>
            ) : null}
          </div>

          <aside className={styles.sideCol}>
            {gatedContentQuery.data?.contentImageUrl ? (
              <div className={styles.imagePanel}>
                <img
                  src={gatedContentQuery.data.contentImageUrl}
                  alt={creatorName}
                  className={styles.featuredImage}
                />
              </div>
            ) : fallbackCoverUrl ? (
              <div className={styles.imagePanel}>
                <img src={fallbackCoverUrl} alt={creatorName} className={styles.featuredImage} />
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className={styles.lockedCanvas}>
          <div className={styles.blurredPreview} aria-hidden>
            <div className={styles.blurMain}>
              <div
                className={styles.blurVideo}
                style={lockedPreviewUrl ? { backgroundImage: `url(${lockedPreviewUrl})` } : undefined}
              />
              <div className={styles.blurArticle}>
                <div className={`${styles.blurLine} ${styles.short}`} />
                <div className={styles.blurLine} />
                <div className={styles.blurLine} />
                <div className={`${styles.blurLine} ${styles.shorter}`} />
              </div>
            </div>
            <div
              className={styles.blurImage}
              style={lockedPreviewUrl ? { backgroundImage: `url(${lockedPreviewUrl})` } : undefined}
            />
          </div>
          <div className={styles.lockOverlay}>
            {assetId ? (
              appConfig.petShopDemo ? (
                <div className={styles.petShopSubscribeWrap}>
                  <p className={styles.petShopSubscribeLead}>
                    Subscribe to add <strong>{creatorName}</strong> to your farm.
                  </p>
                  <SubscribeToAssetButton assetId={assetId} compact />
                </div>
              ) : (
                <SubscribeToAssetButton
                  assetId={assetId}
                  unlockPanel
                  creatorName={creatorName}
                />
              )
            ) : null}
          </div>
        </div>
      )}

      {isSubscribed && address && assetAddressQuery.data ? (
        <div className={styles.cancelRow}>
          <Button
            type="button"
            variant="danger"
            disabled={!sdk || !walletClient || cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
          {cancelMutation.error ? (
            <p className={styles.cancelError}>{(cancelMutation.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}

    </div>
  )
}
