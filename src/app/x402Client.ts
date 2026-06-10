import type { Address, Hex } from 'viem'

import { deriveX402SubscriberId } from './x402Subscriber'
import type { SignedPermit } from './signPermit'

export type X402PaymentBody = {
  x402Version: 1
  scheme: 'ocr-permit-v1'
  network: string
  payload: {
    subscriberId: Hex
    payer: Address
    count: number
    deadline: number
    permitNonce: number
    v: number
    r: Hex
    s: Hex
  }
  requirements: {
    payTo: Address
    asset: Address
    amount: string
  }
}

export function buildX402PaymentBody(params: {
  chainId: number
  payer: Address
  assetAddress: Address
  tokenAddress: Address
  count: bigint
  permit: SignedPermit
}): X402PaymentBody {
  const { chainId, payer, assetAddress, tokenAddress, count, permit } = params
  return {
    x402Version: 1,
    scheme: 'ocr-permit-v1',
    network: `eip155:${chainId}`,
    payload: {
      subscriberId: deriveX402SubscriberId(payer),
      payer,
      count: Number(count),
      deadline: Number(permit.deadline),
      permitNonce: Number(permit.permitNonce),
      v: permit.v,
      r: permit.r,
      s: permit.s,
    },
    requirements: {
      payTo: assetAddress,
      asset: tokenAddress,
      amount: permit.value.toString(),
    },
  }
}

/** Dev: Vite proxies `/api/x402/*` when unset. Prod: absolute facilitator URL. */
export function x402ApiBase(facilitatorUrl: string | undefined): string {
  const trimmed = facilitatorUrl?.trim().replace(/\/$/, '')
  if (trimmed) return trimmed
  return '/api/x402'
}

function x402Url(base: string, path: 'health' | 'verify' | 'settle'): string {
  return base.startsWith('http') ? `${base}/${path}` : `${base}/${path}`
}

export async function x402Health(facilitatorUrl: string | undefined): Promise<boolean> {
  try {
    const res = await fetch(x402Url(x402ApiBase(facilitatorUrl), 'health'), { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function x402Verify(
  facilitatorUrl: string | undefined,
  body: X402PaymentBody,
): Promise<{ isValid: boolean; invalidReason?: string }> {
  const res = await fetch(x402Url(x402ApiBase(facilitatorUrl), 'verify'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { isValid?: boolean; invalidReason?: string }
  if (!res.ok && json.isValid !== true) {
    throw new Error(json.invalidReason ?? `Verify failed (${res.status})`)
  }
  return { isValid: Boolean(json.isValid), invalidReason: json.invalidReason }
}

export async function x402Settle(
  facilitatorUrl: string | undefined,
  body: X402PaymentBody,
): Promise<{ success: boolean; transaction?: string }> {
  const res = await fetch(x402Url(x402ApiBase(facilitatorUrl), 'settle'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as {
    success?: boolean
    transaction?: string
    errorReason?: string
  }
  if (!json.success) {
    throw new Error(json.errorReason ?? `Settle failed (${res.status})`)
  }
  return {
    success: true,
    transaction: json.transaction,
  }
}
