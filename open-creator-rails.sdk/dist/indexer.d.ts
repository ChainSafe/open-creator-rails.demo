import type { Address } from "viem";
import { type OcrSdkIndexer } from "./types";
/** Matches `open-creator-rails.indexer` / `getAssetEntityId`. */
export declare function indexerAssetEntityId(chainId: number, assetAddress: Address): string;
/**
 * Normalizes a user-provided base URL to the GraphQL endpoint used by
 * `open-creator-rails.indexer` (`/v2/graphql`). If the URL already ends with
 * `/v2/graphql`, it is returned unchanged.
 */
export declare function resolveOpenCreatorRailsIndexerGraphqlUrl(url: string): string;
export type CreateSdkIndexerOptions = {
    /** Must match the chain the indexer is syncing (see `ponder.config.ts`). */
    chainId: number;
};
export declare function createSdkIndexer(indexerUrl: string, options: CreateSdkIndexerOptions): OcrSdkIndexer;
//# sourceMappingURL=indexer.d.ts.map