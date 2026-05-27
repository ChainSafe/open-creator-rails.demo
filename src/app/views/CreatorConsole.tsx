import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatUnits, isAddress, keccak256, parseUnits, stringToHex, type Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'

import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import { erc20MetadataAbi } from '../erc20Permit'
import styles from './CreatorConsole.module.scss'

function toLower(a: string | undefined) {
  return (a ?? '').toLowerCase()
}

export function CreatorConsole() {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const publicClient = usePublicClient()
  const { address } = useAccount()

  const [modalOpen, setModalOpen] = useState(false)
  const [newApiName, setNewApiName] = useState('')
  const [newPricePerDay, setNewPricePerDay] = useState('')

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
      const ix = createDemoIndexer()
      return ix.listAssetsByRegistry({
        registryAddress: appConfig.registryAddress as Address,
      })
    },
    enabled: Boolean(appConfig.registryAddress),
  })

  const myAssets = useMemo((): IndexerAssetEntity[] => {
    if (!address) return []
    return (assetsQuery.data ?? []).filter(
      (a: IndexerAssetEntity) => toLower(a.owner) === toLower(address),
    )
  }, [assetsQuery.data, address])

  const serviceNamesQuery = useQuery<Record<string, string>>({
    queryKey: ['mockApi', 'assetNames', myAssets.map((a) => a.id).join(',')],
    queryFn: async () => {
      const names: Record<string, string> = {}
      await Promise.all(
        myAssets.map(async (a) => {
          try {
            const resp = await fetch(`${appConfig.mockApiUrl}/api/asset-name?assetAddress=${a.id}`)
            if (resp.ok) {
              const data = await resp.json()
              names[a.id.toLowerCase()] = data.name
            }
          } catch { /* ignore */ }
        }),
      )
      return names
    },
    enabled: Boolean(myAssets.length > 0),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['ocr', 'myAssets', 'tokenMeta', myAssets.map((a) => a.id).join(',')],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!publicClient) throw new Error('Public client not ready')
      const entries = await Promise.all(
        myAssets.map(async (asset) => {
          const token = await sdk.Asset.getTokenAddress({ assetAddress: asset.id })
          const [name, decimals] = await Promise.all([
            publicClient.readContract({ address: token, abi: erc20MetadataAbi, functionName: 'name', args: [] }),
            publicClient.readContract({ address: token, abi: erc20MetadataAbi, functionName: 'decimals', args: [] }),
          ])
          const d = typeof decimals === 'bigint' ? Number(decimals) : (decimals as number)
          return { assetAddress: asset.id, token, name: name as string, decimals: d }
        }),
      )
      return new Map(entries.map((e) => [e.assetAddress.toLowerCase(), e] as const))
    },
    enabled: Boolean(sdk && publicClient && myAssets.length > 0),
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

  const demoTokenMetaQuery = useQuery({
    queryKey: ['ocr', 'demoTokenMeta', demoTokenAddressQuery.data],
    queryFn: async () => {
      if (!demoTokenAddressQuery.data) throw new Error('Missing demo token address')
      if (!publicClient) throw new Error('Public client not ready')
      const token = demoTokenAddressQuery.data
      const [name, decimals] = await Promise.all([
        publicClient.readContract({ address: token, abi: erc20MetadataAbi, functionName: 'name', args: [] }),
        publicClient.readContract({ address: token, abi: erc20MetadataAbi, functionName: 'decimals', args: [] }),
      ])
      const d = typeof decimals === 'bigint' ? Number(decimals) : (decimals as number)
      return { name: name as string, decimals: d }
    },
    enabled: Boolean(demoTokenAddressQuery.data && publicClient),
  })

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!newApiName.trim()) throw new Error('API name is required')

      const tokenMeta = demoTokenMetaQuery.data
      if (!tokenMeta) throw new Error('Token metadata not loaded')

      const units = parseUnits(newPricePerDay.trim(), tokenMeta.decimals)
      const pricePerSecond = units / 86400n
      if (pricePerSecond <= 0n) throw new Error('Price per day is too low')

      const assetId = keccak256(stringToHex(newApiName.trim()))

      const tokenAddress = demoTokenAddressQuery.data
      if (!tokenAddress || !isAddress(tokenAddress, { strict: true })) {
        throw new Error('No token address available (seed demo assets first)')
      }

      const owner = ownerQuery.data || address
      if (!owner || !isAddress(owner, { strict: true })) {
        throw new Error('Registry owner not available and wallet not connected')
      }

      const txHash = await sdk.AssetRegistry.createAsset({
        assetId,
        subscriptionPrice: pricePerSecond,
        subscriptionDuration: 1n,
        tokenAddress,
        owner: owner as Address,
      })

      const zeroAddr = '0x0000000000000000000000000000000000000000'
      let assetAddress: string | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const addr = await sdk.AssetRegistry.getAsset({ assetId })
          if (addr && addr !== zeroAddr) {
            assetAddress = addr
            break
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!assetAddress) throw new Error('Could not resolve asset address after creation')

      return txHash
    },
    onSuccess: async () => {
      setNewApiName('')
      setNewPricePerDay('')
      setModalOpen(false)
      await new Promise((r) => setTimeout(r, 3000))
      await qc.invalidateQueries({ queryKey: ['indexer', 'listAssetsByRegistry'] })
    },
  })

  if (!appConfig.registryAddress) {
    return (
      <div className={styles.root}>
        <p>Missing <code>VITE_REGISTRY_ADDRESS</code>.</p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Creator Console</h1>
          <p className={styles.pageSubtitle}>Manage your API routes and pricing configurations.</p>
        </div>
        <button
          className={styles.registerBtn}
          onClick={() => setModalOpen(true)}
          disabled={!sdk}
        >
          <span className="material-symbols-outlined">add</span>
          Register New Route
        </button>
      </header>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={`material-symbols-outlined ${styles.sectionIcon}`}>terminal</span>
          Manage API Routes
        </h2>
        {myAssets.length > 0 && (
          <span className={styles.routeCount}>{myAssets.length} Active Route{myAssets.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {assetsQuery.isLoading ? (
        <p className={styles.emptyState}>Loading assets…</p>
      ) : myAssets.length === 0 ? (
        <p className={styles.emptyState}>No API routes found. Register your first route to get started.</p>
      ) : (
        <ul className={styles.routeList}>
          {myAssets.map((a) => (
            <RouteCard
              key={a.id}
              asset={a}
              serviceName={serviceNamesQuery.data?.[a.id.toLowerCase()]}
              tokenMeta={tokenMetaQuery.data?.get(a.id.toLowerCase())}
              sdk={sdk}
            />
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <div className={styles.modalHeaderIcon}>
                  <span className="material-symbols-outlined">rocket_launch</span>
                </div>
                <h2>Register New Route</h2>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.formFieldLabel}>API name</label>
                    <input
                      className={styles.formInput}
                      value={newApiName}
                      onChange={(e) => setNewApiName(e.target.value)}
                      placeholder="e.g., Data Enrichment Pro"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <p className={styles.pricingHint}>
                      Hashed to the on-chain asset id. The mock API only maps friendly demo URLs for assets listed in
                      the SDK deployments file (seeded routes); other routes get a generic placeholder URL.
                    </p>
                  </div>
                </div>

                <div className={styles.pricingGroup}>
                  <span className={styles.pricingGroupLabel}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
                    Pricing
                  </span>
                  <div className={styles.pricingInputs}>
                    <div className={styles.formField}>
                      <label className={styles.formFieldLabel}>
                        Price per day ({demoTokenMetaQuery.data?.name ?? 'token'})
                      </label>
                      <input
                        className={styles.formInput}
                        value={newPricePerDay}
                        onChange={(e) => setNewPricePerDay(e.target.value)}
                        placeholder="0.00"
                        type="text"
                        inputMode="decimal"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <p className={styles.pricingHint}>
                    Subscribers choose how many days to buy; each day is charged at this rate.
                  </p>
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.deployBtn}
                    onClick={() => createServiceMutation.mutate()}
                    disabled={!sdk || createServiceMutation.isPending || !demoTokenMetaQuery.data}
                  >
                    {createServiceMutation.isPending ? 'Deploying…' : 'Deploy Route'}
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
                  </button>
                </div>
              </div>

              {createServiceMutation.data && (
                <div className={`${styles.modalFeedback} ${styles.modalFeedbackSuccess}`}>
                  Route deployed! Tx: <code>{createServiceMutation.data}</code>
                </div>
              )}
              {createServiceMutation.error && (
                <div className={`${styles.modalFeedback} ${styles.modalFeedbackError}`}>
                  {(createServiceMutation.error as Error).message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TokenMeta {
  assetAddress: Address
  token: Address
  name: string
  decimals: number
}

function RouteCard(props: {
  asset: IndexerAssetEntity
  serviceName: string | undefined
  tokenMeta: TokenMeta | undefined
  sdk: ReturnType<typeof useOcrSdk>
}) {
  const navigate = useNavigate()
  const { asset: a, serviceName, tokenMeta, sdk } = props
  const durationSeconds = 86400n

  const priceQuery = useQuery({
    queryKey: ['ocr', 'myAssets', 'price', a.id, durationSeconds.toString()],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      const count = await countPeriodsCoveringSeconds(sdk, a.id, durationSeconds)
      return await sdk.Asset.getSubscriptionPrice({ assetAddress: a.id, count })
    },
    enabled: Boolean(sdk),
  })

  const priceDisplay = useMemo(() => {
    if (!priceQuery.data || !tokenMeta) return null
    return `${formatUnits(priceQuery.data, tokenMeta.decimals)} ${tokenMeta.name}`
  }, [priceQuery.data, tokenMeta])

  return (
    <li
      className={styles.routeCard}
      onClick={() => navigate(`/assets/${a.assetId}`)}
    >
      <div className={styles.routeCardAccent} />
      <div className={styles.routeCardContent}>
        <div className={styles.routeCardInfo}>
          <div className={styles.routeNameRow}>
            <span className={styles.routeName}>{serviceName ?? 'Loading…'}</span>
            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              live
            </div>
          </div>
          <div className={styles.routeUrl}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>
            {a.id}
          </div>
          <div className={styles.routeMeta}>
            {priceDisplay && (
              <div className={styles.metaItem}>
                <span className={`material-symbols-outlined ${styles.metaIcon}`}>payments</span>
                <span>{priceDisplay} / day</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
