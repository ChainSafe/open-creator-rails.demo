import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { appConfig } from '../config'
import { x402Health } from '../x402Client'
import {
  resolvePetShopPaymentModeConfig,
  type PetShopPaymentModeConfig,
  type PetShopPaymentPath,
} from './petShopPaymentMode'

const STORAGE_KEY = 'ocr-pet-shop-payment-path'

type ContextValue = {
  configMode: PetShopPaymentModeConfig
  /** Path used on pet cards (respects preset or user toggle). */
  effectivePath: PetShopPaymentPath
  setSelectedPath: (path: PetShopPaymentPath) => void
  facilitatorHealthy: boolean
  showPicker: boolean
}

const PetShopPaymentModeContext = createContext<ContextValue | null>(null)

function readStoredPath(): PetShopPaymentPath {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)
    if (v === 'direct' || v === 'gasless') return v
  } catch {
    /* ignore */
  }
  return 'direct'
}

export function PetShopPaymentModeProvider({ children }: { children: ReactNode }) {
  const configMode = resolvePetShopPaymentModeConfig()
  const facilitatorUrl = appConfig.x402FacilitatorUrl
  const [selectedPath, setSelectedPathState] = useState<PetShopPaymentPath>(readStoredPath)

  const healthQuery = useQuery({
    queryKey: ['x402', 'health', facilitatorUrl],
    queryFn: async () => {
      if (!facilitatorUrl) return false
      return x402Health(facilitatorUrl)
    },
    enabled: Boolean(facilitatorUrl),
    refetchInterval: 30_000,
  })

  const setSelectedPath = (path: PetShopPaymentPath) => {
    setSelectedPathState(path)
    try {
      sessionStorage.setItem(STORAGE_KEY, path)
    } catch {
      /* ignore */
    }
  }

  const effectivePath: PetShopPaymentPath =
    configMode === 'both' ? selectedPath : configMode

  const value = useMemo(
    (): ContextValue => ({
      configMode,
      effectivePath,
      setSelectedPath,
      facilitatorHealthy: healthQuery.data === true,
      showPicker: configMode === 'both' && Boolean(facilitatorUrl),
    }),
    [configMode, effectivePath, healthQuery.data, facilitatorUrl],
  )

  return (
    <PetShopPaymentModeContext.Provider value={value}>{children}</PetShopPaymentModeContext.Provider>
  )
}

export function usePetShopPaymentMode(): ContextValue {
  const ctx = useContext(PetShopPaymentModeContext)
  if (!ctx) {
    return {
      configMode: resolvePetShopPaymentModeConfig(),
      effectivePath:
        resolvePetShopPaymentModeConfig() === 'gasless' ? 'gasless' : 'direct',
      setSelectedPath: () => {},
      facilitatorHealthy: false,
      showPicker: false,
    }
  }
  return ctx
}
