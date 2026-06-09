import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem'
import type { Address, Hex } from 'viem'

import { X402_SUBSCRIBER_ID } from './demoSubscriber'

/** `keccak256(abi.encode("ocr-permit-v1", userAddress))` — on-chain x402 subscriber bytes32. */
export function deriveX402SubscriberId(userAddress: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('string, address'), [X402_SUBSCRIBER_ID, userAddress]),
  )
}
