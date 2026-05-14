import { type IndexerAssetEntity } from '@open-creator-rails/sdk'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatUnits, type Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { appConfig } from '../config'
import { createDemoIndexer } from '../indexerClient'
import { useOcrSdk } from '../ocrSdk'
import { countPeriodsCoveringSeconds } from '../subscriptionPeriod'
import { erc20MetadataAbi } from '../erc20Permit'
import styles from './MyAssetsPage.module.scss'

function toLower(a: string | undefined) {
  return (a ?? '').toLowerCase()
}

export function MyAssetsPage() {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const publicClient = usePublicClient()
  const { address } = useAccount()

  const [priceDays, setPriceDays] = useState(30)
  const durationSeconds = useMemo(() => BigInt(Math.max(1, priceDays)) * 24n * 60n * 60n, [priceDays])

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

  const pricesQuery = useQuery({
    queryKey: ['ocr', 'myAssets', 'prices', durationSeconds.toString(), myAssets.map((a) => a.id).join(',')],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      const entries = await Promise.all(
        myAssets.map(async (asset) => {
          const count = await countPeriodsCoveringSeconds(sdk, asset.id, durationSeconds)
          const price = await sdk.Asset.getSubscriptionPrice({ assetAddress: asset.id, count })
          return { assetAddress: asset.id, price }
        }),
      )
      return new Map(entries.map((e) => [e.assetAddress.toLowerCase(), e.price] as const))
    },
    enabled: Boolean(sdk && myAssets.length > 0),
  })

  const setPriceMutation = useMutation({
    mutationFn: async (params: { assetAddress: Address; priceForDuration: string }) => {
      if (!sdk) throw new Error('SDK not ready')
      const tokenMeta = tokenMetaQuery.data?.get(params.assetAddress.toLowerCase())
      if (!tokenMeta) throw new Error('Token metadata not loaded')

      // Convert "price per N days" to "price per second" (contract stores a single price value).
      // Price per second = (amount * 10^decimals) / durationSeconds.
      const amount = Number(params.priceForDuration)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid price')

      const units = BigInt(Math.round(amount * 10 ** tokenMeta.decimals))
      const perSecond = units / durationSeconds
      if (perSecond <= 0n) throw new Error('Price too low for chosen duration')

      return await sdk.Asset.setSubscriptionPrice({
        assetAddress: params.assetAddress,
        newSubscriptionPrice: perSecond,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ocr', 'myAssets', 'prices'] })
    },
  })

  return (
    <div className={styles.root}>
      <h1>Your Assets</h1>

      {!appConfig.registryAddress ? (
        <p>
          Missing <code>VITE_REGISTRY_ADDRESS</code>.
        </p>
      ) : null}

      <hr className={styles.sectionDivider} />

      <p>
        Price view/edit helper duration:{' '}
        <Input
          type="number"
          min={1}
          value={priceDays}
          onChange={(e) => setPriceDays(Number(e.target.value))}
          className={styles.daysInput}
        />{' '}
        days
      </p>

      {assetsQuery.isLoading ? <p>Loading assets…</p> : null}
      {assetsQuery.error ? (
        <p>
          Indexer error: <code>{(assetsQuery.error as Error).message}</code>
        </p>
      ) : null}

      <h2>Assets you own</h2>
      {myAssets.length === 0 ? <p>No assets found for your address (or indexer not running).</p> : null}

      <ul className={styles.assetList}>
        {myAssets.map((a) => {
          const tokenMeta = tokenMetaQuery.data?.get(a.id.toLowerCase())
          const price = pricesQuery.data?.get(a.id.toLowerCase())

          return (
            <li key={a.id} className={styles.assetCard}>
              <div className={styles.assetCardBody}>
                <div>
                  Asset: <code>{a.id}</code>
                </div>
                <div>
                  AssetId: <code>{a.assetId}</code>
                  {' · '}
                  <Link to={`/assets/${a.assetId}/history`}>History</Link>
                </div>
                <div>
                  Token: <code>{tokenMeta?.token ?? '—'}</code>
                </div>
                <div>
                  Current price for {priceDays}d:{' '}
                  <code>
                    {price && tokenMeta
                      ? `${formatUnits(price, tokenMeta.decimals)} ${tokenMeta.name}`
                      : pricesQuery.isLoading
                        ? 'Loading…'
                        : '—'}
                  </code>
                </div>
              </div>

              <SetPriceRow
                disabled={!sdk || setPriceMutation.isPending}
                onSet={(v) => setPriceMutation.mutate({ assetAddress: a.id, priceForDuration: v })}
              />
            </li>
          )
        })}
      </ul>

      {setPriceMutation.error ? (
        <p>
          Error: <code>{(setPriceMutation.error as Error).message}</code>
        </p>
      ) : null}
    </div>
  )
}

function SetPriceRow(props: { disabled: boolean; onSet: (value: string) => void }) {
  const [value, setValue] = useState('3')
  return (
    <div className={styles.setPriceRow}>
      <label>
        New price (for chosen duration):{' '}
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={props.disabled}
          className={styles.setPriceInput}
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => props.onSet(value)} disabled={props.disabled}>
        Set price
      </Button>
    </div>
  )
}

