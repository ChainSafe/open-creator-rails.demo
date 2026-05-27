/**
 * Mock API for local development: subscription-gated “content URL” responses.
 *
 * Checks subscription status via the Ponder indexer, then returns a demo URL
 * only for active subscribers. Asset names and URL paths come from the SDK
 * deployments file written by `local-demo-seed.sh` (`registries_<chainId>.json`),
 * plus optional `services.json`: **asset contract address (lowercase) → { name, url }**
 *   written by `POST /api/register-service` (Creator Console).
 *
 * Usage:
 *   node mock-api/server.mjs
 *
 * Env:
 *   MOCK_API_PORT        (default 4100)
 *   INDEXER_URL          (default http://localhost:42069/graphql)
 *   RPC_URL              (default http://127.0.0.1:8545) — on-chain fallback when indexer lags
 *   SUBSCRIBER_ID        (default "demo" — matches DEMO_SUBSCRIBER_ID in the frontend)
 *   CHAIN_ID             (default 31337)
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData, keccak256 } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

const PORT = Number(process.env.MOCK_API_PORT) || 4100
const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:42069/graphql'
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545'
const SUBSCRIBER_ID = process.env.SUBSCRIBER_ID || 'demo'
const CHAIN_ID = process.env.CHAIN_ID || '31337'

const ASSET_IS_SUBSCRIPTION_ACTIVE_ABI = [
  {
    type: 'function',
    name: 'isSubscriptionActive',
    stateMutability: 'view',
    inputs: [{ name: 'subscriber', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
]

// ---------------------------------------------------------------------------
// Demo labels for seeded assets (matches `assetId` in deployments JSON)
// ---------------------------------------------------------------------------

const DEFAULT_SERVICE_NAMES = {
  demo_asset_1: 'WeatherPro API',
  demo_asset_2: 'SentimentIQ Analytics',
  demo_asset_3: 'GeoRoute Navigator',
}

function getServiceName(assetId) {
  return DEFAULT_SERVICE_NAMES[assetId] ?? `Service ${assetId}`
}

// ---------------------------------------------------------------------------
// Optional runtime registry (Creator Console → POST /api/register-service)
// ---------------------------------------------------------------------------

const SERVICES_FILE = join(__dirname, 'services.json')

let _servicesByAssetAddress = {}

/** Normalize persisted map: keys = lowercase asset address, values = { name, url } only. */
function normalizeServicesFileShape(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [addr, v] of Object.entries(raw)) {
    if (!addr.startsWith('0x')) continue
    if (!v || typeof v !== 'object') continue
    const name = v.name
    const url = v.url ?? v.endpointUrl
    if (typeof name !== 'string' || typeof url !== 'string') continue
    out[addr.toLowerCase()] = { name, url }
  }
  return out
}

try {
  if (existsSync(SERVICES_FILE)) {
    _servicesByAssetAddress = normalizeServicesFileShape(JSON.parse(readFileSync(SERVICES_FILE, 'utf-8')))
  }
} catch (err) {
  console.warn('[services] Could not read services.json, starting empty:', err.message)
}

function loadServicesByAssetAddress() {
  return _servicesByAssetAddress
}

function saveServicesByAssetAddress(map) {
  _servicesByAssetAddress = map
  try {
    writeFileSync(SERVICES_FILE, JSON.stringify(map, null, 2) + '\n')
  } catch (err) {
    console.warn('[services] Could not persist services.json (in-memory only):', err.message)
  }
}

/** Persist API name + URL for one Asset contract address (lowercase key in `services.json`). */
function registerApiByAssetAddress(assetAddress, name, url) {
  const key = assetAddress.toLowerCase()
  const map = { ...loadServicesByAssetAddress(), [key]: { name, url } }
  saveServicesByAssetAddress(map)
}

// ---------------------------------------------------------------------------
// Per–asset-address metadata (deployments + address-keyed services.json)
// ---------------------------------------------------------------------------

/**
 * `Map<lowercase asset contract address, row>` — deployment row plus optional name/url overlay
 * from `services.json` (same address key).
 */
