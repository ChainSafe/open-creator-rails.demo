/** Human-readable time left for short pet-shop subscriptions (minutes, not days). */
export function formatPetShopTimeRemaining(endTimeSeconds: bigint): string {
  const end = Number(endTimeSeconds)
  const now = Math.floor(Date.now() / 1000)
  const diff = end - now
  if (diff <= 0) return 'Expired'
  if (diff < 60) return `${diff}s left`
  if (diff < 3600) {
    const mins = Math.ceil(diff / 60)
    return `${mins} min left`
  }
  if (diff < 86_400) {
    const hrs = Math.ceil(diff / 3600)
    return `${hrs} hr left`
  }
  const days = Math.ceil(diff / 86_400)
  return `${days} day${days === 1 ? '' : 's'} left`
}
