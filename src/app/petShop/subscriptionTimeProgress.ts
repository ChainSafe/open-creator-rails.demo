/** Fraction of subscription time elapsed (0 = just subscribed, 1 = expired). */
export function subscriptionElapsedFraction(
  endTimeSeconds: bigint,
  startTimeSeconds?: bigint | null,
  periodSeconds?: bigint | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): number {
  const end = Number(endTimeSeconds)
  const now = nowSeconds
  if (!Number.isFinite(end) || end <= now) return 1

  const remaining = end - now
  let total: number

  if (startTimeSeconds != null) {
    const start = Number(startTimeSeconds)
    total = end - start
  } else if (periodSeconds != null && periodSeconds > 0n) {
    total = Number(periodSeconds)
  } else {
    return 0
  }

  if (!Number.isFinite(total) || total <= 0) return 0
  const elapsed = total - remaining
  return Math.min(1, Math.max(0, elapsed / total))
}
