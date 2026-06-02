import type { CreatorGatedContent, CreatorProfileInput, CreatorPublicMeta } from './creatorProfile'
import { appConfig } from './config'
import { getDemoServiceEntry, writeDemoServiceToSheet } from './demoServicesSheet'

export type { CreatorGatedContent, CreatorProfileInput, CreatorPublicMeta }

function apiUrl(path: string): string {
  const base = appConfig.mockApiUrl.replace(/\/$/, '')
  return `${base}${path}`
}

/** True when creator profiles are loaded from Google Sheets (frontend only). */
export function usesDemoServicesSheet(): boolean {
  return Boolean(appConfig.demoServicesSheetUrl)
}

/** React Query options so sheet-backed pages refetch creator metadata on each mount. */
export function demoServicesSheetQueryOptions() {
  if (!usesDemoServicesSheet()) return {}
  return { staleTime: 0, refetchOnMount: 'always' as const }
}

/** Public metadata (name + avatar) for an asset contract address. */
export async function fetchCreatorPublicMeta(
  assetAddress: string,
): Promise<CreatorPublicMeta | null> {
  if (usesDemoServicesSheet()) {
    const entry = await getDemoServiceEntry(assetAddress)
    if (!entry) return null
    return { name: entry.name, avatarUrl: entry.avatarUrl }
  }

  try {
    const resp = await fetch(
      apiUrl(`/api/asset-name?assetAddress=${encodeURIComponent(assetAddress)}`),
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as CreatorPublicMeta
    if (!data.name) return null
    return { name: data.name, avatarUrl: data.avatarUrl }
  } catch {
    return null
  }
}

/** @deprecated Use fetchCreatorPublicMeta */
export async function fetchCreatorMeta(assetAddress: string): Promise<CreatorPublicMeta | null> {
  return fetchCreatorPublicMeta(assetAddress)
}

/**
 * Subscriber-only creator content.
 * Sheet mode: read from Google Sheet (caller must ensure user is subscribed).
 * Default: mock API checks subscription and returns content.
 */
export async function fetchGatedCreatorContent(
  assetAddress: string,
  userAddress: string,
): Promise<CreatorGatedContent | null> {
  if (usesDemoServicesSheet()) {
    const entry = await getDemoServiceEntry(assetAddress)
    if (!entry) return null
    const article = entry.article?.trim()
    if (!article) return null
    return {
      name: entry.name,
      contentImageUrl: entry.contentImageUrl,
      videoUrl: entry.videoUrl,
      article,
    }
  }

  const resp = await fetch(
    apiUrl(
      `/api/gated-urls?assetAddress=${encodeURIComponent(assetAddress)}&user=${encodeURIComponent(userAddress)}`,
    ),
  )
  if (resp.status === 403) return null
  if (!resp.ok) throw new Error(`Demo API error: ${resp.status}`)
  const data = (await resp.json()) as CreatorGatedContent
  if (!data.article) return null
  return data
}

/**
 * Persist creator profile for an asset address.
 * Sheet mode: POST to Google Apps Script web app (CSV publish URL is read-only).
 * Default: POST to mock API (`services.json`).
 */
export async function registerDemoService(
  params: CreatorProfileInput & { assetAddress: string },
): Promise<{ sheetMode: boolean }> {
  const entry: CreatorProfileInput = {
    name: params.name.trim(),
    avatarUrl: params.avatarUrl?.trim() || undefined,
    contentImageUrl: params.contentImageUrl?.trim() || undefined,
    videoUrl: params.videoUrl?.trim() || undefined,
    article: params.article,
  }

  if (usesDemoServicesSheet()) {
    await writeDemoServiceToSheet({ ...entry, assetAddress: params.assetAddress })
    return { sheetMode: true }
  }

  const resp = await fetch(apiUrl('/api/register-service'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetAddress: params.assetAddress,
      ...entry,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Could not register creator: ${text || resp.status}`)
  }
  return { sheetMode: false }
}
