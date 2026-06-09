import { appConfig } from '../config'

export type PetShopPaymentPath = 'direct' | 'gasless'

/** Deploy preset: one path on cards, or `both` with a page-level toggle. */
export type PetShopPaymentModeConfig = PetShopPaymentPath | 'both'

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

export function resolvePetShopPaymentModeConfig(): PetShopPaymentModeConfig {
  const raw = trimEnv(import.meta.env.VITE_PET_SHOP_PAYMENT_MODE)?.toLowerCase()
  if (raw === 'direct' || raw === 'gasless' || raw === 'both') {
    return raw
  }
  return appConfig.x402FacilitatorUrl ? 'both' : 'direct'
}
