import { keccak256, stringToHex, type Hex } from 'viem'

export type PetDefinition = {
  slug: string
  /** Public URL under /pets/ */
  image: string
  name: string
  species: string
  tagline: string
  accent: string
  /** Hashed to bytes32 when subscribed on-chain. */
  assetLabel?: string
  /** Fallback for Unity bridge until WebGL uses images. */
  emoji: string
}

const PET_IMAGE_FILES = [
  'black_goat.png',
  'black_lama.png',
  'black_rabbit.png',
  'black_sheep.png',
  'cow.png',
  'dark_brown_goat.png',
  'dotted-cat.png',
  'dotted_dog.png',
  'green_duck.png',
  'light_brown_dog.png',
  'light_brown_goat.png',
  'light_brown_horse.png',
  'pig.png',
  'read_sheep.png',
  'rooster.png',
  'white_cat.png',
  'white_horse.png',
  'white_lama.png',
  'white_rabbit.png',
  'white_sheep.png',
  'yellow_brid.png',
] as const

const SPECIES_EMOJI: Record<string, string> = {
  goat: '🐐',
  llama: '🦙',
  rabbit: '🐇',
  sheep: '🐑',
  cow: '🐄',
  cat: '🐈',
  dog: '🐕',
  duck: '🦆',
  horse: '🐴',
  pig: '🐷',
  chicken: '🐔',
  chick: '🐤',
}

const SPECIES_ACCENT: Record<string, string> = {
  goat: '#c4a77d',
  llama: '#e8d4b8',
  rabbit: '#f5e6d3',
  sheep: '#cfd8dc',
  cow: '#8d6e63',
  cat: '#f4a3b8',
  dog: '#d4a574',
  duck: '#81c784',
  horse: '#bcaaa4',
  pig: '#f4a3b8',
  chicken: '#e9c46a',
  chick: '#ffe082',
}

type PetOverride = {
  slug?: string
  name?: string
  species?: string
  tagline?: string
  accent?: string
  emoji?: string
}

const PET_OVERRIDES: Partial<Record<(typeof PET_IMAGE_FILES)[number], PetOverride>> = {
  'black_goat.png': { name: 'Bramble' },
  'black_lama.png': { name: 'Luna' },
  'black_rabbit.png': { name: 'Pepper' },
  'black_sheep.png': { name: 'Shadow' },
  'cow.png': { name: 'Bessie' },
  'dark_brown_goat.png': { name: 'Hazel' },
  'dotted-cat.png': { name: 'Speckles' },
  'dotted_dog.png': { name: 'Spot' },
  'green_duck.png': { name: 'Quincy' },
  'light_brown_dog.png': { name: 'Biscuit' },
  'light_brown_goat.png': { name: 'Cinnamon' },
  'light_brown_horse.png': { name: 'Chestnut' },
  'pig.png': {
    slug: 'pig',
    name: 'Penny',
    species: 'Pig',
    tagline: 'Rolls in the mud and oinks for treats.',
    accent: '#f4a3b8',
    emoji: '🐷',
  },
  'read_sheep.png': { name: 'Rusty' },
  'rooster.png': {
    slug: 'chicken',
    name: 'Clucky',
    species: 'Chicken',
    tagline: 'Pecks around the barnyard when your subscription is active.',
    accent: '#e9c46a',
    emoji: '🐔',
  },
  'white_cat.png': { name: 'Snowball' },
  'white_horse.png': { name: 'Comet' },
  'white_lama.png': { name: 'Cloud' },
  'white_rabbit.png': { name: 'Cotton' },
  'white_sheep.png': {
    slug: 'sheep',
    name: 'Wooliam',
    species: 'Sheep',
    tagline: 'Grazes peacefully until access expires.',
    accent: '#cfd8dc',
    emoji: '🐑',
  },
  'yellow_brid.png': { name: 'Pip' },
}

const BASE_SEPOLIA_LABELS: Record<string, string> = {
  chicken: 'weather_api',
  pig: 'stock_data_feed',
  sheep: 'ai_image_gen',
}

