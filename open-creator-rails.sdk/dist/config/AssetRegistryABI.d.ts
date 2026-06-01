/** Generated from `open-creator-rails/apps/contracts/out/AssetRegistry.sol/AssetRegistry.json`. Regenerate with `npm run abis:sync`. */
export declare const AssetRegistryABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "_registryFeeShare";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "assets";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "claimRegistryFee";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscribers";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly outputs: readonly [{
        readonly name: "totalClaimedAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "claimRegistryFee";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriber";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "createAsset";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriptionPrice";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_subscriptionDuration";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_tokenAddress";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "emitRegistryFeeClaimedEvent";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriber";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "claimedAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "claimedAtTimestamp";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "claimedAtNonce";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getAsset";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getCreatorFee";
    readonly inputs: readonly [{
        readonly name: "_value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getCreatorFeeShare";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getFeeShares";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getFees";
    readonly inputs: readonly [{
        readonly name: "_value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "creatorFee";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "registryFee";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getOwner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getRegistryFee";
    readonly inputs: readonly [{
        readonly name: "_value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getRegistryFeeShare";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getSubscription";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriber";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getSubscriptionDuration";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getSubscriptionPrice";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_count";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getSubscriptionPriceAndDuration";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_count";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "price";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "duration";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isSubscriptionActive";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriber";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "owner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "renounceOwnership";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "subscribe";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_subscriber";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_payer";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_spender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_count";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_deadline";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_v";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }, {
        readonly name: "_r";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "_s";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferOwnership";
    readonly inputs: readonly [{
        readonly name: "newOwner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "updateRegistryFeeShare";
    readonly inputs: readonly [{
        readonly name: "_registryFeeShare";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "viewAsset";
    readonly inputs: readonly [{
        readonly name: "_assetId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "AssetCreated";
    readonly inputs: readonly [{
        readonly name: "assetId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "asset";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "subscriptionPrice";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriptionDuration";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "tokenAddress";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "previousOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RegistryFeeClaimed";
    readonly inputs: readonly [{
        readonly name: "assetId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "subscriber";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "claimedAtTimestamp";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "claimedAtNonce";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RegistryFeeClaimedBatch";
    readonly inputs: readonly [{
        readonly name: "assetId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "subscribers";
        readonly type: "bytes32[]";
        readonly indexed: true;
        readonly internalType: "bytes32[]";
    }, {
        readonly name: "totalAmount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RegistryFeeShareUpdated";
    readonly inputs: readonly [{
        readonly name: "newRegistryFeeShare";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AssetAlreadyExists";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AssetNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "OnlyAssetUnauthorizedAccount";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "OwnableInvalidOwner";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "OwnableUnauthorizedAccount";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "RegistryFeeShareOutOfBounds";
    readonly inputs: readonly [];
}];
//# sourceMappingURL=AssetRegistryABI.d.ts.map