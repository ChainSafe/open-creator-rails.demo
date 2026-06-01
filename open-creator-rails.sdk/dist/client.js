import { AssetABI } from "./config/AssetABI";
import { AssetRegistryABI } from "./config/AssetRegistryABI";
import { createSdkIndexer } from "./indexer";
import { subscriberHash } from "./utils";
export class OcrSdk {
    publicClient;
    walletClient;
    registryAddress;
    indexerUrl;
    indexer;
    AssetRegistry;
    Asset;
    constructor(config) {
        this.publicClient = config.publicClient;
        this.walletClient = config.walletClient;
        this.registryAddress = config.registryAddress;
        this.indexerUrl = config.indexerUrl;
        const chainIdForIndexer = config.chainId ?? config.publicClient.chain?.id;
        if (config.indexerUrl != null && chainIdForIndexer == null) {
            throw new Error("OcrSdk: indexerUrl requires a chain id — set config.chainId or use a publicClient with a configured chain.");
        }
        this.indexer =
            config.indexerUrl != null && chainIdForIndexer != null
                ? createSdkIndexer(config.indexerUrl, { chainId: chainIdForIndexer })
                : undefined;
        this.AssetRegistry = {
            getAsset: (params) => this.getAssetAddress(params),
            viewAsset: (params) => this.viewAsset(params),
            isSubscriptionActive: (params) => this.isSubscriptionActiveOnchain(params),
            getSubscription: (params) => this.getSubscriptionEndTimeOnchain(params),
            getSubscriptionPrice: (params) => this.getRegistrySubscriptionPrice(params),
            getSubscriptionDuration: (params) => this.getRegistrySubscriptionDuration(params),
            getSubscriptionPriceAndDuration: (params) => this.getRegistrySubscriptionPriceAndDuration(params),
            getCreatorFee: (params) => this.getCreatorFee(params),
            getRegistryFee: (params) => this.getRegistryFee(params),
            getFees: (params) => this.getFees(params),
            getFeeShares: () => this.getFeeShares(),
            getCreatorFeeShare: () => this.getCreatorFeeShare(),
            getRegistryFeeShare: () => this.getRegistryFeeShare(),
            getTotalFeeShare: () => this.getTotalFeeShare(),
            getOwner: () => this.getRegistryOwner(),
            owner: () => this.getRegistryOwnerFromOwnable(),
            assets: (params) => this.assets(params),
            createAsset: (params) => this.createAsset(params),
            subscribe: (params) => this.subscribe(params),
            claimRegistryFee: (params) => this.claimRegistryFeeFromRegistry(params),
            claimRegistryFeeBatch: (params) => this.claimRegistryFeeBatchFromRegistry(params),
            updateRegistryFeeShare: (params) => this.updateRegistryFeeShare(params),
            transferOwnership: (params) => this.transferRegistryOwnership(params),
            renounceOwnership: () => this.renounceRegistryOwnership(),
        };
        this.Asset = {
            getAssetId: (params) => this.getAssetId(params),
            getRegistryAddress: (params) => this.getAssetRegistryAddress(params),
            getTokenAddress: (params) => this.getAssetTokenAddress(params),
            getSubscriptionDuration: (params) => this.getAssetSubscriptionDuration(params),
            getSubscriptionPrice: (params) => this.getAssetSubscriptionPrice(params),
            getSubscriptionPriceAndDuration: (params) => this.getAssetSubscriptionPriceAndDuration(params),
            getSubscription: (params) => this.getAssetSubscription(params),
            getSubscriptionStatus: (params) => this.getAssetSubscriptionStatus(params),
            isSubscriptionActive: (params) => this.isAssetSubscriptionActive(params),
            owner: (params) => this.getAssetOwner(params),
            getOwner: (params) => this.getAssetOwnerStatus(params),
            subscribe: (params) => this.subscribeToAsset(params),
            claimCreatorFee: (params) => this.claimCreatorFee(params),
            claimCreatorFeeBatch: (params) => this.claimCreatorFeeBatch(params),
            claimRegistryFee: (params) => this.claimRegistryFeeOnAsset(params),
            revokeSubscription: (params) => this.revokeSubscription(params),
            cancelSubscription: (params) => this.cancelSubscription(params),
            setSubscriptionPrice: (params) => this.setAssetSubscriptionPrice(params),
            transferOwnership: (params) => this.transferAssetOwnership(params),
            renounceOwnership: (params) => this.renounceAssetOwnership(params),
        };
    }
    getWalletContext() {
        if (!this.walletClient)
            throw new Error("walletClient is required");
        const walletClient = this.walletClient;
        const account = walletClient.account;
        if (!account)
            throw new Error("walletClient.account is not set");
        return { walletClient, account };
    }
    subscriberBytes32(params) {
        return subscriberHash(params.subscriberId, params.user);
    }
    async getSubscriptionStatus(params) {
        const source = params.source ?? "auto";
        if (source === "indexer" || (source === "auto" && this.indexerUrl)) {
            if (!this.indexerUrl || !this.indexer)
                throw new Error("indexerUrl is not configured");
            try {
                const fromIndexer = await this.getSubscriptionFromIndexer({
                    assetId: params.assetId,
                    subscriberId: params.subscriberId,
                    user: params.user,
                });
                if (fromIndexer)
                    return fromIndexer;
            }
            catch {
                if (source === "indexer")
                    throw new Error("Indexer request failed");
            }
        }
        return this.getSubscriptionOnchain(params);
    }
    getAsset(params) {
        const assetAddress = params.assetAddress;
        return {
            address: assetAddress,
            getAssetId: () => this.Asset.getAssetId({ assetAddress }),
            getRegistryAddress: () => this.Asset.getRegistryAddress({ assetAddress }),
            getTokenAddress: () => this.Asset.getTokenAddress({ assetAddress }),
            getSubscriptionDuration: () => this.Asset.getSubscriptionDuration({ assetAddress }),
            getSubscriptionPrice: ({ count }) => this.Asset.getSubscriptionPrice({ assetAddress, count }),
            getSubscriptionPriceAndDuration: ({ count }) => this.Asset.getSubscriptionPriceAndDuration({ assetAddress, count }),
            getSubscription: ({ subscriberId, subscriberAddress }) => this.Asset.getSubscription({ assetAddress, subscriberId, subscriberAddress }),
            getSubscriptionStatus: ({ subscriberId, user, source }) => this.Asset.getSubscriptionStatus({ assetAddress, subscriberId, user, source }),
            isSubscriptionActive: ({ subscriberId, subscriberAddress }) => this.Asset.isSubscriptionActive({ assetAddress, subscriberId, subscriberAddress }),
            owner: () => this.Asset.owner({ assetAddress }),
            getOwner: ({ source }) => this.Asset.getOwner({ assetAddress, source }),
            subscribe: (p) => this.Asset.subscribe({ assetAddress, ...p }),
            claimCreatorFee: (p) => this.Asset.claimCreatorFee({ assetAddress, ...p }),
            claimCreatorFeeBatch: (p) => this.Asset.claimCreatorFeeBatch({ assetAddress, ...p }),
            claimRegistryFee: (p) => this.Asset.claimRegistryFee({ assetAddress, ...p }),
            revokeSubscription: (p) => this.Asset.revokeSubscription({ assetAddress, ...p }),
            cancelSubscription: (p) => this.Asset.cancelSubscription({ assetAddress, ...p }),
            setSubscriptionPrice: (p) => this.Asset.setSubscriptionPrice({ assetAddress, ...p }),
            transferOwnership: (p) => this.Asset.transferOwnership({ assetAddress, ...p }),
            renounceOwnership: () => this.Asset.renounceOwnership({ assetAddress }),
        };
    }
    async getAssetById(params) {
        const assetAddress = await this.getAssetAddress({ assetId: params.assetId });
        return this.getAsset({ assetAddress });
    }
    // ---------------------------------------------------------------------------
    // Indexer methods
    // ---------------------------------------------------------------------------
    async getSubscriptionFromIndexer(params) {
        if (!this.indexer)
            throw new Error("indexerUrl is not configured");
        const assetAddress = await this.getAssetAddress({ assetId: params.assetId });
        return this.getSubscriptionFromIndexerByAssetAddress({
            assetAddress,
            subscriberId: params.subscriberId,
            user: params.user,
        });
    }
    async getSubscriptionFromIndexerByAssetAddress(params) {
        if (!this.indexer)
            throw new Error("indexerUrl is not configured");
        const sub = await this.indexer.getSubscription({
            assetAddress: params.assetAddress,
            subscriberId: params.subscriberId,
            subscriberAddress: params.user,
        });
        if (!sub)
            return null;
        return { isActive: sub.isActive, startTime: sub.startTime, endTime: sub.endTime, nonce: sub.nonce };
    }
    async getAssetOwnerFromIndexer(params) {
        if (!this.indexer)
            throw new Error("indexerUrl is not configured");
        return this.indexer.getAssetOwner({ assetAddress: params.assetAddress });
    }
    // ---------------------------------------------------------------------------
    // AssetRegistry methods
    // ---------------------------------------------------------------------------
    async getAssetAddress(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getAsset",
            args: [params.assetId],
        }));
    }
    async isSubscriptionActiveOnchain(params) {
        const sub = this.subscriberBytes32(params);
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "isSubscriptionActive",
            args: [params.assetId, sub],
        }));
    }
    async getSubscriptionEndTimeOnchain(params) {
        const sub = this.subscriberBytes32(params);
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getSubscription",
            args: [params.assetId, sub],
        }));
    }
    async getSubscriptionOnchain(params) {
        const [isActive, expiry] = await Promise.all([
            this.isSubscriptionActiveOnchain({
                assetId: params.assetId,
                subscriberId: params.subscriberId,
                user: params.user,
            }),
            this.getSubscriptionEndTimeOnchain({
                assetId: params.assetId,
                subscriberId: params.subscriberId,
                user: params.user,
            }),
        ]);
        return { isActive, endTime: expiry };
    }
    async viewAsset(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "viewAsset",
            args: [params.assetId],
        }));
    }
    async getRegistrySubscriptionPrice(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getSubscriptionPrice",
            args: [params.assetId, params.count],
        }));
    }
    async getRegistrySubscriptionDuration(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getSubscriptionDuration",
            args: [params.assetId],
        }));
    }
    async getRegistrySubscriptionPriceAndDuration(params) {
        const [price, duration] = (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getSubscriptionPriceAndDuration",
            args: [params.assetId, params.count],
        }));
        return { price, duration };
    }
    async getCreatorFee(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getCreatorFee",
            args: [params.value],
        }));
    }
    async getRegistryFee(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getRegistryFee",
            args: [params.value],
        }));
    }
    async getFees(params) {
        const [creatorFee, registryFee] = (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getFees",
            args: [params.value],
        }));
        return { creatorFee, registryFee };
    }
    async getFeeShares() {
        const raw = (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getFeeShares",
            args: [],
        }));
        let tuple;
        if (Array.isArray(raw)) {
            tuple = raw;
        }
        else if (raw && typeof raw === "object") {
            const o = raw;
            tuple = [0, 1].map((i) => o[String(i)]).filter((v) => typeof v === "bigint");
        }
        else {
            throw new Error("unexpected getFeeShares return shape");
        }
        const creatorFeeShare = tuple[0];
        const registryFeeShare = tuple[1];
        const totalFeeShare = creatorFeeShare + registryFeeShare;
        return { creatorFeeShare, registryFeeShare, totalFeeShare };
    }
    async getCreatorFeeShare() {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getCreatorFeeShare",
            args: [],
        }));
    }
    async getRegistryFeeShare() {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getRegistryFeeShare",
            args: [],
        }));
    }
    async getTotalFeeShare() {
        const [c, r] = await Promise.all([this.getCreatorFeeShare(), this.getRegistryFeeShare()]);
        return c + r;
    }
    async getRegistryOwner() {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "getOwner",
            args: [],
        }));
    }
    /** Ownable `owner()` on the registry (same role as {@link getRegistryOwner}; may differ if overridden). */
    async owner() {
        return this.getRegistryOwnerFromOwnable();
    }
    async getRegistryOwnerFromOwnable() {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "owner",
            args: [],
        }));
    }
    async assets(params) {
        return (await this.publicClient.readContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "assets",
            args: [params.assetId],
        }));
    }
    async createAsset(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "createAsset",
            chain: walletClient.chain ?? null,
            account,
            args: [
                params.assetId,
                params.subscriptionPrice,
                params.subscriptionDuration,
                params.tokenAddress,
                params.owner,
            ],
        });
    }
    async subscribe(params) {
        const { walletClient, account } = this.getWalletContext();
        const assetAddress = await this.getAssetAddress({ assetId: params.assetId });
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "subscribe",
            chain: walletClient.chain ?? null,
            account,
            args: [
                params.assetId,
                sub,
                params.payer,
                assetAddress,
                params.count,
                params.deadline,
                params.v,
                params.r,
                params.s,
            ],
        });
    }
    async claimRegistryFeeFromRegistry(params) {
        const { walletClient, account } = this.getWalletContext();
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "claimRegistryFee",
            chain: walletClient.chain ?? null,
            account,
            args: [params.assetId, sub],
        });
    }
    async claimRegistryFeeBatchFromRegistry(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "claimRegistryFee",
            chain: walletClient.chain ?? null,
            account,
            args: [params.assetId, [...params.subscribers]],
        });
    }
    async updateRegistryFeeShare(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "updateRegistryFeeShare",
            chain: walletClient.chain ?? null,
            account,
            args: [params.registryFeeShare],
        });
    }
    async transferRegistryOwnership(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "transferOwnership",
            chain: walletClient.chain ?? null,
            account,
            args: [params.newOwner],
        });
    }
    async renounceRegistryOwnership() {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: this.registryAddress,
            abi: AssetRegistryABI,
            functionName: "renounceOwnership",
            chain: walletClient.chain ?? null,
            account,
            args: [],
        });
    }
    // ---------------------------------------------------------------------------
    // Asset methods
    // ---------------------------------------------------------------------------
    async getAssetId(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getAssetId",
            args: [],
        }));
    }
    async getAssetRegistryAddress(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getRegistryAddress",
            args: [],
        }));
    }
    async getAssetTokenAddress(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getTokenAddress",
            args: [],
        }));
    }
    async getAssetSubscriptionDuration(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getSubscriptionDuration",
            args: [],
        }));
    }
    async getAssetSubscriptionPrice(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getSubscriptionPrice",
            args: [params.count],
        }));
    }
    async getAssetSubscriptionPriceAndDuration(params) {
        const [price, duration] = (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getSubscriptionPriceAndDuration",
            args: [params.count],
        }));
        return { price, duration };
    }
    async getAssetSubscription(params) {
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "getSubscription",
            args: [sub],
        }));
    }
    async getAssetSubscriptionStatus(params) {
        const source = params.source ?? "auto";
        if (source === "indexer" || (source === "auto" && this.indexerUrl)) {
            if (!this.indexerUrl || !this.indexer)
                throw new Error("indexerUrl is not configured");
            try {
                const fromIndexer = await this.getSubscriptionFromIndexerByAssetAddress({
                    assetAddress: params.assetAddress,
                    subscriberId: params.subscriberId,
                    user: params.user,
                });
                if (fromIndexer)
                    return fromIndexer;
            }
            catch {
                if (source === "indexer")
                    throw new Error("Indexer request failed");
            }
        }
        const [isActive, endTime] = await Promise.all([
            this.isAssetSubscriptionActive({
                assetAddress: params.assetAddress,
                subscriberId: params.subscriberId,
                subscriberAddress: params.user,
            }),
            this.getAssetSubscription({
                assetAddress: params.assetAddress,
                subscriberId: params.subscriberId,
                subscriberAddress: params.user,
            }),
        ]);
        return { isActive, endTime };
    }
    async isAssetSubscriptionActive(params) {
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "isSubscriptionActive",
            args: [sub],
        }));
    }
    async getAssetOwner(params) {
        return (await this.publicClient.readContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "owner",
            args: [],
        }));
    }
    async getAssetOwnerStatus(params) {
        const source = params.source ?? "auto";
        if (source === "indexer" || (source === "auto" && this.indexerUrl)) {
            if (!this.indexerUrl || !this.indexer)
                throw new Error("indexerUrl is not configured");
            try {
                const ownerFromIndexer = await this.getAssetOwnerFromIndexer({ assetAddress: params.assetAddress });
                if (ownerFromIndexer)
                    return ownerFromIndexer;
            }
            catch {
                if (source === "indexer")
                    throw new Error("Indexer request failed");
            }
        }
        return this.getAssetOwner({ assetAddress: params.assetAddress });
    }
    async subscribeToAsset(params) {
        const { walletClient, account } = this.getWalletContext();
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "subscribe",
            chain: walletClient.chain ?? null,
            account,
            args: [sub, params.payer, params.spender, params.count, params.deadline, params.v, params.r, params.s],
        });
    }
    async claimCreatorFee(params) {
        const { walletClient, account } = this.getWalletContext();
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "claimCreatorFee",
            chain: walletClient.chain ?? null,
            account,
            args: [sub],
        });
    }
    async claimCreatorFeeBatch(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "claimCreatorFee",
            chain: walletClient.chain ?? null,
            account,
            args: [params.subscribers],
        });
    }
    async claimRegistryFeeOnAsset(params) {
        const { walletClient, account } = this.getWalletContext();
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "claimRegistryFee",
            chain: walletClient.chain ?? null,
            account,
            args: [sub],
        });
    }
    async revokeSubscription(params) {
        const { walletClient, account } = this.getWalletContext();
        const sub = subscriberHash(params.subscriberId, params.subscriberAddress);
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "revokeSubscription",
            chain: walletClient.chain ?? null,
            account,
            args: [sub],
        });
    }
    async cancelSubscription(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "cancelSubscription",
            chain: walletClient.chain ?? null,
            account,
            args: [params.subscriberId, params.signature],
        });
    }
    async setAssetSubscriptionPrice(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "setSubscriptionPrice",
            chain: walletClient.chain ?? null,
            account,
            args: [params.newSubscriptionPrice],
        });
    }
    async transferAssetOwnership(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "transferOwnership",
            chain: walletClient.chain ?? null,
            account,
            args: [params.newOwner],
        });
    }
    async renounceAssetOwnership(params) {
        const { walletClient, account } = this.getWalletContext();
        return walletClient.writeContract({
            address: params.assetAddress,
            abi: AssetABI,
            functionName: "renounceOwnership",
            chain: walletClient.chain ?? null,
            account,
            args: [],
        });
    }
}
//# sourceMappingURL=client.js.map