import { useQuery } from '@tanstack/react-query'
import type { Hex } from 'viem'
import { useAccount } from 'wagmi'

import { DEMO_SUBSCRIBER_ID } from '../demoSubscriber'
import { useOcrSdk } from '../ocrSdk'
import type { UnityPetState } from './unityBridge'
import type { PetRow } from './usePetRows'

export function useUnityPetStates(petRows: PetRow[]) {
  const sdk = useOcrSdk()
  const { address } = useAccount()

  const subscribableRows = petRows.filter(
    (row): row is PetRow & { assetId: Hex } => Boolean(row.assetId),
  )

  return useQuery({
    queryKey: ['petShop', 'unityPets', address, subscribableRows.map((r) => r.assetId).join(',')],
    queryFn: async (): Promise<UnityPetState[]> => {
      if (!sdk || !address) {
        return subscribableRows.map(({ pet }) => ({
          slug: pet.slug,
          name: pet.name,
          emoji: pet.emoji,
          active: false,
          endTime: null,
        }))
      }

      return Promise.all(
        subscribableRows.map(async ({ pet, assetId }) => {
          const assetAddress = await sdk.AssetRegistry.getAsset({ assetId })
          const status = await sdk.Asset.getSubscriptionStatus({
            assetAddress,
            subscriberId: DEMO_SUBSCRIBER_ID,
            user: address,
            source: 'auto',
          })
          return {
            slug: pet.slug,
            name: pet.name,
            emoji: pet.emoji,
            active: Boolean(status?.isActive),
            endTime: status?.endTime != null ? Number(status.endTime) : null,
          }
        }),
      )
    },
    enabled: subscribableRows.length > 0,
    refetchInterval: 8_000,
  })
}
