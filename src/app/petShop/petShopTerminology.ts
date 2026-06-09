/**
 * Pet-shop UI labels mapped onto OCR protocol roles:
 * - Hub = on-chain AssetRegistry
 * - Shepherd / farmer = asset owner (protocol "creator")
 * - Animal = subscribable Asset contract
 */
export const petShopTerms = {
  hub: 'farm hub',
  hubNav: 'Rent-A-Pet',
  farmNav: 'My Little Farm',
  shepherd: 'Shepherd',
  shepherds: 'Shepherds',
  animal: 'animal',
  animals: 'animals',
  registerAnimal: 'Register animal',
  yourAnimals: 'Your animals',
  addAnimal: 'Add animal',
  manageAnimal: 'Manage animal',
} as const

export function adminConsoleSubtitle(isRegistryOwner: boolean): string {
  if (isRegistryOwner) {
    return 'Operate the farm hub (on-chain registry). Register rentable animals and assign them to shepherds.'
  }
  return 'Manage rentable animals you shepherd on the farm hub.'
}
