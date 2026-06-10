import type { CSSProperties } from 'react'

import { formatPetShopTimeRemaining } from '../petShop/formatPetShopTime'
import { useSubscriptionTimeProgress } from '../petShop/useSubscriptionTimeProgress'
import styles from './SubscribedTimeBar.module.scss'

type Props = {
  endTime?: bigint
  startTime?: bigint | null
  periodSeconds?: bigint | null
  className?: string
  /** Light-green bar without a known expiry (status still active). */
  labelOnly?: boolean
}

export function SubscribedTimeBar({
  endTime,
  startTime,
  periodSeconds,
  className,
  labelOnly = false,
}: Props) {
  const elapsed = useSubscriptionTimeProgress(labelOnly ? null : endTime, startTime, periodSeconds)

  return (
    <div
      className={[styles.bar, className].filter(Boolean).join(' ')}
      style={labelOnly ? undefined : ({ '--elapsed': String(elapsed) } as CSSProperties)}
      role="status"
      aria-live="polite"
      aria-label={
        labelOnly || endTime == null
          ? 'Subscribed'
          : `Subscribed, ${formatPetShopTimeRemaining(endTime)}`
      }
    >
      {!labelOnly && endTime != null ? <div className={styles.elapsedFill} aria-hidden /> : null}
      <div className={styles.content}>
        <span className={styles.label}>Subscribed</span>
        {!labelOnly && endTime != null ? (
          <span className={styles.expiry}>{formatPetShopTimeRemaining(endTime)}</span>
        ) : null}
      </div>
    </div>
  )
}
