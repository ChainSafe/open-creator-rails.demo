import type { OcrSdk } from '@open-creator-rails/sdk'
import type { Address } from 'viem'

/** Minimum full subscription periods to cover at least `calendarSeconds` of wall time. */
export async function countPeriodsCoveringSeconds(
  sdk: OcrSdk,
  assetAddress: Address,
  calendarSeconds: bigint,
): Promise<bigint> {
  const period = await sdk.Asset.getSubscriptionDuration({ assetAddress })
  if (period <= 0n) return 1n
  if (calendarSeconds <= 0n) return 1n
  return (calendarSeconds + period - 1n) / period
}