function buildAssetMetadataByAddress() {
  const deploymentsFile = join(
    ROOT_DIR, 'open-creator-rails.sdk', 'open-creator-rails', 'deployments', `registries_${CHAIN_ID}.json`
  )
  const byAddress = new Map()

  if (existsSync(deploymentsFile)) {
    const registries = JSON.parse(readFileSync(deploymentsFile, 'utf-8'))
    for (const registry of registries) {
      for (const asset of registry.assets ?? []) {
        const addr = asset.address.toLowerCase()
        byAddress.set(addr, {
          assetId: asset.assetId,
          assetIdHash: asset.assetIdHash,
          subscriptionPrice: asset.subscriptionPrice,
          name: getServiceName(asset.assetId),
          url: undefined,
        })
      }
    }
  }

  for (const [addr, overlay] of Object.entries(loadServicesByAssetAddress())) {
    const existing = byAddress.get(addr) ?? {
      assetId: null,
      assetIdHash: null,
      subscriptionPrice: null,
      name: overlay.name,
      url: undefined,
    }
    existing.name = overlay.name
    existing.url = overlay.url
    byAddress.set(addr, existing)
  }

  return byAddress
}

function getServiceNameForAddress(assetAddress) {
  const key = assetAddress.toLowerCase()
  const meta = buildAssetMetadataByAddress().get(key)
  return meta?.name ?? `Service ${key.slice(0, 10)}`
}

/** Gated response for subscribers: name + URL for this asset contract address. */
function getGatedContent(assetAddress) {
  const key = assetAddress.toLowerCase()
  const meta = buildAssetMetadataByAddress().get(key)
  if (meta?.url) {
    return { name: meta.name ?? 'Service', url: meta.url }
  }
  if (meta?.assetId) {
    return {
      name: meta.name ?? 'Service',
      url: `https://api.mock-service.local/v1/${meta.assetId}`,
    }
  }

  return {
    name: `Service ${key.slice(0, 10)}`,
    url: `https://api.mock-service.local/v1/asset-${key.slice(2, 10)}`,
  }
}

// ---------------------------------------------------------------------------
// Subscription check via indexer
// ---------------------------------------------------------------------------

function subscriberHash(subscriberId, userAddress) {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'address' }],
      [subscriberId, userAddress],
    ),
  )
}

async function isSubscriptionActiveOnchain(assetAddress, subscriberBytes32) {
  try {
    const data = encodeFunctionData({
      abi: ASSET_IS_SUBSCRIPTION_ACTIVE_ABI,
      functionName: 'isSubscriptionActive',
      args: [subscriberBytes32],
    })
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: assetAddress, data }, 'latest'],
      }),
    })
    if (!res.ok) return false
    const json = await res.json()
    if (json.error) return false
    const raw = json.result
    if (!raw || raw === '0x') return false
    return decodeFunctionResult({
      abi: ASSET_IS_SUBSCRIPTION_ACTIVE_ABI,
      functionName: 'isSubscriptionActive',
      data: raw,
    })
  } catch {
    return false
  }
}

