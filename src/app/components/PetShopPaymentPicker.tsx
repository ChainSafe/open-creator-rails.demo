import { usePetShopPaymentMode } from '../petShop/PetShopPaymentModeContext'
import styles from './PetShopPaymentPicker.module.scss'

export function PetShopPaymentPicker() {
  const { effectivePath, setSelectedPath, facilitatorHealthy, showPicker } = usePetShopPaymentMode()

  if (!showPicker) return null

  return (
    <div className={styles.wrap} role="group" aria-label="Payment method">
      <span className={styles.label}>Pay with</span>
      <div className={styles.segmented}>
        <button
          type="button"
          className={effectivePath === 'direct' ? styles.segmentActive : styles.segment}
          aria-pressed={effectivePath === 'direct'}
          onClick={() => setSelectedPath('direct')}
        >
          Wallet
        </button>
        <button
          type="button"
          className={effectivePath === 'gasless' ? styles.segmentActive : styles.segment}
          aria-pressed={effectivePath === 'gasless'}
          onClick={() => setSelectedPath('gasless')}
        >
          Gasless
        </button>
      </div>
      {effectivePath === 'gasless' && !facilitatorHealthy ? (
        <p className={styles.hint}>Facilitator offline — start x402-adapter on port 3402.</p>
      ) : null}
    </div>
  )
}
