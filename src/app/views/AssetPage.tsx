import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelSubscriptionDigest, subscriberHash } from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isHex, type Hex } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

import { Button } from '../components/Button'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import styles from './AssetPage.module.scss'

export function AssetPage() {
  const params = useParams<{ assetId: string }>()
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })

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

  const showSubscribe = !(address && statusQuery.data?.isActive)

  return (
    <div>
      <h1>Asset</h1>
      <p>
        Asset ID hash: <code>{params.assetId ?? '(missing)'}</code>
      </p>
      {assetId ? (
        <p>
          <Link to={`/assets/${assetId}/history`}>View history</Link>
        </p>
      ) : null}
      <p>
        Asset address:{' '}
        <code>
          {!sdk
            ? 'Set VITE_REGISTRY_ADDRESS'
            : assetId === null
              ? 'Invalid asset id (must be 0x…)'
              : assetAddressQuery.isLoading
                ? 'Loading…'
                : assetAddressQuery.error
                  ? 'Error'
                  : assetAddressQuery.data}
        </code>
      </p>
      <p>
        Your status:{' '}
        <code>
          {!address
            ? 'Connect wallet'
            : statusQuery.isLoading
              ? 'Loading…'
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
          <div className={styles.unlockedText}>
            Demo gated content: you’re subscribed, so you can “access” this asset.
          </div>
          {address && assetAddressQuery.data ? (
            <div className={styles.cancelRow}>
              <Button
                type="button"
                variant="danger"
                disabled={!sdk || !walletClient || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel subscription'}
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
