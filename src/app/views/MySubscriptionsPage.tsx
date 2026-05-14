import { cancelSubscriptionDigest, subscriberHash, type IndexerSubscription } from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Address, Hex } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

import { Button } from '../components/Button'
import { appConfig } from '../config'
import { formatUnixSecondsReadable } from '../formatTimestamp'
import { createDemoIndexer } from '../indexerClient'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import styles from './MySubscriptionsPage.module.scss'

type SubscriptionWithRegistryId = IndexerSubscription & { registryAssetId: Hex }

function normalizeAssetAddress(value: string): Address {
  const normalized = value.includes('_') ? value.split('_').at(-1) ?? value : value
  return normalized as Address
}

export function MySubscriptionsPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chain.id })
  const sdk = useOcrSdk()
  const qc = useQueryClient()

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
        activeOnly: true,
      })
      return Promise.all(
        subs.map(async (s: IndexerSubscription): Promise<SubscriptionWithRegistryId> => {
          const assetAddress = normalizeAssetAddress(s.assetAddress)
          return {
            ...s,
            assetAddress,
            registryAssetId: await sdk.Asset.getAssetId({ assetAddress }),
          }
        }),
      )
    },
    enabled: Boolean(address && sdk),
  })

  return (
    <div className={styles.root}>
      <h1>Your Subscriptions</h1>
      <p>
        This page lists your subscriptions from the indexer. (If the indexer isn’t running, it will be empty.)
      </p>

      {!address ? <p>Connect wallet to view subscriptions.</p> : null}
      {subsQuery.isLoading ? <p>Loading…</p> : null}
      {subsQuery.error ? (
        <p>
          Error: <code>{(subsQuery.error as Error).message}</code>
        </p>
      ) : null}

      <ul className={styles.subscriptionList}>
        {(subsQuery.data ?? []).map((s: SubscriptionWithRegistryId) => {
          const cancellingThis =
            cancelMutation.isPending &&
            cancelMutation.variables != null &&
            cancelMutation.variables.toLowerCase() === s.assetAddress.toLowerCase()
          return (
            <li key={s.id} className={styles.subscriptionListItem}>
              <div className={styles.assetAddress}>
                Asset: <code>{s.assetAddress}</code>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailCardBody}>
                  <Link to={`/assets/${s.registryAssetId}`}>{s.registryAssetId}</Link>
                  <span> — active until </span>
                  <code>{formatUnixSecondsReadable(s.endTime)}</code>
                </div>
                <div className={styles.detailCardActions}>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!sdk || !walletClient || cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(s.assetAddress)}
                  >
                    {cancellingThis ? 'Cancelling…' : 'Cancel subscription'}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {cancelMutation.error ? (
        <p className={styles.cancelError}>
          Cancel error: <code>{(cancelMutation.error as Error).message}</code>
        </p>
      ) : null}
    </div>
  )
}
