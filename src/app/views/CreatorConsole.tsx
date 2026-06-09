import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAddress, keccak256, parseUnits, stringToHex, type Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'

import { CreatorHubCard } from '../components/CreatorHubCard'
import { PetAdminCard } from '../components/PetAdminCard'
import type { CreatorPublicMeta } from '../creatorProfile'
import { appConfig } from '../config'
import { resolvePetByAssetId } from '../petShop/petCatalog'

const DEMO_ASSET_OWNER_ADDRESS = appConfig.demoTransferOwnerAddress ?? ''
import { fetchCreatorPublicMeta } from '../demoServicesClient'
import { createDemoIndexer } from '../indexerClient'
import { useOcrSdk } from '../ocrSdk'
import { erc20MetadataAbi } from '../erc20Permit'
import { adminConsoleSubtitle, petShopTerms } from '../petShop/petShopTerminology'
import hubStyles from './RegistryPage.module.scss'
import styles from './CreatorConsole.module.scss'

function toLower(a: string | undefined) {
  return (a ?? '').toLowerCase()
}

const DEMO_CREATOR_FORM = {
  name: 'Rick Astley',
  avatarUrl: 'https://picsum.photos/seed/rick-astley-avatar/96/96',
  contentImageUrl: 'https://picsum.photos/seed/rick-astley-content/640/360',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  article:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  pricePerDay: '1',
} as const

function fillDemoCreatorForm(setters: {
  setName: (v: string) => void
  setAvatar: (v: string) => void
  setContentImage: (v: string) => void
  setVideo: (v: string) => void
  setArticle: (v: string) => void
  setPrice: (v: string) => void
  setOwner: (v: string) => void
}) {
  setters.setName(DEMO_CREATOR_FORM.name)
  setters.setAvatar(DEMO_CREATOR_FORM.avatarUrl)
  setters.setContentImage(DEMO_CREATOR_FORM.contentImageUrl)
  setters.setVideo(DEMO_CREATOR_FORM.videoUrl)
  setters.setArticle(DEMO_CREATOR_FORM.article)
  setters.setPrice(DEMO_CREATOR_FORM.pricePerDay)
  setters.setOwner(DEMO_ASSET_OWNER_ADDRESS)
}

