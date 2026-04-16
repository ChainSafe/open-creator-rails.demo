import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { isAddress, isHex, keccak256, stringToHex, type Address } from 'viem'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { createSdkIndexer, type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { useOcrSdk } from '../ocrSdk'
import styles from './RegistryPage.module.scss'

export function RegistryPage() {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const [newAssetId, setNewAssetId] = useState('')
  const [newTokenAddress, setNewTokenAddress] = useState('')
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [newSubscriptionPrice, setNewSubscriptionPrice] = useState('')

  const ownerQuery = useQuery({
    queryKey: ['ocr', 'registryOwner', appConfig.registryAddress],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return await sdk.AssetRegistry.owner()
    },
    enabled: Boolean(sdk),
  })

  const assetsQuery = useQuery({
    queryKey: ['indexer', 'listAssetsByRegistry', appConfig.indexerUrl, appConfig.registryAddress],
    queryFn: async () => {
      if (!appConfig.registryAddress) throw new Error('Missing VITE_REGISTRY_ADDRESS')
      // Use createSdkIndexer here instead of sdk.indexer: the list query must not depend on
      // OcrSdk’s memoized instance (stale bundle / missing this.indexer makes sdk.indexer undefined
      // even when VITE_INDEXER_URL is set — same GraphQL as sdk.indexer).
      const ix = createSdkIndexer(appConfig.indexerUrl)
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  const demoTokenAddressQuery = useQuery({
    queryKey: ['ocr', 'demoTokenAddress', assetsQuery.data?.[0]?.id],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      const firstAsset = assetsQuery.data?.[0]
      if (!firstAsset) throw new Error('No existing assets to infer demo token from')
      return sdk.Asset.getTokenAddress({ assetAddress: firstAsset.id })
    },
    enabled: Boolean(sdk && assetsQuery.data?.[0]?.id),
  })

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!newAssetId || !isHex(newAssetId, { strict: true }) || newAssetId.length !== 66) {
        throw new Error('Asset id must be a 32-byte hex value (bytes32)')
      }
      if (!isAddress(newTokenAddress, { strict: true })) {
        throw new Error('Token address must be a valid address')
      }
      const owner = (newOwnerAddress || address || '').trim()
      if (!isAddress(owner, { strict: true })) {
        throw new Error('Owner must be a valid address (or connect wallet)')
      }
      if (!/^\d+$/.test(newSubscriptionPrice)) {
        throw new Error('Subscription price must be an integer string')
      }
      const subscriptionPrice = BigInt(newSubscriptionPrice)
      if (subscriptionPrice <= 0n) throw new Error('Subscription price must be > 0')

      return sdk.AssetRegistry.createAsset({
        assetId: newAssetId as `0x${string}`,
        subscriptionPrice,
        tokenAddress: newTokenAddress as Address,
        owner: owner as Address,
      })
    },
    onSuccess: async () => {
      setNewAssetId('')
      setNewTokenAddress('')
      setNewSubscriptionPrice('')
      await qc.invalidateQueries({ queryKey: ['indexer', 'listAssetsByRegistry'] })
    },
  })

  const addDemoAssetMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      const index = (assetsQuery.data?.length ?? 0) + 1
      const demoHumanId = `demo_asset_${index}`
      const demoAssetId = keccak256(stringToHex(demoHumanId))
      const demoPricePerSecond = BigInt(index * 10)
      const demoTokenAddress = demoTokenAddressQuery.data || newTokenAddress
      if (!isAddress(demoTokenAddress, { strict: true })) {
        throw new Error('Need a valid token address (either existing demo assets or form token input)')
      }
      const demoOwner = ownerQuery.data || address
      if (!demoOwner || !isAddress(demoOwner, { strict: true })) {
        throw new Error('Registry owner not available and wallet not connected')
      }
      return sdk.AssetRegistry.createAsset({
        assetId: demoAssetId,
        subscriptionPrice: demoPricePerSecond,
        tokenAddress: demoTokenAddress as Address,
        owner: demoOwner as Address,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['indexer', 'listAssetsByRegistry'] })
    },
  })

  return (
    <div className={styles.page}>
      <h1>Creator profile (AssetRegistry)</h1>
      <p>
        This page will list assets under the configured registry and link to their details.
      </p>
      <p>
        Registry: <code>{appConfig.registryAddress ?? 'Missing VITE_REGISTRY_ADDRESS'}</code>
      </p>
      <p>
        Registry owner:{' '}
        <code>
          {!sdk
            ? 'Set VITE_REGISTRY_ADDRESS to enable SDK reads'
            : ownerQuery.isLoading
              ? 'Loading…'
              : ownerQuery.error
                ? 'Error'
                : ownerQuery.data}
        </code>
      </p>
      <div className={styles.walletRow}>
        {!isConnected ? (
          <button onClick={() => connect({ connector: connectors[0]! })} disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : (
          <>
            <button onClick={() => disconnect()}>Disconnect</button>
            <code>{address}</code>
          </>
        )}
      </div>

      <h2 className={styles.addAssetTitle}>Add Asset</h2>
      <p>Create and register a new asset in this registry.</p>
      <p>
        Quick demo add:{' '}
        <button type="button" onClick={() => addDemoAssetMutation.mutate()} disabled={!sdk || addDemoAssetMutation.isPending}>
          {addDemoAssetMutation.isPending ? 'Adding demo asset…' : 'Add demo asset'}
        </button>
      </p>
      <p className={styles.seedHint}>
        Uses seed-style params: <code>assetId=keccak256("demo_asset_N")</code>,{' '}
        <code>pricePerSecond=N*10</code>, token from first indexed asset, owner from registry owner.
      </p>
      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Asset ID (bytes32):
          <input
            value={newAssetId}
            onChange={(e) => setNewAssetId(e.target.value.trim())}
            placeholder="0x… (64 hex chars)"
            className={styles.fullWidthInput}
          />
        </label>
        <label className={styles.formLabel}>
          Token address:
          <input
            value={newTokenAddress}
            onChange={(e) => setNewTokenAddress(e.target.value.trim())}
            placeholder="0x…"
            className={styles.fullWidthInput}
          />
        </label>
        <label className={styles.formLabel}>
          Owner address (optional, defaults to connected wallet):
          <input
            value={newOwnerAddress}
            onChange={(e) => setNewOwnerAddress(e.target.value.trim())}
            placeholder={address ?? '0x…'}
            className={styles.fullWidthInput}
          />
        </label>
        <label className={styles.formLabel}>
          Subscription price (raw integer, per second):
          <input
            value={newSubscriptionPrice}
            onChange={(e) => setNewSubscriptionPrice(e.target.value.trim())}
            placeholder="e.g. 34722222222222"
            className={styles.fullWidthInput}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={() => createAssetMutation.mutate()}
            disabled={!sdk || createAssetMutation.isPending}
          >
            {createAssetMutation.isPending ? 'Adding asset…' : 'Add asset'}
          </button>
        </div>
      </div>
      {createAssetMutation.data ? (
        <p>
          Tx: <code>{createAssetMutation.data}</code>
        </p>
      ) : null}
      {createAssetMutation.error ? (
        <p>
          Add asset error: <code>{(createAssetMutation.error as Error).message}</code>
        </p>
      ) : null}
      {addDemoAssetMutation.data ? (
        <p>
          Demo tx: <code>{addDemoAssetMutation.data}</code>
        </p>
      ) : null}
      {addDemoAssetMutation.error ? (
        <p>
          Add demo asset error: <code>{(addDemoAssetMutation.error as Error).message}</code>
        </p>
      ) : null}

      <hr className={styles.sectionDivider} />

      <h2>Assets</h2>
      <p>
        Indexer: <code>{appConfig.indexerUrl}</code>
      </p>
      {assetsQuery.isLoading ? <p>Loading assets…</p> : null}
      {assetsQuery.error ? (
        <p>
          Indexer error: <code>{(assetsQuery.error as Error).message}</code>
        </p>
      ) : null}
      {!assetsQuery.isLoading && (assetsQuery.data?.length ?? 0) === 0 ? (
        <p>No assets found (run the local seed script + indexer; registry address must match the seeded registry).</p>
      ) : null}

      <ul className={styles.assetList}>
        {(assetsQuery.data ?? []).map((a: IndexerAssetEntity) => (
          <li key={a.id} className={styles.assetListItem}>
            <div>
              <Link to={`/assets/${a.assetId}`}>{a.assetId}</Link> <span>→</span>{' '}
              <code>{a.id}</code>
              {' · '}
              <Link to={`/assets/${a.assetId}/history`}>History</Link>
            </div>
            <SubscribeToAssetButton assetId={a.assetId} compact />
          </li>
        ))}
      </ul>
    </div>
  )
}

