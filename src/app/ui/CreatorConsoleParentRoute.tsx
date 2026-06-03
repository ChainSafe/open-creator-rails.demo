import { Navigate, Outlet } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { appConfig } from '../config'
import { useAssetOwnerGate } from '../useAssetOwnerGate'

/**
 * Parent route for `/creator-console`: registry owner or asset owner (indexer) may see children.
 */
export function CreatorConsoleParentRoute() {
  const { isConnected } = useAccount()
  const { canAccessCreatorConsole, gateReady } = useAssetOwnerGate()

  if (!appConfig.registryAddress) {
    return <Navigate to="/" replace />
  }

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  if (!gateReady) {
    return (
      <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant, #888)' }}>
        Loading…
      </p>
    )
  }

  if (!canAccessCreatorConsole) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
