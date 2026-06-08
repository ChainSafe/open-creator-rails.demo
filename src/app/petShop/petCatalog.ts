import { keccak256, stringToHex, type Hex } from 'viem'

export type PetDefinition = {
  slug: string
  /** On-chain asset id label (hashed to bytes32). */
  assetLabel: string
  name: string
  species: string
  tagline: string
  emoji: string
  accent: string
}

/** Base Sepolia demo deployment asset labels. */
export const BASE_SEPOLIA_PETS: PetDefinition[] = [
  {
    slug: 'chicken',
    assetLabel: 'weather_api',
    name: 'Clucky',
    species: 'Chicken',
    tagline: 'Pecks around the barnyard when your subscription is active.',
    emoji: '🐔',
    accent: '#e9c46a',
  },
  {
    slug: 'pig',
    assetLabel: 'stock_data_feed',
    name: 'Penny',
    species: 'Pig',
    tagline: 'Rolls in the mud and oinks for treats.',
    emoji: '🐷',
    accent: '#f4a3b8',
  },
  {
    slug: 'sheep',
    assetLabel: 'ai_image_gen',
    name: 'Wooliam',
    species: 'Sheep',
    tagline: 'Grazes peacefully until access expires.',
    emoji: '🐑',
    accent: '#cfd8dc',
  },
]

/** Local Anvil seed labels from scripts/local-demo-seed.sh */
export const ANVIL_PETS: PetDefinition[] = [
  {
    slug: 'chicken',
    assetLabel: 'demo_asset_1',
    name: 'Clucky',
    species: 'Chicken',
    tagline: 'Pecks around the barnyard when your subscription is active.',
    emoji: '🐔',
    accent: '#e9c46a',
  },
  {
    slug: 'pig',
    assetLabel: 'demo_asset_2',
    name: 'Penny',
    species: 'Pig',
    tagline: 'Rolls in the mud and oinks for treats.',
    emoji: '🐷',
    accent: '#f4a3b8',
  },
  {
    slug: 'sheep',
    assetLabel: 'demo_asset_3',
    name: 'Wooliam',
    species: 'Sheep',
    tagline: 'Grazes peacefully until access expires.',
    emoji: '🐑',
    accent: '#cfd8dc',
  },
]

export function assetIdFromLabel(label: string): Hex {
  return keccak256(stringToHex(label))
}

export function petCatalogForChain(chainKey: string): PetDefinition[] {
  return chainKey === 'anvil' ? ANVIL_PETS : BASE_SEPOLIA_PETS
}

export function resolvePetByAssetId(assetId: Hex, chainKey: string): PetDefinition | undefined {
  const catalog = petCatalogForChain(chainKey)
  const normalized = assetId.toLowerCase()
  return catalog.find((pet) => assetIdFromLabel(pet.assetLabel).toLowerCase() === normalized)
}
