import { appConfig } from './config'

/** Chain the demo is built for (Anvil 31337 or Sepolia 11155111). Pass to indexer GraphQL `where.chainId`. */
export function indexerChainId(): number {
  return appConfig.chain.id
}
