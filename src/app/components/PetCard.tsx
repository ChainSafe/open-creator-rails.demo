import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Hex } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

import type { PetDefinition } from '../petShop/petCatalog'
import { useOcrSdk } from '../ocrSdk'
import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { SubscribeToAssetButton } from './SubscribeToAssetButton'
import styles from './PetCard.module.scss'

type Props = {
  pet: PetDefinition
  assetId: Hex
}

export function PetCard({ pet, assetId }: Props) {
  const sdk = useOcrSdk()
  const { address } = useAccount()

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId),
  })

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddressQuery.data, address],
    queryFn: async () => {
      if (!sdk || !assetAddressQuery.data || !address) throw new Error('Not ready')
      return sdk.Asset.getSubscriptionStatus({
        assetAddress: assetAddressQuery.data,
        subscriberId: DEMO_SUBSCRIBER_ID,
        user: address,
        source: 'auto',
      })
    },
    enabled: Boolean(sdk && assetAddressQuery.data && address),
    refetchInterval: 10_000,
  })

  const isActive = Boolean(statusQuery.data?.isActive)

  return (
    <article className={styles.card} style={{ '--pet-accent': pet.accent } as CSSProperties}>
      <div className={styles.hero}>
        <span className={styles.emoji} aria-hidden>
          {pet.emoji}
        </span>
        {isActive ? <span className={styles.badge}>In your farm</span> : null}
      </div>
      <div className={styles.body}>
        <p className={styles.species}>{pet.species}</p>
        <h3 className={styles.name}>{pet.name}</h3>
        <p className={styles.tagline}>{pet.tagline}</p>
        <div className={styles.subscribe}>
          <SubscribeToAssetButton assetId={assetId} compact initialDays={1} />
          {isActive ? (
            <Link to="/pet-shop" className={styles.farmLink}>
              View in your farm →
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}
