import type { CreatorGatedContent, CreatorProfileInput, CreatorPublicMeta } from './creatorProfile'
import { appConfig } from './config'

export type { CreatorGatedContent, CreatorProfileInput, CreatorPublicMeta }

type ServiceEntry = CreatorProfileInput

let sheetCache: { map: Record<string, ServiceEntry>; fetchedAt: number } | null = null
const SHEET_CACHE_MS = 30_000

function normalizeAddress(addr: string) {
  return addr.toLowerCase()
}

export function usesDemoServicesSheet(): boolean {
  return Boolean(appConfig.demoServicesSheetUrl)
}

function apiUrl(path: string): string {
  const base = appConfig.mockApiUrl.replace(/\/$/, '')
  return `${base}${path}`
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (c === ',' && !inQuotes) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += c
  }
  out.push(current.trim())
  return out
}

function sheetRowsToMap(csv: string): Record<string, ServiceEntry> {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length === 0) return {}

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase())
  const addrIdx = header.findIndex((h) => h === 'address' || h === 'assetaddress' || h === 'asset')
  const nameIdx = header.findIndex((h) => h === 'name')
  const avatarIdx = header.findIndex((h) => h === 'avatar' || h === 'avatarurl')
  const contentImageIdx = header.findIndex(
    (h) => h === 'contentimage' || h === 'contentimageurl' || h === 'imageurl',
  )
  const videoIdx = header.findIndex((h) => h === 'video' || h === 'videourl' || h === 'youtubeurl')
  const articleIdx = header.findIndex((h) => h === 'article')

  if (addrIdx < 0 || nameIdx < 0) {
    throw new Error(
      'Sheet must have columns: address, name (optional: avatarUrl, contentImageUrl, videoUrl, article)',
    )
  }

  const map: Record<string, ServiceEntry> = {}
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    const address = cols[addrIdx]
    const name = cols[nameIdx]
    const avatarUrl = avatarIdx >= 0 ? cols[avatarIdx] : undefined
    const contentImageUrl = contentImageIdx >= 0 ? cols[contentImageIdx] : undefined
    const videoUrl = videoIdx >= 0 ? cols[videoIdx] : undefined
    const article = articleIdx >= 0 ? cols[articleIdx] : undefined
    if (!address?.startsWith('0x') || !name) continue
    map[normalizeAddress(address)] = {
      name,
      avatarUrl: avatarUrl?.trim() ? avatarUrl.trim() : undefined,
      contentImageUrl: contentImageUrl?.trim() ? contentImageUrl.trim() : undefined,
      videoUrl: videoUrl?.trim() ? videoUrl.trim() : undefined,
      article: article?.trim() ? article : undefined,
    }
  }
  return map
}

async function loadFromGoogleSheet(): Promise<Record<string, ServiceEntry>> {
  const url = appConfig.demoServicesSheetUrl
  if (!url) return {}

  const now = Date.now()
  if (sheetCache && now - sheetCache.fetchedAt < SHEET_CACHE_MS) {
    return sheetCache.map
  }

  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`Could not load Google Sheet: HTTP ${resp.status}`)
  const map = sheetRowsToMap(await resp.text())
  sheetCache = { map, fetchedAt: now }
  return map
}

async function getEntry(assetAddress: string): Promise<ServiceEntry | null> {
  const key = normalizeAddress(assetAddress)

  if (usesDemoServicesSheet()) {
    const map = await loadFromGoogleSheet()
    return map[key] ?? null
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

/** Public metadata (name + avatar) for an asset. */
export async function fetchCreatorPublicMeta(
  assetAddress: string,
): Promise<CreatorPublicMeta | null> {
  if (usesDemoServicesSheet()) {
    const entry = await getEntry(assetAddress)
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

export async function fetchGatedCreatorContent(
  assetAddress: string,
  userAddress: string,
): Promise<CreatorGatedContent | null> {
  if (usesDemoServicesSheet()) {
    const entry = await getEntry(assetAddress)
    if (!entry?.article) return null
    return {
      name: entry.name,
      contentImageUrl: entry.contentImageUrl,
      videoUrl: entry.videoUrl,
      article: entry.article,
    }
  }

  const resp = await fetch(
    apiUrl(
      `/api/gated-urls?assetAddress=${encodeURIComponent(assetAddress)}&user=${encodeURIComponent(userAddress)}`,
    ),
  )
  if (resp.status === 403) return null
  if (!resp.ok) throw new Error(`Demo API error: ${resp.status}`)
  return (await resp.json()) as CreatorGatedContent
}

export function demoServiceSheetRow(params: CreatorProfileInput & { assetAddress: string }): string {
  return `${params.assetAddress.toLowerCase()}\t${params.name.trim()}\t${(params.avatarUrl ?? '').trim()}\t${(params.contentImageUrl ?? '').trim()}\t${(params.videoUrl ?? '').trim()}\t${(params.article ?? '').trim()}`
}

export async function registerDemoService(
  params: CreatorProfileInput & { assetAddress: string },
): Promise<void> {
  if (usesDemoServicesSheet()) {
    sheetCache = null
    return
  }

  const resp = await fetch(apiUrl('/api/register-service'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetAddress: params.assetAddress,
      name: params.name.trim(),
      avatarUrl: params.avatarUrl?.trim() || undefined,
      contentImageUrl: params.contentImageUrl?.trim() || undefined,
      videoUrl: params.videoUrl?.trim() || undefined,
      article: params.article,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Could not register creator: ${text || resp.status}`)
  }
}
