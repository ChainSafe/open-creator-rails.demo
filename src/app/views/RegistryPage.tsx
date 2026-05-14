import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { isAddress, isHex, keccak256, stringToHex, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { SubscribeToAssetButton } from '../components/SubscribeToAssetButton'
import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { useOcrSdk } from '../ocrSdk'
import styles from './RegistryPage.module.scss'

export function RegistryPage() {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address } = useAccount()
  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false)
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
      const ix = createDemoIndexer()
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
        subscriptionDuration: 1n,
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
        subscriptionDuration: 1n,
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
      <div className={styles.addAssetTriggerRow}>
        <Button type="button" variant="primary" onClick={() => setAddAssetModalOpen(true)} disabled={!sdk}>
          Add asset
        </Button>
      </div>

      <Modal open={addAssetModalOpen} onClose={() => setAddAssetModalOpen(false)} title="Add asset">
        <p className={styles.modalIntro}>Create and register a new asset in this registry.</p>
        <p className={styles.modalDemoRow}>
          Quick demo add:{' '}
          <Button type="button" variant="secondary" onClick={() => addDemoAssetMutation.mutate()} disabled={!sdk || addDemoAssetMutation.isPending}>
            {addDemoAssetMutation.isPending ? 'Adding demo asset…' : 'Add demo asset'}
          </Button>
        </p>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            Asset ID (bytes32):
            <Input
              value={newAssetId}
              onChange={(e) => setNewAssetId(e.target.value.trim())}
              placeholder="0x… (64 hex chars)"
              className={styles.fullWidthInput}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className={styles.formLabel}>
            Token address:
            <Input
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value.trim())}
              placeholder="0x…"
              className={styles.fullWidthInput}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className={styles.formLabel}>
            Owner address (optional, defaults to connected wallet):
            <Input
              value={newOwnerAddress}
              onChange={(e) => setNewOwnerAddress(e.target.value.trim())}
              placeholder={address ?? '0x…'}
              className={styles.fullWidthInput}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className={styles.formLabel}>
            Subscription price (raw integer, per second):
            <Input
              value={newSubscriptionPrice}
              onChange={(e) => setNewSubscriptionPrice(e.target.value.trim())}
              placeholder="e.g. 34722222222222"
              className={styles.fullWidthInput}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div>
            <Button
              type="button"
              variant="primary"
              onClick={() => createAssetMutation.mutate()}
              disabled={!sdk || createAssetMutation.isPending}
            >
              {createAssetMutation.isPending ? 'Adding asset…' : 'Add asset'}
            </Button>
          </div>
        </div>
        {createAssetMutation.data ? (
          <p className={styles.modalFeedback}>
            Tx: <code>{createAssetMutation.data}</code>
          </p>
        ) : null}
        {createAssetMutation.error ? (
          <p className={styles.modalFeedback}>
            Add asset error: <code>{(createAssetMutation.error as Error).message}</code>
          </p>
        ) : null}
        {addDemoAssetMutation.data ? (
          <p className={styles.modalFeedback}>
            Demo tx: <code>{addDemoAssetMutation.data}</code>
          </p>
        ) : null}
        {addDemoAssetMutation.error ? (
          <p className={styles.modalFeedback}>
            Add demo asset error: <code>{(addDemoAssetMutation.error as Error).message}</code>
          </p>
        ) : null}
      </Modal>

      <hr className={styles.sectionDivider} />

      <h2>Assets</h2>
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
          <li key={a.id} className={styles.assetCard}>
            <Link to={`/assets/${a.assetId}`} className={styles.assetCardMain}>
              <span className={styles.assetCardId}>{a.assetId}</span>
              <span className={styles.assetCardArrow} aria-hidden>
                →
              </span>
              <code className={styles.assetCardAddress}>{a.id}</code>
            </Link>
            <div className={styles.assetCardMeta}>
              <Link to={`/assets/${a.assetId}/history`} className={styles.assetCardSecondaryLink}>
                History
              </Link>
            </div>
            <div className={styles.assetCardSubscribe}>
              <SubscribeToAssetButton assetId={a.assetId} compact />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

