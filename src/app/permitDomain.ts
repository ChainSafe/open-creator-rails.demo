import type { Address } from 'viem'

/** Circle native USDC — EIP-2612 domain uses version "2", not "1". */
const USDC_BY_CHAIN: Record<number, Address> = {
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}

export function erc20PermitVersion(chainId: number, tokenAddress: Address): '1' | '2' {
  const known = USDC_BY_CHAIN[chainId]
  if (known && known.toLowerCase() === tokenAddress.toLowerCase()) {
    return '2'
  }
  return '1'
}

export function isKnownUsdc(chainId: number, tokenAddress: Address): boolean {
  return erc20PermitVersion(chainId, tokenAddress) === '2'
}
