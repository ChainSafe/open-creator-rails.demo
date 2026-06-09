/** Human label for on-chain subscription period length (e.g. 300 → "5 min"). */
export function formatSubscriptionPeriodLabel(periodSeconds: bigint): string {
  const s = Number(periodSeconds)
  if (s <= 0) return 'period'
  if (s < 60) return `${s}s`
  if (s < 3600) {
    const mins = s / 60
    return mins === 1 ? '1 min' : `${mins} min`
  }
  if (s < 86_400) {
    const hrs = s / 3600
    return hrs === 1 ? '1 hr' : `${hrs} hr`
  }
  const days = s / 86_400
  return days === 1 ? '1 day' : `${days} days`
}
