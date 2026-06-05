# x402 Integration — Demo App

## What to build

Add an "Pay via x402" button to `AssetPage` that uses the `ocr-permit-v1` Facilitator instead of calling the contract directly. The user still signs a permit with their wallet; the Facilitator broadcasts the transaction and pays gas.

**Key difference from the existing flow:**

| | Existing (`SubscribeToAssetButton`) | x402 |
|-|-------------------------------------|------|
| Who calls `Asset.subscribe()` | User's wallet (user pays gas) | Facilitator (Facilitator pays gas) |
| Subscriber ID derivation | `keccak256(encodePacked(address))` | `keccak256(abi.encode("ocr-permit-v1", address))` |
| Permit `spender` | `assetAddress` | `assetAddress` (same) |

## Files to create / modify

1. **`src/app/hooks/useX402Payment.ts`** — new hook
2. **`src/app/components/X402PayButton.tsx`** — new component
3. **`src/app/views/AssetPage.tsx`** — mount the new component alongside `SubscribeToAssetButton`
4. **`.env.sepolia` / `.env.anvil`** — add `VITE_X402_FACILITATOR_URL`

## Step 1 — Env variable

```bash
VITE_X402_FACILITATOR_URL=http://localhost:3402
```

Add to both `.env.sepolia` and `.env.anvil`. Expose it in `src/app/config.ts`:

```typescript
x402FacilitatorUrl: import.meta.env.VITE_X402_FACILITATOR_URL as string | undefined,
```

## Step 2 — `useX402Payment` hook

```typescript
// src/app/hooks/useX402Payment.ts
import { encodeAbiParameters, hexToSignature, keccak256, parseAbiParameters } from 'viem'
import type { Address, Hex } from 'viem'

export type X402PaymentParams = {
  assetAddress: Address
  tokenAddress: Address
  tokenName: string
  payer: Address
  count: number
  subscriptionPrice: bigint // per period
  facilitatorUrl: string
}

/** keccak256(abi.encode("ocr-permit-v1", userAddress)) */
function deriveSubscriberId(userAddress: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('string, address'), ['ocr-permit-v1', userAddress]),
  )
}

export async function submitX402Payment(
  params: X402PaymentParams,
  publicClient: ReturnType<typeof usePublicClient>,
  walletClient: ReturnType<typeof useWalletClient>['data'],
  chainId: number,
) {
  if (!walletClient) throw new Error('Wallet not connected')

  const { assetAddress, tokenAddress, tokenName, payer, count, subscriptionPrice, facilitatorUrl } = params
  const value = BigInt(count) * subscriptionPrice

  // 1. Read current permit nonce
  const permitNonce = await publicClient.readContract({
    address: tokenAddress,
    abi: [{ type: 'function', name: 'nonces', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
    functionName: 'nonces',
    args: [payer],
  })

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min

  // 2. Sign EIP-2612 permit — spender is the Asset contract (same as existing flow)
  const signatureHex = await walletClient.signTypedData({
    account: payer,
    domain: { name: tokenName, version: '1', chainId, verifyingContract: tokenAddress },
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
    message: { owner: payer, spender: assetAddress, value, nonce: permitNonce, deadline },
  })

  const { v, r, s } = hexToSignature(signatureHex)
  const subscriberId = deriveSubscriberId(payer)

  const paymentPayload = {
    x402Version: 1,
    scheme: 'ocr-permit-v1',
    network: `eip155:${chainId}`,
    payload: { subscriberId, payer, count, deadline: Number(deadline), permitNonce: Number(permitNonce), v: Number(v), r, s },
    requirements: { payTo: assetAddress, asset: tokenAddress, amount: value.toString() },
  }

  // 3. Verify
  const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(paymentPayload),
  })
  const verify = await verifyRes.json()
  if (!verify.isValid) throw new Error(`Verification failed: ${verify.invalidReason}`)

  // 4. Settle
  const settleRes = await fetch(`${facilitatorUrl}/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(paymentPayload),
  })
  const settle = await settleRes.json()
  if (!settle.success) throw new Error(`Settlement failed: ${settle.errorReason}`)

  return settle.transaction as Hex
}
```

## Step 3 — `X402PayButton` component

Wire `submitX402Payment` into a `useMutation`. Add it to `AssetPage.tsx` below the existing `SubscribeToAssetButton`. Show both options so users can choose (direct on-chain vs. gasless via Facilitator).

## Step 4 — Subscription status check

After settlement, call `sdk.Asset.isSubscriptionActive` with the x402 subscriber ID to confirm the subscription is live. Use `deriveSubscriberId(address)` (not the SDK's `subscriberToId`) for the check.

## Notes

- The existing `SubscribeToAssetButton` flow is unaffected — do not remove it.
- The x402 path is additive. Both payment methods produce an active subscription on the same Asset contract.
- Do not display the subscriber ID to the user — it is an internal key.
