/** Neutral cover URL derived from asset address (fallback when no public avatar). */
export function assetCoverImageUrl(assetAddress: string, width = 640, height = 360): string {
  const seed = assetAddress.slice(2, 10)
  return `https://picsum.photos/seed/${seed}/${width}/${height}`
}
