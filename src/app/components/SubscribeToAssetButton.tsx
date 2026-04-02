import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatUnits, hexToSignature, isHex } from 'viem'
import type { Hex } from 'viem'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { useOcrSdk } from '../ocrSdk'
import { erc20PermitAbi } from '../erc20Permit'

type Props = {
  assetId: Hex
  /** Smaller layout for list rows (Registry / Your Assets). */
  compact?: boolean
}

export function SubscribeToAssetButton({ assetId, compact = false }: Props) {
  const sdk = useOcrSdk()
  const qc = useQueryClient()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [days, setDays] = useState(30)

  const durationSeconds = useMemo(() => BigInt(Math.max(1, days)) * 24n * 60n * 60n, [days])

  const assetAddressQuery = useQuery({
    queryKey: ['ocr', 'assetAddress', assetId],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      return await sdk.AssetRegistry.getAsset({ assetId })
    },
    enabled: Boolean(sdk && assetId && isHex(assetId)),
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

  const tokenAddressQuery = useQuery({
    queryKey: ['ocr', 'assetToken', assetAddressQuery.data],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return await sdk.Asset.getTokenAddress({ assetAddress: assetAddressQuery.data })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const priceQuery = useQuery({
    queryKey: ['ocr', 'assetPrice', assetAddressQuery.data, durationSeconds.toString()],
    queryFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')
      return await sdk.Asset.getSubscriptionPrice({ assetAddress: assetAddressQuery.data, duration: durationSeconds })
    },
    enabled: Boolean(sdk && assetAddressQuery.data),
  })

  const tokenMetaQuery = useQuery({
    queryKey: ['token', 'meta', tokenAddressQuery.data],
    queryFn: async () => {
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!publicClient) throw new Error('Public client not available')
      const [name, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20PermitAbi,
          functionName: 'name',
          args: [],
        }),
        publicClient.readContract({
          address: tokenAddressQuery.data,
          abi: erc20PermitAbi,
          functionName: 'decimals',
          args: [],
        }),
      ])
      const d = typeof decimals === 'bigint' ? Number(decimals) : (decimals as number)
      return { name: name as string, decimals: d }
    },
    enabled: Boolean(tokenAddressQuery.data && publicClient),
  })

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!sdk) throw new Error('SDK not ready')
      if (!address) throw new Error('Connect wallet')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!publicClient) throw new Error('Public client not ready')
      if (!tokenAddressQuery.data) throw new Error('Missing token address')
      if (!priceQuery.data) throw new Error('Missing price')
      if (!assetAddressQuery.data) throw new Error('Missing asset address')

      const token = tokenAddressQuery.data
      const [tokenName, nonce] = await Promise.all([
        publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: 'name', args: [] }),
        publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: 'nonces', args: [address] }),
      ])

      const value = priceQuery.data
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60)
      const assetAddress = assetAddressQuery.data

      const signatureHex = await walletClient.signTypedData({
        account: address,
        domain: {
          name: tokenName as string,
          version: '1',
          chainId: walletClient.chain?.id ?? publicClient.chain?.id ?? 31337,
          verifyingContract: token,
        },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: {
          owner: address,
          spender: assetAddress,
          value,
          nonce,
          deadline,
        },
      })

      const sig = hexToSignature(signatureHex)
      return sdk.AssetRegistry.subscribe({
        assetId,
        owner: address,
        value,
        deadline,
        v: Number(sig.v),
        r: sig.r,
        s: sig.s,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ocr', 'subscriptionStatus'] })
      await qc.invalidateQueries({ queryKey: ['indexer', 'listSubscriptionsByUser'] })
    },
  })

  return (
    <div
      style={
        compact
          ? { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }
          : { marginTop: 12 }
      }
    >
      {!compact ? (
        <>
          <p>
            Token: <code>{tokenAddressQuery.data ?? '(loading)'}</code>
          </p>
          <p>
            Duration:{' '}
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ width: 80 }}
            />{' '}
            days
          </p>
          <p>
            Price:{' '}
            <code>
              {priceQuery.data && tokenMetaQuery.data
                ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
                : priceQuery.isLoading
                  ? 'Loading…'
                  : '—'}
            </code>
          </p>
        </>
      ) : (
        <>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>Days</span>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ width: 56 }}
            />
          </label>
          <span style={{ fontSize: 13 }}>
            {priceQuery.data && tokenMetaQuery.data
              ? `${formatUnits(priceQuery.data, tokenMetaQuery.data.decimals)} ${tokenMetaQuery.data.name}`
              : priceQuery.isLoading
                ? '…'
                : '—'}
          </span>
        </>
      )}

      {!isConnected ? (
        <span style={{ fontSize: compact ? 12 : 14 }}>Connect a wallet to subscribe.</span>
      ) : statusQuery.data?.isActive ? (
        <span style={{ fontSize: compact ? 13 : undefined }}>
          <strong>Subscribed</strong>
          {compact ? (
            <>
              {' · '}
              <Link to={`/assets/${assetId}`}>Details</Link>
            </>
          ) : null}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => subscribeMutation.mutate()}
          disabled={
            !sdk ||
            !assetAddressQuery.data ||
            !tokenAddressQuery.data ||
            !priceQuery.data ||
            subscribeMutation.isPending
          }
        >
          {subscribeMutation.isPending ? 'Subscribing…' : 'Subscribe'}
        </button>
      )}

      {!compact && subscribeMutation.data ? (
        <p>
          Tx: <code>{subscribeMutation.data}</code>
        </p>
      ) : null}
      {subscribeMutation.error ? (
        <p style={{ color: 'var(--error, #c00)', fontSize: compact ? 12 : undefined }}>
          {(subscribeMutation.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}
