import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Hex } from 'viem'
import { formatUnits } from 'viem'
import { usePublicClient } from 'wagmi'

import { appConfig } from '../config'
import { erc20MetadataAbi } from '../erc20Permit'
import { useOcrSdk } from '../ocrSdk'
import type { PetDefinition } from '../petShop/petCatalog'
import { formatSubscriptionPeriodLabel } from '../petShop/formatSubscriptionPeriod'
import styles from './PetAdminCard.module.scss'

type Props = {
  pet: PetDefinition
  assetAddress: Hex
  onManage: () => void
}

export function PetAdminCard({ pet, assetAddress, onManage }: Props) {
  const sdk = useOcrSdk()
  const publicClient = usePublicClient({ chainId: appConfig.chain.id })

  const periodQuery = useQuery({
    queryKey: ['ocr', 'petAdminPeriod', assetAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return sdk.Asset.getSubscriptionDuration({ assetAddress })
    },
    enabled: Boolean(sdk),
  })

  const priceQuery = useQuery({
    queryKey: ['ocr', 'petAdminPrice', assetAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return sdk.Asset.getSubscriptionPrice({ assetAddress, count: 1n })
    },
    enabled: Boolean(sdk),
  })

  const tokenAddressQuery = useQuery({
    queryKey: ['ocr', 'petAdminToken', assetAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return sdk.Asset.getTokenAddress({ assetAddress })
    },
    enabled: Boolean(sdk),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['ocr', 'petAdminTokenMeta', tokenAddressQuery.data],
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
    enabled: Boolean(publicClient && tokenAddressQuery.data),
  })

  const periodSeconds = periodQuery.data ?? 300n
  const periodLabel = formatSubscriptionPeriodLabel(periodSeconds)

  const priceLabel =
    priceQuery.data && tokenMetaQuery.data
      ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name} / ${periodLabel}`
      : priceQuery.isLoading || periodQuery.isLoading
        ? '…'
        : '—'

  return (
    <article
      className={styles.card}
      style={{ '--pet-accent': pet.accent } as CSSProperties}
      onClick={onManage}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onManage()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.header}>
        <span className={styles.badge}>
          <span className={styles.liveDot} aria-hidden />
          Live
        </span>
        <p className={styles.species}>{pet.species}</p>
        <h3 className={styles.name}>{pet.name}</h3>
        <p className={styles.tagline}>{pet.tagline}</p>
      </div>

      <div className={styles.figure} aria-hidden>
        <img className={styles.portrait} src={pet.image} alt="" />
      </div>

      <div className={styles.ground}>
        <span className={styles.price}>{priceLabel}</span>
        <button
          type="button"
          className={styles.manageBtn}
          onClick={(e) => {
            e.stopPropagation()
            onManage()
          }}
        >
          Manage
        </button>
      </div>
    </article>
  )
}
