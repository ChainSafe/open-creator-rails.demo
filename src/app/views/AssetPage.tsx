import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isHex } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { useOcrSdk } from '../ocrSdk'

export function AssetPage() {
  const params = useParams<{ assetId: string }>()
  const sdk = useOcrSdk()
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const assetId = useMemo(() => {
    const v = params.assetId
    if (!v) return null
    if (!isHex(v)) return null
    return v as `0x${string}`
  }, [params.assetId])

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetId) throw new Error('Missing assetId')
      return await sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId),
  })

  const statusQuery = useQuery({
    queryKey: ['ocr', 'subscriptionStatus', assetAddressQuery.data, address],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      if (!address) throw new Error('Missing address')
      return await sdk.Asset.getSubscriptionStatus({
        assetAddress: assetAddressQuery.data,
        user: address,
        source: 'auto',
      })
    },
    enabled: Boolean(sdk && assetAddressQuery.data && address),
  })

  return (
    <div>
      <h1>Asset</h1>
      <p>
        Asset ID hash: <code>{params.assetId ?? '(missing)'}</code>
      </p>
      {assetId ? (
        <p>
          <Link to={`/assets/${assetId}/history`}>View history</Link>
        </p>
      ) : null}
      <p>
        Asset address:{' '}
        <code>
          {!sdk
            ? 'Set VITE_REGISTRY_ADDRESS'
            : assetId === null
              ? 'Invalid asset id (must be 0x…)'
              : assetAddressQuery.isLoading
                ? 'Loading…'
                : assetAddressQuery.error
                  ? 'Error'
                  : assetAddressQuery.data}
        </code>
      </p>
      <p>
        Your status:{' '}
        <code>
          {!address
            ? 'Connect wallet'
            : statusQuery.isLoading
              ? 'Loading…'
              : statusQuery.error
                ? 'Error'
                : statusQuery.data?.isActive
                  ? 'Subscribed'
                  : 'Not subscribed'}
        </code>
      </p>

      {statusQuery.data?.isActive ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)',
            borderRadius: 8,
          }}
        >
          <strong>Unlocked</strong>
          <div style={{ marginTop: 8 }}>
            Demo gated content: you’re subscribed, so you can “access” this asset.
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!isConnected ? (
          <button
            className={undefined}
            onClick={() => connect({ connector: connectors[0]! })}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : (
          <>
            <button onClick={() => disconnect()}>Disconnect</button>
            <code>{address}</code>
          </>
        )}
      </div>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2>Subscribe</h2>
      {assetId ? <SubscribeToAssetButton assetId={assetId} /> : null}
    </div>
  )
}