export function CreatorConsole() {
  const navigate = useNavigate()
  const petShop = appConfig.petShopDemo
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const publicClient = usePublicClient()
  const { address } = useAccount()

  const [modalOpen, setModalOpen] = useState(false)
  const [newCreatorName, setNewCreatorName] = useState('')
  const [newAvatarUrl, setNewAvatarUrl] = useState('')
  const [newContentImageUrl, setNewContentImageUrl] = useState('')
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [newArticle, setNewArticle] = useState('')
  const [newPricePerDay, setNewPricePerDay] = useState('')
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  /** Modal closes on deploy; strip stays until chain + indexer sync finishes */
  const [deployFlowActive, setDeployFlowActive] = useState(false)

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

  const publicMetaQuery = useQuery<Record<string, CreatorPublicMeta>>({
    queryKey: ['mockApi', 'creatorPublicMeta', myAssets.map((a) => a.id).join(',')],
    queryFn: async () => {
      const meta: Record<string, CreatorPublicMeta> = {}
      await Promise.all(
        myAssets.map(async (a) => {
          const entry = await fetchCreatorPublicMeta(a.id)
          if (entry) meta[a.id.toLowerCase()] = entry
        }),
      )
      return meta
    },
    enabled: Boolean(myAssets.length > 0),
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
      if (!newCreatorName.trim()) {
        throw new Error(petShop ? 'Animal name is required' : 'Creator name is required')
      }

      const tokenMeta = demoTokenMetaQuery.data
      if (!tokenMeta) throw new Error('Token metadata not loaded')

      const units = parseUnits(newPricePerDay.trim(), tokenMeta.decimals)
      const pricePerSecond = units / 86400n
      if (pricePerSecond <= 0n) throw new Error('Price per day is too low')

      const assetIdHash = keccak256(stringToHex(newCreatorName.trim()))

      const tokenAddress = demoTokenAddressQuery.data
      if (!tokenAddress || !isAddress(tokenAddress, { strict: true })) {
        throw new Error('No token address available (seed demo assets first)')
      }

      const ownerInput = newOwnerAddress.trim()
      let owner: Address
      if (ownerInput) {
        if (!isAddress(ownerInput)) {
          throw new Error('Enter a valid owner address (0x…)')
        }
        owner = ownerInput
      } else {
        const fallback = ownerQuery.data || address
        if (!fallback || !isAddress(fallback, { strict: true })) {
          throw new Error('Registry owner not available and wallet not connected')
        }
        owner = fallback
      }

      const txHash = await sdk.AssetRegistry.createAsset({
        assetId: assetIdHash,
        subscriptionPrice: pricePerSecond,
        subscriptionDuration: 1n,
        tokenAddress,
        owner: owner as Address,
      })

      const zeroAddr = '0x0000000000000000000000000000000000000000'
      let assetAddress: string | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const addr = await sdk.AssetRegistry.getAsset({ assetId: assetIdHash })
          if (addr && addr !== zeroAddr) {
            assetAddress = addr
            break
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!assetAddress) throw new Error('Could not resolve asset address after creation')

      const regResp = await fetch(`${appConfig.mockApiUrl}/api/register-service`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetAddress,
          name: newCreatorName.trim(),
          avatarUrl: newAvatarUrl.trim() || undefined,
          contentImageUrl: newContentImageUrl.trim() || undefined,
          videoUrl: newVideoUrl.trim() || undefined,
          article: newArticle || undefined,
        }),
      })
      if (!regResp.ok) {
        const err = await regResp.text()
        throw new Error(`Mock API register-service failed: ${err}`)
      }

      return txHash
    },
    onMutate: () => {
      setModalOpen(false)
      setDeployFlowActive(true)
    },
    onError: () => {
      setDeployFlowActive(false)
      setModalOpen(true)
    },
    onSuccess: async () => {
      setNewCreatorName('')
      setNewAvatarUrl('')
      setNewContentImageUrl('')
      setNewVideoUrl('')
      setNewArticle('')
      setNewPricePerDay('')
      setNewOwnerAddress('')
      try {
        await new Promise((r) => setTimeout(r, 3000))
        await qc.invalidateQueries({ queryKey: ['indexer', 'listAssetsByRegistry'] })
        await qc.invalidateQueries({ queryKey: ['mockApi'] })
      } finally {
        setDeployFlowActive(false)
      }
    },
  })

  const isRegistryOwner =
    Boolean(address && ownerQuery.data) &&
    address!.toLowerCase() === (ownerQuery.data as Address).toLowerCase()

  if (!appConfig.registryAddress) {
    return (
      <div className={styles.root}>
        <p>Missing <code>VITE_REGISTRY_ADDRESS</code>.</p>
      </div>
    )
  }

  const rootClass = [
    hubStyles.page,
    styles.root,
    petShop ? styles.rootPetShop : '',
    petShop ? hubStyles.pagePetHub : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass}>
      <header className={petShop ? styles.petPageHero : styles.pageHeader}>
        {petShop ? (
          <>
            <p className={styles.petKicker}>Admin Console</p>
            <h1 className={styles.petTitle}>
              {isRegistryOwner ? 'Farm hub operations' : petShopTerms.yourAnimals}
            </h1>
            <p className={styles.petSubtitle}>{adminConsoleSubtitle(isRegistryOwner)}</p>
          </>
        ) : (
          <>
            <h1 className={hubStyles.pageTitle}>Admin Console</h1>
            <p className={styles.pageSubtitle}>
              Registry administration for deploying creators and managing assets you own.
            </p>
          </>
        )}
      </header>

      {isRegistryOwner ? (
        <section
          className={petShop ? styles.addSectionPetShop : styles.addSection}
          aria-labelledby="add-creator-heading"
        >
          <div className={styles.addSectionIntro}>
            <div className={styles.addSectionHeadingRow}>
              <h2 id="add-creator-heading" className={styles.sectionTitle}>
                <span className={`material-symbols-outlined ${styles.sectionIcon}`}>add_circle</span>
                {petShop ? petShopTerms.registerAnimal : 'Add Creator'}
              </h2>
              <span className={styles.registryOwnerBadge}>Hub admin · registry owner</span>
            </div>
            <p className={styles.addSectionLead}>
              {petShop
                ? 'Deploy a new animal on the farm hub and assign a shepherd wallet as the asset owner.'
                : 'Your wallet controls the asset registry. Deploy new creators on-chain and register their public and gated metadata.'}
            </p>
          </div>
          <div className={styles.addSectionActions}>
            <button
              type="button"
              className={styles.registerBtn}
              onClick={() => setModalOpen(true)}
              disabled={!sdk}
            >
              <span className="material-symbols-outlined">add</span>
              {petShop ? petShopTerms.addAnimal : 'Add Creator'}
            </button>
          </div>
          {deployFlowActive ? (
            <div className={styles.deployProgressStrip} role="status" aria-live="polite">
              <span className={styles.deployProgressSpinner} aria-hidden />
              <div className={styles.deployProgressText}>
                <span className={styles.deployProgressTitle}>
                  {createServiceMutation.isPending
                    ? petShop ? 'Registering animal…' : 'Adding creator…'
                    : petShop ? 'Syncing new animal…' : 'Syncing your new creator…'}
                </span>
                <span className={styles.deployProgressSubtitle}>
                  {createServiceMutation.isPending
                    ? 'Confirm the transaction in your wallet. This can take a moment.'
                    : petShop
                      ? `Waiting for the indexer; the animal will appear under ${petShopTerms.yourAnimals} when ready.`
                      : 'Waiting for the indexer; your creator will appear under Manage Creators when ready.'}
                </span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={petShop ? styles.petSectionHeader : styles.sectionHeader}>
        <h2 className={petShop ? styles.petSectionTitle : styles.sectionTitle}>
          {!petShop ? (
            <span className={`material-symbols-outlined ${styles.sectionIcon}`}>terminal</span>
          ) : null}
          {petShop ? petShopTerms.yourAnimals : 'Manage Creators'}
        </h2>
        {myAssets.length > 0 && (
          <span className={petShop ? styles.petRouteCount : styles.routeCount}>
            {myAssets.length} {petShop ? 'animal' : 'Creator'}
            {myAssets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {assetsQuery.isLoading ? (
        <p className={hubStyles.status}>{petShop ? 'Loading animals…' : 'Loading creators…'}</p>
      ) : myAssets.length === 0 ? (
        <p className={hubStyles.status}>
          {petShop
            ? isRegistryOwner
              ? 'No animals assigned to you yet. Register one on the hub or ask the hub admin.'
              : 'No animals on this wallet. The hub admin registers animals and assigns shepherd wallets as owners.'
            : 'No creators found. Add your first creator to get started.'}
        </p>
      ) : (
        <div className={petShop ? hubStyles.petGrid : hubStyles.grid}>
          {myAssets.map((a) => {
            if (petShop) {
              const pet = resolvePetByAssetId(a.assetId, appConfig.chainKey)
              if (pet) {
                return (
                  <PetAdminCard
                    key={a.id}
                    pet={pet}
                    assetAddress={a.id}
                    onManage={() => navigate(`/assets/${a.assetId}`)}
                  />
                )
              }
            }

            return (
              <CreatorHubCard
                key={a.id}
                assetAddress={a.id}
                creatorName={publicMetaQuery.data?.[a.id.toLowerCase()]?.name ?? (petShop ? 'Animal' : 'Creator')}
                avatarUrl={publicMetaQuery.data?.[a.id.toLowerCase()]?.avatarUrl}
                variant="admin"
                onOpen={() => navigate(`/assets/${a.assetId}`)}
              />
            )
          })}
        </div>
      )}

      {isRegistryOwner && modalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <div className={styles.modalHeaderIcon}>
                  <span className="material-symbols-outlined">rocket_launch</span>
                </div>
                <h2>{petShop ? petShopTerms.registerAnimal : 'Add Creator'}</h2>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                <button
                  type="button"
                  className={styles.demoFillBtn}
                  onClick={() =>
                    fillDemoCreatorForm({
                      setName: setNewCreatorName,
                      setAvatar: setNewAvatarUrl,
                      setContentImage: setNewContentImageUrl,
                      setVideo: setNewVideoUrl,
                      setArticle: setNewArticle,
                      setPrice: setNewPricePerDay,
                      setOwner: setNewOwnerAddress,
                    })
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    science
                  </span>
                  Fill for demo purposes
                </button>

                <div className={styles.modalSectionRow}>
                  <div className={styles.formSection}>
                    <span className={styles.pricingGroupLabel}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>public</span>
                      Public
                    </span>
                    <p className={styles.groupHint}>
                      {petShop
                        ? `Shown on ${petShopTerms.hubNav} before someone rents this animal.`
                        : 'Visible on the Creators Hub and creator page before subscribing.'}
                    </p>
                    <div className={styles.formFieldsStack}>
                      <div className={styles.formField}>
                        <label className={styles.formFieldLabel}>
                          {petShop ? 'Animal name' : 'Creator name'}
                        </label>
                        <input
                          className={styles.formInput}
                          value={newCreatorName}
                          onChange={(e) => setNewCreatorName(e.target.value)}
                          placeholder={petShop ? 'e.g., Bramble the Goat' : 'e.g., Alice Creator'}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formFieldLabel}>
                          {petShop ? 'Animal image URL' : 'Creator avatar URL'}
                        </label>
                        <input
                          className={styles.formInput}
                          value={newAvatarUrl}
                          onChange={(e) => setNewAvatarUrl(e.target.value)}
                          placeholder="https://images.example.com/avatar.jpg"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.formSection}>
                    <span className={styles.pricingGroupLabel}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
                      Private (subscriber-only)
                    </span>
                    <p className={styles.groupHint}>
                      Unlocked after subscription: video, content image, and article.
                    </p>
                    <div className={styles.formFieldsStack}>
                      <div className={styles.formField}>
                        <label className={styles.formFieldLabel}>Content image URL</label>
                        <input
                          className={styles.formInput}
                          value={newContentImageUrl}
                          onChange={(e) => setNewContentImageUrl(e.target.value)}
                          placeholder="https://images.example.com/exclusive.jpg"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formFieldLabel}>Video URL</label>
                        <input
                          className={styles.formInput}
                          value={newVideoUrl}
                          onChange={(e) => setNewVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formFieldLabel}>Article</label>
                        <textarea
                          className={`${styles.formInput} ${styles.formTextarea}`}
                          value={newArticle}
                          onChange={(e) => setNewArticle(e.target.value)}
                          placeholder="Write something for subscribers…"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.modalSectionRow}>
                  <div className={styles.formSection}>
                    <span className={styles.pricingGroupLabel}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
                      Pricing
                    </span>
                    <div className={styles.formFieldsStack}>
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
                  </div>

                  <div className={styles.formSection}>
                    <span className={styles.pricingGroupLabel}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
                      {petShop ? petShopTerms.shepherd : 'Asset owner'}
                    </span>
                    <p className={styles.groupHint}>
                      {petShop
                        ? 'Shepherd wallet that owns this animal on-chain — can set price, claim fees, and transfer ownership. Empty = hub admin (registry owner).'
                        : 'Can update price, claim fees, and transfer ownership. Empty = registry owner.'}
                    </p>
                    <div className={styles.formField}>
                      <label className={styles.formFieldLabel} htmlFor="new-creator-owner">
                        {petShop ? 'Shepherd wallet address' : 'Owner wallet address'}
                      </label>
                      <input
                        id="new-creator-owner"
                        className={styles.formInput}
                        value={newOwnerAddress}
                        onChange={(e) => setNewOwnerAddress(e.target.value)}
                        placeholder="0x… (optional)"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                  </div>
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
                    {createServiceMutation.isPending ? 'Registering…' : petShop ? petShopTerms.registerAnimal : 'Add Creator'}
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
                  </button>
                </div>
              </div>

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
