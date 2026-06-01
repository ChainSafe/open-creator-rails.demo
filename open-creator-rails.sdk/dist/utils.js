import { encodeAbiParameters, encodePacked, keccak256 } from "viem";
/**
 * Canonical on-chain subscriber identity:
 * `keccak256(abi.encode(subscriberId, subscriberAddress))` (matches `IAsset` / `IAssetRegistry`).
 */
export function subscriberHash(subscriberId, subscriberAddress) {
    return keccak256(encodeAbiParameters([
        { type: "string", name: "subscriberId" },
        { type: "address", name: "subscriberAddress" },
    ], [subscriberId, subscriberAddress]));
}
/**
 * Inner digest signed for `Asset.cancelSubscription` (EIP-191), before `MessageHashUtils.toEthSignedMessageHash`.
 * Solidity: `keccak256(abi.encodePacked(chainid, address(this), subscriber))` where `subscriber` is `subscriberHash(...)`.
 */
export function cancelSubscriptionDigest(chainId, assetAddress, subscriber) {
    return keccak256(encodePacked(["uint256", "address", "bytes32"], [BigInt(chainId), assetAddress, subscriber]));
}
export function asAddress(value) {
    if (typeof value !== "string")
        throw new Error("Expected address string");
    return value;
}
export function asHex(value) {
    if (typeof value !== "string")
        throw new Error("Expected hex string");
    return value;
}
export async function graphql(indexerUrl, query, variables) {
    const response = await fetch(indexerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
        throw new Error(`Indexer request failed with status ${response.status}`);
    }
    const json = (await response.json());
    const errors = json?.errors;
    if (Array.isArray(errors) && errors.length) {
        const msg = errors
            .map((e) => (typeof e?.message === "string" ? e.message : null))
            .filter(Boolean)
            .join("; ");
        throw new Error(msg ? `Indexer GraphQL error: ${msg}` : "Indexer GraphQL error");
    }
    if (!("data" in json) || json.data == null) {
        throw new Error("Indexer response missing data");
    }
    return json.data;
}
//# sourceMappingURL=utils.js.map