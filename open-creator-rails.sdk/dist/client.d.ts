import type { Address, Hex } from "viem";
import type { OcrAssetClient, OcrSdkIndexer } from "./types";
import type { AccessCheckParams, AssetLookupParams, CancelSubscriptionParams, ClaimCreatorFeeParams, ManageSubscriptionParams, OcrSdkConfig, OnchainAccessCheckParams, SubscribeParams, SubscriptionStatus } from "./types";
export declare class OcrSdk {
    private readonly publicClient;
    private readonly walletClient?;
    private readonly registryAddress;
    private readonly indexerUrl?;
    readonly indexer?: OcrSdkIndexer;
    readonly AssetRegistry: {
        getAsset: (params: AssetLookupParams) => Promise<Address>;
        viewAsset: (params: AssetLookupParams) => Promise<boolean>;
        isSubscriptionActive: (params: OnchainAccessCheckParams) => Promise<boolean>;
        getSubscription: (params: OnchainAccessCheckParams) => Promise<bigint>;
        getSubscriptionPrice: (params: {
            assetId: Hex;
            count: bigint;
        }) => Promise<bigint>;
        getSubscriptionDuration: (params: AssetLookupParams) => Promise<bigint>;
        getSubscriptionPriceAndDuration: (params: {
            assetId: Hex;
            count: bigint;
        }) => Promise<{
            price: bigint;
            duration: bigint;
        }>;
        getCreatorFee: (params: {
            value: bigint;
        }) => Promise<bigint>;
        getRegistryFee: (params: {
            value: bigint;
        }) => Promise<bigint>;
        getFees: (params: {
            value: bigint;
        }) => Promise<{
            creatorFee: bigint;
            registryFee: bigint;
        }>;
        getFeeShares: () => Promise<{
            creatorFeeShare: bigint;
            registryFeeShare: bigint;
            totalFeeShare: bigint;
        }>;
        getCreatorFeeShare: () => Promise<bigint>;
        getRegistryFeeShare: () => Promise<bigint>;
        getTotalFeeShare: () => Promise<bigint>;
        getOwner: () => Promise<Address>;
        owner: () => Promise<Address>;
        assets: (params: AssetLookupParams) => Promise<Address>;
        createAsset: (params: {
            assetId: Hex;
            subscriptionPrice: bigint;
            subscriptionDuration: bigint;
            tokenAddress: Address;
            owner: Address;
        }) => Promise<Hex>;
        subscribe: (params: SubscribeParams) => Promise<Hex>;
        claimRegistryFee: (params: {
            assetId: Hex;
            subscriberId: string;
            subscriberAddress: Address;
        }) => Promise<Hex>;
        claimRegistryFeeBatch: (params: {
            assetId: Hex;
            subscribers: readonly Hex[];
        }) => Promise<Hex>;
        updateRegistryFeeShare: (params: {
            registryFeeShare: bigint;
        }) => Promise<Hex>;
        transferOwnership: (params: {
            newOwner: Address;
        }) => Promise<Hex>;
        renounceOwnership: () => Promise<Hex>;
    };
    readonly Asset: {
        getAssetId: (params: {
            assetAddress: Address;
        }) => Promise<Hex>;
        getRegistryAddress: (params: {
            assetAddress: Address;
        }) => Promise<Address>;
        getTokenAddress: (params: {
            assetAddress: Address;
        }) => Promise<Address>;
        getSubscriptionDuration: (params: {
            assetAddress: Address;
        }) => Promise<bigint>;
        getSubscriptionPrice: (params: {
            assetAddress: Address;
            count: bigint;
        }) => Promise<bigint>;
        getSubscriptionPriceAndDuration: (params: {
            assetAddress: Address;
            count: bigint;
        }) => Promise<{
            price: bigint;
            duration: bigint;
        }>;
        getSubscription: (params: {
            assetAddress: Address;
            subscriberId: string;
            subscriberAddress: Address;
        }) => Promise<bigint>;
        getSubscriptionStatus: (params: {
            assetAddress: Address;
            subscriberId: string;
            user: Address;
            source?: "auto" | "onchain" | "indexer";
        }) => Promise<SubscriptionStatus>;
        isSubscriptionActive: (params: {
            assetAddress: Address;
            subscriberId: string;
            subscriberAddress: Address;
        }) => Promise<boolean>;
        owner: (params: {
            assetAddress: Address;
        }) => Promise<Address>;
        getOwner: (params: {
            assetAddress: Address;
            source?: "auto" | "onchain" | "indexer";
        }) => Promise<Address>;
        subscribe: (params: {
            assetAddress: Address;
            subscriberId: string;
            subscriberAddress: Address;
            payer: Address;
            spender: Address;
            count: bigint;
            deadline: bigint;
            v: number;
            r: Hex;
            s: Hex;
        }) => Promise<Hex>;
        claimCreatorFee: (params: ClaimCreatorFeeParams) => Promise<Hex>;
        claimCreatorFeeBatch: (params: {
            assetAddress: Address;
            subscribers: readonly Hex[];
        }) => Promise<Hex>;
        claimRegistryFee: (params: ManageSubscriptionParams) => Promise<Hex>;
        revokeSubscription: (params: ManageSubscriptionParams) => Promise<Hex>;
        cancelSubscription: (params: CancelSubscriptionParams) => Promise<Hex>;
        setSubscriptionPrice: (params: {
            assetAddress: Address;
            newSubscriptionPrice: bigint;
        }) => Promise<Hex>;
        transferOwnership: (params: {
            assetAddress: Address;
            newOwner: Address;
        }) => Promise<Hex>;
        renounceOwnership: (params: {
            assetAddress: Address;
        }) => Promise<Hex>;
    };
    constructor(config: OcrSdkConfig);
    private getWalletContext;
    private subscriberBytes32;
    getSubscriptionStatus(params: AccessCheckParams): Promise<SubscriptionStatus>;
    getAsset(params: {
        assetAddress: Address;
    }): OcrAssetClient;
    getAssetById(params: {
        assetId: Hex;
    }): Promise<OcrAssetClient>;
    getSubscriptionFromIndexer(params: {
        assetId: Hex;
        subscriberId: string;
        user: Address;
    }): Promise<SubscriptionStatus | null>;
    getSubscriptionFromIndexerByAssetAddress(params: {
        assetAddress: Address;
        subscriberId: string;
        user: Address;
    }): Promise<SubscriptionStatus | null>;
    getAssetOwnerFromIndexer(params: {
        assetAddress: Address;
    }): Promise<Address | null>;
    getAssetAddress(params: AssetLookupParams): Promise<Address>;
    isSubscriptionActiveOnchain(params: OnchainAccessCheckParams): Promise<boolean>;
    getSubscriptionEndTimeOnchain(params: OnchainAccessCheckParams): Promise<bigint>;
    getSubscriptionOnchain(params: AccessCheckParams): Promise<SubscriptionStatus>;
    viewAsset(params: AssetLookupParams): Promise<boolean>;
    getRegistrySubscriptionPrice(params: {
        assetId: Hex;
        count: bigint;
    }): Promise<bigint>;
    getRegistrySubscriptionDuration(params: AssetLookupParams): Promise<bigint>;
    getRegistrySubscriptionPriceAndDuration(params: {
        assetId: Hex;
        count: bigint;
    }): Promise<{
        price: bigint;
        duration: bigint;
    }>;
    getCreatorFee(params: {
        value: bigint;
    }): Promise<bigint>;
    getRegistryFee(params: {
        value: bigint;
    }): Promise<bigint>;
    getFees(params: {
        value: bigint;
    }): Promise<{
        creatorFee: bigint;
        registryFee: bigint;
    }>;
    getFeeShares(): Promise<{
        creatorFeeShare: bigint;
        registryFeeShare: bigint;
        totalFeeShare: bigint;
    }>;
    getCreatorFeeShare(): Promise<bigint>;
    getRegistryFeeShare(): Promise<bigint>;
    getTotalFeeShare(): Promise<bigint>;
    getRegistryOwner(): Promise<Address>;
    /** Ownable `owner()` on the registry (same role as {@link getRegistryOwner}; may differ if overridden). */
    owner(): Promise<Address>;
    getRegistryOwnerFromOwnable(): Promise<Address>;
    assets(params: AssetLookupParams): Promise<Address>;
    createAsset(params: {
        assetId: Hex;
        subscriptionPrice: bigint;
        subscriptionDuration: bigint;
        tokenAddress: Address;
        owner: Address;
    }): Promise<`0x${string}`>;
    subscribe(params: SubscribeParams): Promise<`0x${string}`>;
    claimRegistryFeeFromRegistry(params: {
        assetId: Hex;
        subscriberId: string;
        subscriberAddress: Address;
    }): Promise<`0x${string}`>;
    claimRegistryFeeBatchFromRegistry(params: {
        assetId: Hex;
        subscribers: readonly Hex[];
    }): Promise<`0x${string}`>;
    updateRegistryFeeShare(params: {
        registryFeeShare: bigint;
    }): Promise<`0x${string}`>;
    transferRegistryOwnership(params: {
        newOwner: Address;
    }): Promise<`0x${string}`>;
    renounceRegistryOwnership(): Promise<`0x${string}`>;
    getAssetId(params: {
        assetAddress: Address;
    }): Promise<Hex>;
    getAssetRegistryAddress(params: {
        assetAddress: Address;
    }): Promise<Address>;
    getAssetTokenAddress(params: {
        assetAddress: Address;
    }): Promise<Address>;
    getAssetSubscriptionDuration(params: {
        assetAddress: Address;
    }): Promise<bigint>;
    getAssetSubscriptionPrice(params: {
        assetAddress: Address;
        count: bigint;
    }): Promise<bigint>;
    getAssetSubscriptionPriceAndDuration(params: {
        assetAddress: Address;
        count: bigint;
    }): Promise<{
        price: bigint;
        duration: bigint;
    }>;
    getAssetSubscription(params: {
        assetAddress: Address;
        subscriberId: string;
        subscriberAddress: Address;
    }): Promise<bigint>;
    getAssetSubscriptionStatus(params: {
        assetAddress: Address;
        subscriberId: string;
        user: Address;
        source?: "auto" | "onchain" | "indexer";
    }): Promise<SubscriptionStatus>;
    isAssetSubscriptionActive(params: {
        assetAddress: Address;
        subscriberId: string;
        subscriberAddress: Address;
    }): Promise<boolean>;
    getAssetOwner(params: {
        assetAddress: Address;
    }): Promise<Address>;
    getAssetOwnerStatus(params: {
        assetAddress: Address;
        source?: "auto" | "onchain" | "indexer";
    }): Promise<Address>;
    subscribeToAsset(params: {
        assetAddress: Address;
        subscriberId: string;
        subscriberAddress: Address;
        payer: Address;
        spender: Address;
        count: bigint;
        deadline: bigint;
        v: number;
        r: Hex;
        s: Hex;
    }): Promise<`0x${string}`>;
    claimCreatorFee(params: ClaimCreatorFeeParams): Promise<`0x${string}`>;
    claimCreatorFeeBatch(params: {
        assetAddress: Address;
        subscribers: readonly Hex[];
    }): Promise<`0x${string}`>;
    claimRegistryFeeOnAsset(params: ManageSubscriptionParams): Promise<`0x${string}`>;
    revokeSubscription(params: ManageSubscriptionParams): Promise<`0x${string}`>;
    cancelSubscription(params: CancelSubscriptionParams): Promise<`0x${string}`>;
    setAssetSubscriptionPrice(params: {
        assetAddress: Address;
        newSubscriptionPrice: bigint;
    }): Promise<`0x${string}`>;
    transferAssetOwnership(params: {
        assetAddress: Address;
        newOwner: Address;
    }): Promise<`0x${string}`>;
    renounceAssetOwnership(params: {
        assetAddress: Address;
    }): Promise<`0x${string}`>;
}
//# sourceMappingURL=client.d.ts.map