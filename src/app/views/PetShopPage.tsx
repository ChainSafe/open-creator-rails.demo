import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { UnityFarmPlayer } from '../components/UnityFarmPlayer'
import { usePetRows } from '../petShop/usePetRows'
import { useUnityPetStates } from '../petShop/useUnityPetStates'
import styles from './PetShopPage.module.scss'

export function PetShopPage() {
  const { address } = useAccount()
  const { petRows } = usePetRows()
  const unityPetsQuery = useUnityPetStates(petRows)

  const activeCount = (unityPetsQuery.data ?? []).filter((p) => p.active).length

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Your farm</p>
          <h1 className={styles.title}>Pet Shop</h1>
          <p className={styles.subtitle}>
            Active subscriptions appear here. Adopt pets in{' '}
            <Link to="/">Creators Hub</Link>.
          </p>
        </div>
        {address ? (
          <p className={styles.summary}>
            {activeCount > 0
              ? `${activeCount} pet${activeCount === 1 ? '' : 's'} visiting`
              : 'No active pets — subscribe in Creators Hub'}
          </p>
        ) : (
          <p className={styles.summary}>Connect a wallet to see your farm.</p>
        )}
      </header>

      <div className={styles.playerWrap}>
        <UnityFarmPlayer pets={unityPetsQuery.data ?? []} wallet={address ?? null} />
      </div>
    </div>
  )
}
