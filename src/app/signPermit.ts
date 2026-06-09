import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { hexToSignature } from 'viem'

import { erc20PermitAbi } from './erc20Permit'
import { erc20PermitVersion } from './permitDomain'

export type SignedPermit = {
  value: bigint
  deadline: bigint
  permitNonce: bigint
  v: number
  r: Hex
  s: Hex
}

export async function signAssetPermit(params: {
  publicClient: PublicClient
  walletClient: WalletClient
  owner: Address
  token: Address
  spender: Address
  value: bigint
  chainId: number
  deadlineSecondsFromNow?: number
}): Promise<SignedPermit> {
  const { publicClient, walletClient, owner, token, spender, value, chainId } = params
  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + (params.deadlineSecondsFromNow ?? 3600),
  )

  const [tokenName, nonce] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: 'name',
      args: [],
    }),
    publicClient.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: 'nonces',
      args: [owner],
    }),
  ])

  const signatureHex = await walletClient.signTypedData({
    account: owner,
    domain: {
      name: tokenName as string,
      version: erc20PermitVersion(chainId, token),
      chainId,
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
      owner,
      spender,
      value,
      nonce,
      deadline,
    },
  })

  const sig = hexToSignature(signatureHex)
  return {
    value,
    deadline,
    permitNonce: nonce,
    v: Number(sig.v),
    r: sig.r,
    s: sig.s,
  }
}
