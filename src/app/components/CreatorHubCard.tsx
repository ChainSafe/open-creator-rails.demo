import { useQuery } from '@tanstack/react-query'
import type { Hex } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'

import { assetCoverImageUrl } from '../assetCoverImage'
import { appConfig } from '../config'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { erc20MetadataAbi } from '../erc20Permit'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import styles from './CreatorHubCard.module.scss'

const MONTH_SECONDS = 30n * 24n * 60n * 60n

function shortenAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`
}

export type CreatorHubCardVariant = 'hub' | 'active' | 'expired' | 'admin'

type Props = {
  assetAddress: Hex
  creatorName: string
  /** Public avatar from creator profile; falls back to address-derived cover. */
  avatarUrl?: string
  /** Creator name/avatar still loading (e.g. Google Sheet). */
  isLoadingMeta?: boolean
  onOpen: () => void
  /** Hub browse (default), subscribed active, or expired subscription. */
  variant?: CreatorHubCardVariant
  /** Shown in the card footer for active subscriptions (e.g. "12 Days Left"). */
  timeActiveLabel?: string
  /** Cover badge when variant is expired (e.g. "Expired" or "Revoked"). */
  expiredBadgeLabel?: string
}

export function CreatorHubCard({
  assetAddress,
  creatorName,
  avatarUrl,
  isLoadingMeta = false,
  onOpen,
  variant = 'hub',
  timeActiveLabel,
  expiredBadgeLabel = 'Expired',
}: Props) {
  const sdk = useOcrSdk()
  const publicClient = usePublicClient({ chainId: appConfig.chain.id })
  const { address } = useAccount()
  const isHub = variant === 'hub'
  const needsPricing = variant === 'hub' || variant === 'admin'

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddress, address],
    queryFn: async () => {
      if (!sdk || !address) throw new Error('Missing sdk or address')
      return sdk.Asset.getSubscriptionStatus({
        assetAddress,
        subscriberId: DEMO_SUBSCRIBER_ID,
        user: address,
        source: 'auto',
      })
    },
    enabled: Boolean(isHub && sdk && address && !isLoadingMeta),
  })

  const tokenAddressQuery = useQuery({
    queryKey: ['ocr', 'hubCardToken', assetAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return sdk.Asset.getTokenAddress({ assetAddress })
    },
    enabled: Boolean(needsPricing && sdk && !isLoadingMeta),
  })

  const priceQuery = useQuery({
    queryKey: ['ocr', 'hubCardPrice', assetAddress, MONTH_SECONDS.toString()],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      const count = await countPeriodsCoveringSeconds(sdk, assetAddress, MONTH_SECONDS)
      const price = await sdk.Asset.getSubscriptionPrice({ assetAddress, count })
      return { price }
    },
    enabled: Boolean(needsPricing && sdk && !isLoadingMeta),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['ocr', 'hubCardTokenMeta', tokenAddressQuery.data],
    queryFn: async () => {
      if (!publicClient || !tokenAddressQuery.data) throw new Error('Missing token')
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
    enabled: Boolean(needsPricing && publicClient && tokenAddressQuery.data && !isLoadingMeta),
  })

  const hubIsActive = Boolean(address && statusQuery.data?.isActive)

  const priceLabel =
    priceQuery.data && tokenMetaQuery.data
      ? `${formatUnits(priceQuery.data.price, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name} / Mo`
      : priceQuery.isLoading
        ? '…'
        : '—'

  const coverSeed = assetAddress.slice(2, 10)
  const coverImageUrl = avatarUrl ?? assetCoverImageUrl(assetAddress, 640, 360)
  const avatarImageUrl = avatarUrl ?? `https://picsum.photos/seed/avatar-${coverSeed}/96/96`

  const coverBadge =
    variant === 'admin' ? (
      <span className={styles.liveBadge}>
        <span className={styles.liveDot} aria-hidden />
        Live
      </span>
    ) : variant === 'active' ? (
      <span className={styles.activeBadge}>Active</span>
    ) : variant === 'expired' ? (
      <span className={styles.expiredBadge}>{expiredBadgeLabel}</span>
    ) : hubIsActive ? (
      <span className={styles.activeBadge}>Active</span>
    ) : null

  const teaser =
    variant === 'admin'
      ? 'Update subscription pricing and gated content on the creator page.'
      : variant === 'active'
        ? 'You have access to subscriber-only content from this creator.'
        : variant === 'expired'
          ? 'Your subscription has ended. Re-subscribe to unlock content again.'
          : hubIsActive
            ? 'You have access to subscriber-only content from this creator.'
            : 'Subscribe to unlock video, image and article from this creator.'

  const footerMeta =
    variant === 'active' && timeActiveLabel ? (
      <span className={styles.timeActive}>{timeActiveLabel}</span>
    ) : variant === 'expired' ? (
      <span className={styles.timeActiveMuted}>{timeActiveLabel ?? expiredBadgeLabel}</span>
    ) : (
      <span className={styles.price}>{priceLabel}</span>
    )

  const actionLabel =
    variant === 'admin'
      ? 'Manage'
      : variant === 'active' || (variant === 'hub' && hubIsActive)
        ? 'View Content'
        : variant === 'expired'
          ? 'Re-Subscribe'
          : 'Subscribe'

  const actionClass =
    variant === 'admin' ||
    variant === 'active' ||
    (variant === 'hub' && hubIsActive)
      ? styles.btnGhost
      : styles.btnPrimary

  return (
    <article
      className={`${styles.card}${isLoadingMeta ? ` ${styles.cardLoading}` : ''}`}
      onClick={isLoadingMeta ? undefined : onOpen}
      onKeyDown={
        isLoadingMeta
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            }
      }
      role={isLoadingMeta ? 'status' : 'button'}
      tabIndex={isLoadingMeta ? -1 : 0}
      aria-busy={isLoadingMeta}
      aria-label={isLoadingMeta ? 'Loading creator' : undefined}
    >
      <div className={styles.coverWrap}>
        <div
          className={`${styles.cover}${isLoadingMeta ? ` ${styles.shimmer}` : ''}`}
          style={isLoadingMeta ? undefined : { backgroundImage: `url(${coverImageUrl})` }}
          aria-hidden
        />
        {isLoadingMeta ? (
          <span className={styles.loadingOverlay} aria-hidden>
            <span className={styles.spinner} />
          </span>
        ) : (
          coverBadge
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.identity}>
          <div
            className={`${styles.avatar}${isLoadingMeta ? ` ${styles.shimmer}` : ''}`}
            style={isLoadingMeta ? undefined : { backgroundImage: `url(${avatarImageUrl})` }}
            aria-hidden
          />
          <div className={styles.identityText}>
            {isLoadingMeta ? (
              <>
                <span className={`${styles.nameSkeleton} ${styles.shimmer}`} />
                <span className={`${styles.addressSkeleton} ${styles.shimmer}`} />
              </>
            ) : (
              <>
                <h3 className={styles.name}>{creatorName}</h3>
                <p className={styles.address}>{shortenAddress(assetAddress)}</p>
              </>
            )}
          </div>
        </div>

        {isLoadingMeta ? (
          <div className={styles.teaserSkeleton}>
            <span className={`${styles.teaserLine} ${styles.shimmer}`} />
            <span className={`${styles.teaserLine} ${styles.shimmer}`} />
          </div>
        ) : (
          <p className={styles.teaser}>{teaser}</p>
        )}

        <div className={styles.footer}>
          {isLoadingMeta ? (
            <span className={`${styles.priceSkeleton} ${styles.shimmer}`} />
          ) : (
            <>
              {footerMeta}
              <button
                type="button"
                className={actionClass}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen()
                }}
              >
                {actionLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
