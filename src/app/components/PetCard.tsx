import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Hex } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

import type { PetDefinition } from '../petShop/petCatalog'
import { useOcrSdk } from '../ocrSdk'
import { isActiveForDemoOrX402 } from '../subscriptionActive'
import { usePetShopPaymentMode } from '../petShop/PetShopPaymentModeContext'
import { SubscribedTimeBar } from './SubscribedTimeBar'
import { SubscribeToAssetButton } from './SubscribeToAssetButton'
import styles from './PetCard.module.scss'

type Props = {
  pet: PetDefinition
  assetId?: Hex
}

export function PetCard({ pet, assetId }: Props) {
  const sdk = useOcrSdk()
  const { address } = useAccount()
  const { effectivePath } = usePetShopPaymentMode()
  const subscribable = Boolean(assetId)

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk || !assetId) throw new Error('SDK not ready')
      return sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId),
  })

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddressQuery.data, address],
    queryFn: async () => {
      if (!sdk || !assetAddressQuery.data || !address) throw new Error('Not ready')
      return isActiveForDemoOrX402(sdk, assetAddressQuery.data, address)
    },
    enabled: Boolean(sdk && assetAddressQuery.data && address && subscribable),
    refetchInterval: 10_000,
  })

  const periodSecondsQuery = useQuery({
    queryKey: ['ocr', 'subscriptionPeriod', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk || !assetAddressQuery.data) throw new Error('Not ready')
      return sdk.Asset.getSubscriptionDuration({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(sdk && assetAddressQuery.data && subscribable),
  })

  const isActive = Boolean(statusQuery.data?.active)

  return (
    <article className={styles.card} style={{ '--pet-accent': pet.accent } as CSSProperties}>
      <div className={styles.header}>
        {isActive ? <span className={styles.badge}>In your farm</span> : null}
        <p className={styles.species}>{pet.species}</p>
        <h3 className={styles.name}>{pet.name}</h3>
        <p className={styles.tagline}>{pet.tagline}</p>
      </div>

      <div className={styles.figure} aria-hidden>
        <img className={styles.portrait} src={pet.image} alt="" />
      </div>

      {isActive ? (
        <div className={styles.ground}>
          {statusQuery.data?.endTime != null ? (
            <SubscribedTimeBar
              endTime={statusQuery.data.endTime}
              startTime={statusQuery.data.startTime}
              periodSeconds={periodSecondsQuery.data}
            />
          ) : (
            <SubscribedTimeBar labelOnly />
          )}
          <Link to="/pet-shop" className={styles.farmLink}>
            View in your farm →
          </Link>
        </div>
      ) : subscribable && assetId ? (
        <div className={styles.ground}>
          <SubscribeToAssetButton assetId={assetId} compact paymentPath={effectivePath} />
        </div>
      ) : null}
    </article>
  )
}
