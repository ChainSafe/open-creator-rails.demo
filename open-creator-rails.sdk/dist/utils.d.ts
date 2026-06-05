import type { Address, Hex } from "viem";
/**
 * Canonical on-chain subscriber identity:
 * `keccak256(abi.encode(subscriberId, subscriberAddress))` (matches `IAsset` / `IAssetRegistry`).
 */
export declare function subscriberHash(subscriberId: string, subscriberAddress: Address): Hex;
/**
 * Inner digest signed for `Asset.cancelSubscription` (EIP-191), before `MessageHashUtils.toEthSignedMessageHash`.
 * Solidity: `keccak256(abi.encodePacked(chainid, address(this), subscriber))` where `subscriber` is `subscriberHash(...)`.
 */
export declare function cancelSubscriptionDigest(chainId: number, assetAddress: Address, subscriber: Hex): Hex;
export declare function asAddress(value: unknown): Address;
export declare function asHex(value: unknown): Hex;
export declare function graphql<TData>(indexerUrl: string, query: string, variables: Record<string, unknown>): Promise<TData>;
//# sourceMappingURL=utils.d.ts.map