const ANVIL_LABELS: Record<string, string> = {
  chicken: 'demo_asset_1',
  pig: 'demo_asset_2',
  sheep: 'demo_asset_3',
}

function fileStem(file: string): string {
  return file.replace(/\.png$/i, '')
}

function titleCaseWords(value: string): string {
  return value
    .replace(/-/g, ' ')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bLama\b/g, 'Llama')
    .replace(/\bBrid\b/g, 'Chick')
    .replace(/\bRead\b/g, 'Red')
}

function inferSpecies(stem: string, override?: PetOverride): string {
  if (override?.species) return override.species
  if (stem.includes('rooster')) return 'Chicken'
  if (stem.includes('brid')) return 'Chick'
  if (stem.includes('lama')) return 'Llama'
  if (stem.includes('goat')) return 'Goat'
  if (stem.includes('rabbit')) return 'Rabbit'
  if (stem.includes('sheep')) return 'Sheep'
  if (stem.includes('horse')) return 'Horse'
  if (stem.includes('dog')) return 'Dog'
  if (stem.includes('cat')) return 'Cat'
  if (stem.includes('duck')) return 'Duck'
  if (stem === 'cow') return 'Cow'
  if (stem === 'pig') return 'Pig'
  return titleCaseWords(stem)
}

function speciesKey(species: string): string {
  return species.toLowerCase()
}

function defaultTagline(species: string, name: string): string {
  const lines: Record<string, string> = {
    goat: `${name} loves climbing rocks and nibbling fence posts.`,
    llama: `${name} watches the farm with calm, fluffy judgment.`,
    rabbit: `${name} bounces through the clover at golden hour.`,
    sheep: `${name} keeps the meadow soundtrack gentle and woolly.`,
    cow: `${name} chews slowly and minds the pasture clock.`,
    cat: `${name} naps in sunbeams between patrol rounds.`,
    dog: `${name} greets every visitor like a best friend.`,
    duck: `${name} paddles in circles, quacking on schedule.`,
    horse: `${name} trots the fence line at dawn.`,
    pig: `${name} snuffles for snacks in the straw.`,
    chicken: `${name} struts the coop like royalty.`,
    chick: `${name} follows the flock in tiny brave steps.`,
  }
  return lines[speciesKey(species)] ?? `${name} is ready for farm life.`
}

function buildBaseCatalog(): PetDefinition[] {
  return PET_IMAGE_FILES.map((file) => {
    const stem = fileStem(file)
    const override = PET_OVERRIDES[file]
    const species = inferSpecies(stem, override)
    const key = speciesKey(species)
    const name = override?.name ?? titleCaseWords(stem)

    return {
      slug: override?.slug ?? stem.replace(/-/g, '_'),
      image: `/pets/${file}`,
      name,
      species,
      tagline: override?.tagline ?? defaultTagline(species, name),
      accent: override?.accent ?? SPECIES_ACCENT[key] ?? '#b7e4c7',
      emoji: override?.emoji ?? SPECIES_EMOJI[key] ?? '🐾',
    }
  })
}

const BASE_CATALOG = buildBaseCatalog()

export function petCatalogForChain(chainKey: string): PetDefinition[] {
  const labels = chainKey === 'anvil' ? ANVIL_LABELS : BASE_SEPOLIA_LABELS

  return BASE_CATALOG.map((pet) => ({
    ...pet,
    assetLabel: labels[pet.slug] ?? pet.assetLabel,
  }))
}

export function assetIdFromLabel(label: string): Hex {
  return keccak256(stringToHex(label))
}

export function resolvePetByAssetId(assetId: Hex, chainKey: string): PetDefinition | undefined {
  const catalog = petCatalogForChain(chainKey)
  const normalized = assetId.toLowerCase()
  return catalog.find(
    (pet) => pet.assetLabel && assetIdFromLabel(pet.assetLabel).toLowerCase() === normalized,
  )
}
