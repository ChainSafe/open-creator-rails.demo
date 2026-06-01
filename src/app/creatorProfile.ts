/** Public creator fields (no subscription required). */
export type CreatorPublicMeta = {
  name: string
  avatarUrl?: string
}

/** Subscriber-only creator content. */
export type CreatorGatedContent = {
  name: string
  contentImageUrl?: string
  videoUrl?: string
  article: string
}

/** Full profile for Admin Console registration. */
export type CreatorProfileInput = CreatorPublicMeta & {
  contentImageUrl?: string
  videoUrl?: string
  article?: string
}
