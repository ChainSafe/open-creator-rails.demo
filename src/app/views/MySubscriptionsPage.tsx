import { createSdkIndexer, type IndexerSubscription } from '@open-creator-rails/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Address, Hex } from 'viem'
import { useAccount } from 'wagmi'

import { appConfig } from '../config'
import { useOcrSdk } from '../ocrSdk'
import styles from './MySubscriptionsPage.module.scss'

type SubscriptionWithRegistryId = IndexerSubscription & { registryAssetId: Hex }

export function MySubscriptionsPage() {
  const { address } = useAccount()
  const sdk = useOcrSdk()
  const qc = useQueryClient()

  const cancelMutation = useMutation({
    mutationFn: async (assetAddress: Address) => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      return sdk.Asset.cancelSubscription({ assetAddress, subscriber: address })
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
      const ix = createSdkIndexer(appConfig.indexerUrl)
      const subs = await ix.listSubscriptionsByUser({ user: address, activeOnly: true })
      return Promise.all(
        subs.map(async (s: IndexerSubscription): Promise<SubscriptionWithRegistryId> => ({
          ...s,
          registryAssetId: await sdk.Asset.getAssetId({ assetAddress: s.assetAddress }),
        })),
      )
    },
    enabled: Boolean(address && sdk),
  })

  return (
    <div>
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
              <span>
                <Link to={`/assets/${s.registryAssetId}`}>{s.registryAssetId}</Link> — active until{' '}
                <code>{s.endTime != null ? s.endTime.toString() : '—'}</code>
              </span>
              <button
                type="button"
                disabled={!sdk || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(s.assetAddress)}
              >
                {cancellingThis ? 'Cancelling…' : 'Cancel subscription'}
              </button>
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

