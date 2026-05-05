import { getAbiItem } from 'viem'
import { createConfig, factory } from 'ponder'

import { AssetABI } from './open-creator-rails.sdk/dist/config/AssetABI.js'
import { AssetRegistryABI } from './open-creator-rails.sdk/dist/config/AssetRegistryABI.js'

const AssetCreatedEvent = getAbiItem({
  abi: AssetRegistryABI,
  name: 'AssetCreated',
})

const registryAddress = process.env.VITE_REGISTRY_ADDRESS as `0x${string}` | undefined
if (!registryAddress) {
  throw new Error('Missing VITE_REGISTRY_ADDRESS.')
}

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: process.env.PONDER_RPC_URL_31337 ?? 'http://127.0.0.1:8545',
    },
  },
  contracts: {
    AssetRegistry: {
      chain: 'anvil',
      abi: AssetRegistryABI,
      address: [registryAddress],
      startBlock: 0,
    },
    Asset: {
      chain: 'anvil',
      abi: AssetABI,
      address: factory({
        address: [registryAddress],
        event: AssetCreatedEvent,
        parameter: 'asset',
      }),
      startBlock: 0,
    },
  },
})