async function checkSubscription(assetAddress, userAddress) {
  const subHash = subscriberHash(SUBSCRIBER_ID, userAddress)

  let indexerSaysActive = false

  try {
    const query = `
    query CheckSubscription($assetAddress: String!, $subscriber: String!) {
      subscriptions(
        where: { assetId_contains: $assetAddress, subscriber: $subscriber }
        limit: 1
      ) {
        items {
          id
          endTime
          isRevoked
        }
      }
    }
  `

    const resp = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          assetAddress: assetAddress.toLowerCase(),
          subscriber: subHash,
        },
      }),
    })

    if (!resp.ok) {
      console.warn(`[subscription] indexer HTTP ${resp.status}, using RPC fallback`)
    } else {
      const json = await resp.json()
      if (json.errors?.length) {
        console.warn('[subscription] indexer GraphQL error, using RPC fallback:', json.errors[0]?.message)
      } else {
        const items = json?.data?.subscriptions?.items ?? []
        if (items.length > 0) {
          const sub = items[0]
          const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
          if (!sub.isRevoked && BigInt(sub.endTime) > nowSeconds) indexerSaysActive = true
        }
      }
    }
  } catch (e) {
    console.warn('[subscription] indexer request failed, using RPC fallback:', e?.message ?? e)
  }

  if (indexerSaysActive) return true
  return isSubscriptionActiveOnchain(assetAddress, subHash)
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // GET /api/gated-urls?assetAddress=0x...&user=0x...
  if (url.pathname === '/api/gated-urls' && req.method === 'GET') {
    const assetAddress = url.searchParams.get('assetAddress')
    const user = url.searchParams.get('user')

    if (!assetAddress || !user) {
      return json(res, 400, { error: 'Missing assetAddress or user query param' })
    }

    try {
      const isActive = await checkSubscription(assetAddress, user)

      if (!isActive) {
        return json(res, 403, { error: 'Not subscribed', name: null, url: null })
      }

      const content = getGatedContent(assetAddress)
      return json(res, 200, content)
    } catch (err) {
      console.error('Error checking subscription:', err)
      return json(res, 500, { error: 'Internal error' })
    }
  }

  // GET /api/assets — lists merged metadata by asset contract address
  if (url.pathname === '/api/assets' && req.method === 'GET') {
    const byAddress = buildAssetMetadataByAddress()
    const assets = []
    for (const [addr, meta] of byAddress) {
      assets.push({ address: addr, ...meta })
    }
    return json(res, 200, { assets })
  }

  // GET /api/asset-name?assetAddress=0x... — returns the service name and endpoint URL (public)
  if (url.pathname === '/api/asset-name' && req.method === 'GET') {
    const assetAddress = url.searchParams.get('assetAddress')
    if (!assetAddress) {
      return json(res, 400, { error: 'Missing assetAddress query param' })
    }
    const { name, url: endpointUrl } = getGatedContent(assetAddress)
    return json(res, 200, { name, endpointUrl })
  }

  // POST /api/register-service — body: { assetAddress, name, endpointUrl } (optional assetIdHash for logs only)
  if (url.pathname === '/api/register-service' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const parsed = JSON.parse(body)
      const { assetAddress, name, endpointUrl, assetIdHash } = parsed
      if (!assetAddress || !name || !endpointUrl) {
        return json(res, 400, {
          error: 'Missing assetAddress, name, or endpointUrl',
        })
      }
      registerApiByAssetAddress(assetAddress, name, endpointUrl)
      const addr = assetAddress.toLowerCase()
      const logSuffix = assetIdHash ? ` assetIdHash=${assetIdHash}` : ''
      console.log(`[register-service] ${addr} name="${name}" url=${endpointUrl}${logSuffix}`)
      return json(res, 200, { ok: true, assetAddress: addr, name, endpointUrl })
    } catch {
      return json(res, 400, { error: 'Invalid JSON body' })
    }
  }

  // GET /api/health
  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, indexerUrl: INDEXER_URL, rpcUrl: RPC_URL, chainId: CHAIN_ID })
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  const byAddress = buildAssetMetadataByAddress()
  console.log(`Mock API running at http://localhost:${PORT}`)
  console.log(`  GET /api/gated-urls?assetAddress=0x...&user=0x...`)
  console.log(`  GET /api/assets`)
  console.log(`  POST /api/register-service`)
  console.log(`  GET /api/health`)
  console.log(``)
  console.log(`  Indexer:       ${INDEXER_URL}`)
  console.log(`  RPC (fallback): ${RPC_URL}`)
  console.log(`  Chain ID:      ${CHAIN_ID}`)
  console.log(`  Subscriber ID: "${SUBSCRIBER_ID}"`)
  console.log(`  Known assets:  ${byAddress.size} (deployments + services.json, keyed by asset address)`)
  if (byAddress.size > 0) {
    for (const [addr, meta] of byAddress) {
      const label = meta.assetId ?? meta.assetIdHash ?? '—'
      console.log(`    ${addr} (${label})`)
    }
  }
})
