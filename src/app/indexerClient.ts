import { createSdkIndexer } from '@open-creator-rails/sdk'

import { appConfig } from './config'

export function createDemoIndexer() {
  return createSdkIndexer(appConfig.indexerUrl, { chainId: appConfig.chain.id })
}
