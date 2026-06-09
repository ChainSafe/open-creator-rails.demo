import { useMemo, useState } from 'react'
import { formatUnits, isHex } from 'viem'
import type { Hex } from 'viem'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { Button } from './Button'
import { Input } from './Input'
import { appConfig } from '../config'
import { DEMO_SUBSCRIBER_ID, X402_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import { erc20PermitAbi } from '../erc20Permit'
import { signAssetPermit } from '../signPermit'
import { isActiveForDemoOrX402, waitForSubscriptionActive } from '../subscriptionActive'
import { buildX402PaymentBody, x402Health, x402Settle, x402Verify } from '../x402Client'
import type { PetShopPaymentPath } from '../petShop/petShopPaymentMode'
import { useToast } from '../toast/useToast'
import styles from './SubscribeToAssetButton.module.scss'

type Props = {
  assetId: Hex
  /** Smaller layout for list rows (Registry / Your Assets). */
  compact?: boolean
  /** Stitch-style unlock CTA on creator detail (locked). */
  unlockPanel?: boolean
  creatorName?: string
  /** Initial days input (non–pet-shop compact / full layouts). */
  initialDays?: number
  /** Pet shop: show only direct or gasless (set from page preset / picker). */
  paymentPath?: PetShopPaymentPath
}

const MONTH_SECONDS = 30n * 24n * 60n * 60n
const DEFAULT_PET_SHOP_MINUTES = 5

function minutesToPeriodCount(minutes: number, periodSeconds: bigint): bigint {
  const calendarSeconds = BigInt(Math.max(1, minutes)) * 60n
  if (periodSeconds <= 0n) return 1n
  return (calendarSeconds + periodSeconds - 1n) / periodSeconds
}

export function SubscribeToAssetButton({
  assetId,
  compact = false,
  unlockPanel = false,
  creatorName = 'this creator',
  initialDays = 30,
  paymentPath,
}: Props) {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })
  const publicClient = usePublicClient({ chainId: appConfig.chain.id })
  const petShopCompact = appConfig.petShopDemo && compact
  const facilitatorUrl = appConfig.x402FacilitatorUrl
  const [days, setDays] = useState(initialDays)
  const [minutes, setMinutes] = useState(DEFAULT_PET_SHOP_MINUTES)

  const durationSeconds = useMemo(() => BigInt(Math.max(1, days)) * 24n * 60n * 60n, [days])

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return await sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId && isHex(assetId)),
  })

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddressQuery.data, address],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      if (!address) throw new Error('Missing address')
      return isActiveForDemoOrX402(sdk, assetAddressQuery.data, address)
    },
    enabled: Boolean(sdk && assetAddressQuery.data && address),
  })

  const facilitatorHealthQuery = useQuery({
    queryKey: ['x402', 'health', facilitatorUrl],
    queryFn: async () => {
      if (!facilitatorUrl) return false
      return x402Health(facilitatorUrl)
    },
    enabled: Boolean(facilitatorUrl),
    refetchInterval: 30_000,
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

  const periodSecondsQuery = useQuery({
    queryKey: ['ocr', 'subscriptionPeriod', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return sdk.Asset.getSubscriptionDuration({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(petShopCompact && sdk && assetAddressQuery.data),
  })

  const periodSeconds = periodSecondsQuery.data ?? 300n

  const subscriptionCount = useMemo(() => {
    if (!petShopCompact) return null
    return minutesToPeriodCount(minutes, periodSeconds)
  }, [petShopCompact, minutes, periodSeconds])

  const priceQuery = useQuery({
    queryKey: [
      'ocr',
      'assetPrice',
      assetAddressQuery.data,
      petShopCompact ? `minutes:${minutes}` : durationSeconds.toString(),
    ],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      const count =
        subscriptionCount ??
        (await countPeriodsCoveringSeconds(sdk, assetAddressQuery.data, durationSeconds))
      return await sdk.Asset.getSubscriptionPrice({ assetAddress: assetAddressQuery.data, count })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const monthlyPriceQuery = useQuery({
    queryKey: ['ocr', 'assetMonthlyPrice', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      const count = await countPeriodsCoveringSeconds(sdk, assetAddressQuery.data, MONTH_SECONDS)
      return sdk.Asset.getSubscriptionPrice({ assetAddress: assetAddressQuery.data, count })
    },
    enabled: Boolean(unlockPanel && sdk && assetAddressQuery.data),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['token', 'meta', tokenAddressQuery.data],
    queryFn: async () => {
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!publicClient) throw new Error('Public client not available')
      const [name, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20PermitAbi,
          functionName: 'name',
          args: [],
        }),
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20PermitAbi,
          functionName: 'decimals',
          args: [],
        }),
      ])
      const d = typeof decimals === 'bigint' ? Number(decimals) : (decimals as number)
      return { name: name as string, decimals: d }
    },
    enabled: Boolean(tokenAddressQuery.data && publicClient),
  })

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!publicClient) throw new Error('Public client not ready')
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!priceQuery.data) throw new Error('Missing price')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')

      const assetAddress = assetAddressQuery.data
      const count =
        subscriptionCount ?? (await countPeriodsCoveringSeconds(sdk, assetAddress, durationSeconds))

      const permit = await signAssetPermit({
        publicClient,
        walletClient,
        owner: address,
        token: tokenAddressQuery.data,
        spender: assetAddress,
        value: priceQuery.data,
        chainId: appConfig.chain.id,
      })

      const txHash = await sdk.AssetRegistry.subscribe({
        assetId,
        subscriberId: DEMO_SUBSCRIBER_ID,
        subscriberAddress: address,
        payer: address,
        count,
        deadline: permit.deadline,
        v: permit.v,
        r: permit.r,
        s: permit.s,
      })

      await publicClient.waitForTransactionReceipt({ hash: txHash })
      return txHash
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ocr', 'subscriptionStatus'] })
      await qc.invalidateQueries({ queryKey: ['indexer', 'listSubscriptionsByUser'] })
      await qc.invalidateQueries({ queryKey: ['petShop', 'unityPets'] })
      await qc.invalidateQueries({ queryKey: ['mockApi', 'gatedContent'] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err)
      showToast(message, { variant: 'error' })
    },
  })

  const subscribeX402Mutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!publicClient) throw new Error('Public client not ready')
      if (!facilitatorUrl) throw new Error('Set VITE_X402_FACILITATOR_URL')
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!priceQuery.data) throw new Error('Missing price')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')

      const assetAddress = assetAddressQuery.data
      const count =
        subscriptionCount ?? (await countPeriodsCoveringSeconds(sdk, assetAddress, durationSeconds))

      const permit = await signAssetPermit({
        publicClient,
        walletClient,
        owner: address,
        token: tokenAddressQuery.data,
        spender: assetAddress,
        value: priceQuery.data,
        chainId: appConfig.chain.id,
      })

      const body = buildX402PaymentBody({
        chainId: appConfig.chain.id,
        payer: address,
        assetAddress,
        tokenAddress: tokenAddressQuery.data,
        count,
        permit,
      })

      const verify = await x402Verify(facilitatorUrl, body)
      if (!verify.isValid) {
        throw new Error(verify.invalidReason ?? 'Payment verification failed')
      }

      const settle = await x402Settle(facilitatorUrl, body)
      if (!settle?.success) {
        throw new Error('Facilitator settle did not succeed')
      }

      await waitForSubscriptionActive(sdk, assetAddress, address, X402_SUBSCRIBER_ID)
      return settle.transaction ?? null
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ocr', 'subscriptionStatus'] })
      await qc.invalidateQueries({ queryKey: ['indexer', 'listSubscriptionsByUser'] })
      await qc.invalidateQueries({ queryKey: ['petShop', 'unityPets'] })
      await qc.invalidateQueries({ queryKey: ['mockApi', 'gatedContent'] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err)
      showToast(message, { variant: 'error' })
    },
  })

  const isSubscribing = subscribeMutation.isPending || subscribeX402Mutation.isPending
  const canSubscribeGasless =
    Boolean(facilitatorUrl) &&
    facilitatorHealthQuery.data === true &&
    Boolean(priceQuery.data) &&
    Boolean(tokenAddressQuery.data) &&
    Boolean(assetAddressQuery.data)

  const showDirect = paymentPath == null || paymentPath === 'direct'
  const showGasless = paymentPath == null || paymentPath === 'gasless'

  const monthlyLabel =
    monthlyPriceQuery.data && tokenMetaQuery.data
      ? formatUnits(monthlyPriceQuery.data, tokenMetaQuery.data.decimals)
      : null
  const totalLabel =
    priceQuery.data && tokenMetaQuery.data
      ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
      : priceQuery.isLoading
        ? '…'
        : '—'

  if (unlockPanel) {
    return (
      <div className={styles.unlockPanel}>
        <div className={styles.unlockIconWrap}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            lock
          </span>
        </div>
        <h2 className={styles.unlockTitle}>Content Locked</h2>
        <p className={styles.unlockSubtitle}>
          Access exclusive video, image and article from {creatorName}.
        </p>

        <div className={styles.priceTier}>
          <span className={styles.tierLabel}>Subscription</span>
          <div className={styles.tierPriceRow}>
            <span className={styles.tierPriceAmount}>
              {monthlyLabel ?? (monthlyPriceQuery.isLoading ? '…' : '—')}
            </span>
            <span className={styles.tierPriceUnit}>
              {tokenMetaQuery.data?.name ?? 'token'} / month
            </span>
          </div>
          <div className={styles.tierDaysRow}>
            <label className={styles.tierDaysLabel} htmlFor={`sub-days-${assetId}`}>
              Days to subscribe
            </label>
            <Input
              id={`sub-days-${assetId}`}
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={styles.tierDaysInput}
            />
            <span className={styles.tierTotal}>
              Total: <strong>{totalLabel}</strong>
            </span>
          </div>
        </div>

        {!isConnected ? (
          <p className={styles.unlockHint}>Connect a wallet to subscribe.</p>
        ) : !walletClient ? (
          <p className={styles.unlockHint}>
            Switch your wallet to <strong>{appConfig.chain.name}</strong> to subscribe.
          </p>
        ) : statusQuery.data?.active ? (
          <p className={styles.unlockHint}>
            <strong>Already subscribed</strong>
          </p>
        ) : (
          <>
            {showDirect ? (
              <button
                type="button"
                className={styles.unlockCta}
                disabled={
                  !sdk ||
                  !assetAddressQuery.data ||
                  !tokenAddressQuery.data ||
                  !priceQuery.data ||
                  isSubscribing
                }
                aria-busy={isSubscribing || undefined}
                onClick={() => subscribeMutation.mutate()}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <span className={styles.unlockSpinner} aria-hidden />
                    Subscribing…
                  </>
                ) : paymentPath === 'direct' ? (
                  'Subscribe to Unlock Access'
                ) : (
                  'Subscribe (wallet pays gas)'
                )}
              </button>
            ) : null}
            {showGasless && facilitatorUrl ? (
              <button
                type="button"
                className={showDirect ? styles.unlockCtaSecondary : styles.unlockCta}
                disabled={!canSubscribeGasless || isSubscribing}
                onClick={() => subscribeX402Mutation.mutate()}
              >
                {subscribeX402Mutation.isPending ? 'Settling…' : 'Subscribe (gasless)'}
              </button>
            ) : null}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={compact ? `${styles.container} ${styles.compactContainer}` : styles.container}>
      {!compact ? (
        <>
          <p>
            Token: <code>{tokenAddressQuery.data ?? '(loading)'}</code>
          </p>
          <p>
            Days to subscribe:{' '}
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={styles.daysInput}
            />{' '}
            days
          </p>
          <p>
            Total for selected days:{' '}
            <code>
              {priceQuery.data && tokenMetaQuery.data
                ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
                : priceQuery.isLoading
                  ? 'Loading…'
                  : '—'}
            </code>
          </p>
        </>
      ) : petShopCompact ? (
        <>
          <label className={styles.compactDaysLabel}>
            <span>Min</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              size="sm"
              className={styles.compactDaysInput}
              disabled={isSubscribing}
            />
          </label>
          <span className={styles.compactPrice}>
            {priceQuery.data && tokenMetaQuery.data
              ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
              : priceQuery.isLoading
                ? '…'
                : '—'}
          </span>
        </>
      ) : (
        <>
          <label className={styles.compactDaysLabel}>
            <span>Days</span>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              size="sm"
              className={styles.compactDaysInput}
              disabled={isSubscribing}
            />
          </label>
          <span className={styles.compactPrice}>
            {priceQuery.data && tokenMetaQuery.data
              ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
              : priceQuery.isLoading
                ? '…'
                : '—'}
          </span>
        </>
      )}

      {!isConnected ? (
        <span className={compact ? styles.connectHintCompact : styles.connectHint}>Connect a wallet to subscribe.</span>
      ) : !walletClient ? (
        <span className={compact ? styles.connectHintCompact : styles.connectHint}>
          Switch your wallet to <strong>{appConfig.chain.name}</strong> to subscribe.
        </span>
      ) : statusQuery.data?.active ? (
        <span className={compact ? styles.subscribedCompact : undefined}>
          <strong>Subscribed</strong>
        </span>
      ) : (
        <>
          {showDirect ? (
            <Button
              type="button"
              variant="primary"
              size={compact ? 'sm' : 'md'}
              className={petShopCompact ? styles.compactSubscribe : undefined}
              loading={subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate()}
              disabled={
                isSubscribing ||
                !sdk ||
                !assetAddressQuery.data ||
                !tokenAddressQuery.data ||
                !priceQuery.data
              }
            >
              {subscribeMutation.isPending
                ? 'Subscribing…'
                : petShopCompact
                  ? 'Subscribe'
                  : 'Subscribe (gas)'}
            </Button>
          ) : null}
          {showGasless && facilitatorUrl ? (
            <Button
              type="button"
              variant={petShopCompact ? 'primary' : 'secondary'}
              size={compact ? 'sm' : 'md'}
              className={petShopCompact ? styles.compactSubscribe : undefined}
              loading={subscribeX402Mutation.isPending}
              onClick={() => subscribeX402Mutation.mutate()}
              disabled={isSubscribing || !canSubscribeGasless}
            >
              {subscribeX402Mutation.isPending
                ? 'Settling…'
                : petShopCompact
                  ? 'Subscribe'
                  : 'Gasless'}
            </Button>
          ) : null}
        </>
      )}

      {!compact && subscribeMutation.data ? (
        <p>
          Tx: <code>{subscribeMutation.data}</code>
        </p>
      ) : null}
    </div>
  )
}
