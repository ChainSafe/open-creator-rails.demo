import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelSubscriptionDigest, subscriberHash } from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatUnits, isHex, parseUnits, type Address, type Hex } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { erc20MetadataAbi } from '../erc20Permit'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import styles from './AssetPage.module.scss'

interface GatedContent {
  name: string
  url: string
}

export function AssetPage() {
  const params = useParams<{ assetId: string }>()
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: appConfig.chain.id })
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })

  const [ownerPricePerDayInput, setOwnerPricePerDayInput] = useState('')

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

  const serviceNameQuery = useQuery({
    queryKey: ['mockApi', 'assetName', assetAddressQuery.data],
    queryFn: async () => {
      const assetAddress = assetAddressQuery.data
      if (!assetAddress) return null
      const resp = await fetch(`${appConfig.mockApiUrl}/api/asset-name?assetAddress=${assetAddress}`)
      if (!resp.ok) return null
      const data = await resp.json()
      return data.name as string
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
      if (newSubscriptionPrice <= 0n) throw new Error('Price per day is too low (must cover one on-chain period per second of a day)')

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

  const gatedContentQuery = useQuery<GatedContent | null>({
    queryKey: ['mockApi', 'gatedContent', assetAddressQuery.data, address],
    queryFn: async () => {
      const assetAddress = assetAddressQuery.data
      if (!assetAddress || !address) return null
      const url = `${appConfig.mockApiUrl}/api/gated-urls?assetAddress=${assetAddress}&user=${address}`
      const resp = await fetch(url)
      if (resp.status === 403) return null
      if (!resp.ok) throw new Error(`Mock API error: ${resp.status}`)
      return await resp.json()
    },
    enabled: Boolean(statusQuery.data?.isActive && assetAddressQuery.data && address),
  })

  const showSubscribe = !(address && statusQuery.data?.isActive)

  return (
    <div>
      <h1>{serviceNameQuery.data ?? 'Asset'}</h1>

      <details className={styles.detailsBlock}>
        <summary>Technical details</summary>
        <p>
          Asset ID hash: <code>{params.assetId ?? '(missing)'}</code>
        </p>
        <p>
          Asset address:{' '}
          <code>
            {!sdk
              ? 'Set VITE_REGISTRY_ADDRESS'
              : assetId === null
                ? 'Invalid asset id (must be 0x\u2026)'
                : assetAddressQuery.isLoading
                  ? 'Loading\u2026'
                  : assetAddressQuery.error
                    ? 'Error'
                    : assetAddressQuery.data}
          </code>
        </p>
      </details>

      {assetId ? (
        <p>
          <Link to={`/assets/${assetId}/history`}>View history</Link>
        </p>
      ) : null}

      {isAssetOwner && assetAddressQuery.data ? (
        <section className={styles.ownerPanel}>
          <h2 className={styles.ownerPanelTitle}>Update subscription price</h2>
          <p className={styles.ownerHint}>
            Set how much subscribers pay per calendar day. They choose how many days to buy on subscribe; the contract
            still stores one price per subscription period.
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
        </section>
      ) : null}

      <p>
        Your status:{' '}
        <code>
          {!address
            ? 'Connect wallet'
            : statusQuery.isLoading
              ? 'Loading\u2026'
              : statusQuery.error
                ? 'Error'
                : statusQuery.data?.isActive
                  ? 'Subscribed'
                  : 'Not subscribed'}
        </code>
      </p>

      {statusQuery.data?.isActive ? (
        <div className={styles.unlocked}>
          <strong>Unlocked</strong>
          {gatedContentQuery.isLoading ? <p>Loading\u2026</p> : null}
          {gatedContentQuery.error ? (
            <p>
              Mock API error: <code>{(gatedContentQuery.error as Error).message}</code>
            </p>
          ) : null}
          {gatedContentQuery.data ? (
            <div className={styles.gatedContent}>
              <div className={styles.gatedUrl}>
                <code>{gatedContentQuery.data.url}</code>
              </div>
            </div>
          ) : null}
          {!gatedContentQuery.data && !gatedContentQuery.isLoading ? (
            <p className={styles.unlockedText}>
              No gated URL available.
            </p>
          ) : null}
          {address && assetAddressQuery.data ? (
            <div className={styles.cancelRow}>
              <Button
                type="button"
                variant="danger"
                disabled={!sdk || !walletClient || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? 'Cancelling\u2026' : 'Cancel subscription'}
              </Button>
            </div>
          ) : null}
          {cancelMutation.error ? (
            <p className={styles.cancelError}>
              Cancel error: <code>{(cancelMutation.error as Error).message}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {showSubscribe ? (
        <>
          <hr className={styles.sectionDivider} />

          <h2>Subscribe</h2>
          {assetId ? <SubscribeToAssetButton assetId={assetId} /> : null}
        </>
      ) : null}
    </div>
  )
}
