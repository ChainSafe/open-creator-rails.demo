import { useEffect, useState } from 'react'

import { subscriptionElapsedFraction } from './subscriptionTimeProgress'

export function useSubscriptionTimeProgress(
  endTime: bigint | null | undefined,
  startTime?: bigint | null,
  periodSeconds?: bigint | null,
): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (endTime == null) {
      setElapsed(0)
      return
    }

    const tick = () => {
      setElapsed(subscriptionElapsedFraction(endTime, startTime, periodSeconds))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endTime, startTime, periodSeconds])

  return elapsed
}
