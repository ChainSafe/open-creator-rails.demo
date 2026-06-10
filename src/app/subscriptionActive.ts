import type { Address, Hex } from 'viem'
import type { OcrSdk } from '@open-creator-rails/sdk'

import { DEMO_SUBSCRIBER_ID, X402_SUBSCRIBER_ID } from './demoSubscriber'

function subscriptionActive(endTime: bigint | undefined): boolean {
  if (endTime == null) return false
  return endTime > BigInt(Math.floor(Date.now() / 1000))
}

export async function isActiveForSubscriber(
  sdk: OcrSdk,
  assetAddress: Hex,
  subscriberId: string,
  user: Address,
): Promise<boolean> {
  try {
    return await sdk.Asset.isSubscriptionActive({
      assetAddress,
      subscriberId,
      subscriberAddress: user,
    })
  } catch {
    try {
      const status = await sdk.Asset.getSubscriptionStatus({
        assetAddress,
        subscriberId,
        user,
        source: 'auto',
      })
      return Boolean(status?.isActive) || subscriptionActive(status?.endTime)
    } catch {
      return false
    }
  }
}

export async function isActiveForDemoOrX402(
  sdk: OcrSdk,
  assetAddress: Hex,
  user: Address,
): Promise<{ active: boolean; endTime: bigint | null; startTime: bigint | null }> {
  const [direct, x402] = await Promise.all([
    isActiveForSubscriber(sdk, assetAddress, DEMO_SUBSCRIBER_ID, user),
    isActiveForSubscriber(sdk, assetAddress, X402_SUBSCRIBER_ID, user),
  ])
  if (!direct && !x402) {
    return { active: false, endTime: null, startTime: null }
  }

  let endTime: bigint | null = null
  let startTime: bigint | null = null
  for (const subscriberId of [DEMO_SUBSCRIBER_ID, X402_SUBSCRIBER_ID]) {
    try {
      const status = await sdk.Asset.getSubscriptionStatus({
        assetAddress,
        subscriberId,
        user,
        source: 'auto',
      })
      if (status?.isActive && status.endTime != null) {
        const t = status.endTime
        if (endTime == null || t > endTime) {
          endTime = t
          startTime = status.startTime ?? null
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { active: true, endTime, startTime }
}

export async function waitForSubscriptionActive(
  sdk: OcrSdk,
  assetAddress: Hex,
  user: Address,
  subscriberId: string,
  maxAttempts = 20,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const active = await isActiveForSubscriber(sdk, assetAddress, subscriberId, user)
    if (active) return
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Subscription is not active on-chain yet. Try again in a moment.')
}
