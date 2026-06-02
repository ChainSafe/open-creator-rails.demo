import type { CreatorProfileInput } from './creatorProfile'
import { appConfig } from './config'

export type SheetServiceEntry = CreatorProfileInput

type SheetRowPayload = {
  address: string
  name: string
  avatarUrl?: string
  contentImageUrl?: string
  videoUrl?: string
  article?: string
}

function normalizeAddress(addr: string) {
  return addr.toLowerCase()
}

function optionalField(v: string | undefined) {
  const s = v?.trim()
  return s ? s : undefined
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

function rowToEntry(row: SheetRowPayload): SheetServiceEntry | null {
  const address = row.address?.trim()
  const name = row.name?.trim()
  if (!address?.startsWith('0x') || !name) return null
  return {
    name,
    avatarUrl: optionalField(row.avatarUrl),
    contentImageUrl: optionalField(row.contentImageUrl),
    videoUrl: optionalField(row.videoUrl),
    article: optionalField(row.article),
  }
}

export function sheetRowsToMap(csv: string): Record<string, SheetServiceEntry> {
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

  const map: Record<string, SheetServiceEntry> = {}
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    const entry = rowToEntry({
      address: cols[addrIdx] ?? '',
      name: cols[nameIdx] ?? '',
      avatarUrl: avatarIdx >= 0 ? cols[avatarIdx] : undefined,
      contentImageUrl: contentImageIdx >= 0 ? cols[contentImageIdx] : undefined,
      videoUrl: videoIdx >= 0 ? cols[videoIdx] : undefined,
      article: articleIdx >= 0 ? cols[articleIdx] : undefined,
    })
    if (!entry) continue
    map[normalizeAddress(cols[addrIdx]!)] = entry
  }
  return map
}

function sheetJsonRowsToMap(rows: SheetRowPayload[]): Record<string, SheetServiceEntry> {
  const map: Record<string, SheetServiceEntry> = {}
  for (const row of rows) {
    const entry = rowToEntry(row)
    if (!entry) continue
    map[normalizeAddress(row.address)] = entry
  }
  return map
}

/** Live read via Apps Script GET (same URL as write). */
async function fetchSheetMapFromScript(): Promise<Record<string, SheetServiceEntry>> {
  const url = appConfig.demoServicesSheetWriteUrl
  if (!url) return {}

  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`Could not load Google Sheet (script): HTTP ${resp.status}`)
  const json = (await resp.json()) as { ok?: boolean; error?: string; rows?: SheetRowPayload[] }
  if (!json.ok) {
    throw new Error(json.error ?? 'Google Sheet script read failed')
  }
  return sheetJsonRowsToMap(json.rows ?? [])
}

/** Fallback: published CSV (can lag behind edits until re-published). */
async function fetchSheetMapFromCsv(): Promise<Record<string, SheetServiceEntry>> {
  const url = appConfig.demoServicesSheetUrl
  if (!url) return {}

  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`Could not load Google Sheet (csv): HTTP ${resp.status}`)
  return sheetRowsToMap(await resp.text())
}

async function fetchSheetMap(): Promise<Record<string, SheetServiceEntry>> {
  if (appConfig.demoServicesSheetWriteUrl) {
    return fetchSheetMapFromScript()
  }
  return fetchSheetMapFromCsv()
}

export async function getDemoServiceEntry(assetAddress: string): Promise<SheetServiceEntry | null> {
  const map = await fetchSheetMap()
  return map[normalizeAddress(assetAddress)] ?? null
}

/** Append or update a row via Google Apps Script. */
export async function writeDemoServiceToSheet(
  params: CreatorProfileInput & { assetAddress: string },
): Promise<void> {
  const url = appConfig.demoServicesSheetWriteUrl
  if (!url) {
    throw new Error(
      'Missing VITE_DEMO_SERVICES_SHEET_WRITE_URL. Deploy examples/google-apps-script-demo-services-append.gs as a web app and add its URL to .env.anvil.',
    )
  }

  const payload = {
    address: normalizeAddress(params.assetAddress),
    name: params.name.trim(),
    avatarUrl: params.avatarUrl?.trim() ?? '',
    contentImageUrl: params.contentImageUrl?.trim() ?? '',
    videoUrl: params.videoUrl?.trim() ?? '',
    article: params.article?.trim() ?? '',
  }

  const resp = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })

  const text = await resp.text()
  let json: { ok?: boolean; error?: string }
  try {
    json = JSON.parse(text) as { ok?: boolean; error?: string }
  } catch {
    throw new Error(`Google Sheet write failed: ${text.slice(0, 200)}`)
  }
  if (!json.ok) {
    throw new Error(json.error ?? 'Google Sheet write failed')
  }
}
