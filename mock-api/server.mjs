/**
 * Mock API for local development: subscription-gated “content URL” responses.
 *
 * Checks subscription status via the Ponder indexer, then returns a demo URL
 * only for active subscribers. Asset names and URL paths come from the SDK
 * deployments file written by `local-demo-seed.sh` (`registries_<chainId>.json`).
 *
 * Usage:
 *   node mock-api/server.mjs
 *
 * Env:
 *   MOCK_API_PORT        (default 4100)
 *   INDEXER_URL          (default http://localhost:42069/graphql)
 *   SUBSCRIBER_ID        (default "demo" — matches DEMO_SUBSCRIBER_ID in the frontend)
 *   CHAIN_ID             (default 31337)
 */

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { encodeAbiParameters, keccak256 } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

const PORT = Number(process.env.MOCK_API_PORT) || 4100
const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:42069/graphql'
const SUBSCRIBER_ID = process.env.SUBSCRIBER_ID || 'demo'
const CHAIN_ID = process.env.CHAIN_ID || '31337'

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
// Resolve name + gated URL from deployments only
// ---------------------------------------------------------------------------

/**
 * Reads deployed asset addresses from the SDK deployments JSON
 * (written by local-demo-seed.sh). Returns a map of lowercase address → metadata.
 */
function loadDeployedAssets() {
  const deploymentsFile = join(
    ROOT_DIR, 'open-creator-rails.sdk', 'open-creator-rails', 'deployments', `registries_${CHAIN_ID}.json`
  )
  const map = new Map()

  if (existsSync(deploymentsFile)) {
    const registries = JSON.parse(readFileSync(deploymentsFile, 'utf-8'))
    for (const registry of registries) {
      for (const asset of registry.assets ?? []) {
        map.set(asset.address.toLowerCase(), {
          assetId: asset.assetId,
          assetIdHash: asset.assetIdHash,
          subscriptionPrice: asset.subscriptionPrice,
          name: getServiceName(asset.assetId),
        })
      }
    }
  }

  return map
}

function getServiceNameForAddress(assetAddress) {
  const key = assetAddress.toLowerCase()
  const deployed = loadDeployedAssets()
  const meta = deployed.get(key)
  return meta?.name ?? `Service ${key.slice(0, 10)}`
}

function getGatedContent(assetAddress) {
  const key = assetAddress.toLowerCase()
  const deployed = loadDeployedAssets()
  const meta = deployed.get(key)
  if (meta?.assetId) {
    return {
      name: meta.name,
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

async function checkSubscription(assetAddress, userAddress) {
  const subHash = subscriberHash(SUBSCRIBER_ID, userAddress)

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
    console.error(`Indexer responded ${resp.status}`)
    return false
  }

  const json = await resp.json()
  const items = json?.data?.subscriptions?.items ?? []

  if (items.length === 0) return false

  const sub = items[0]
  if (sub.isRevoked) return false

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  return BigInt(sub.endTime) > nowSeconds
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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

  // GET /api/assets — lists assets from deployments file
  if (url.pathname === '/api/assets' && req.method === 'GET') {
    const deployed = loadDeployedAssets()
    const assets = []
    for (const [addr, meta] of deployed) {
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

  // GET /api/health
  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, indexerUrl: INDEXER_URL, chainId: CHAIN_ID })
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  const deployed = loadDeployedAssets()
  console.log(`Mock API running at http://localhost:${PORT}`)
  console.log(`  GET /api/gated-urls?assetAddress=0x...&user=0x...`)
  console.log(`  GET /api/assets`)
  console.log(`  GET /api/health`)
  console.log(``)
  console.log(`  Indexer:       ${INDEXER_URL}`)
  console.log(`  Chain ID:      ${CHAIN_ID}`)
  console.log(`  Subscriber ID: "${SUBSCRIBER_ID}"`)
  console.log(`  Known assets:  ${deployed.size} (from deployments/registries_${CHAIN_ID}.json)`)
  if (deployed.size > 0) {
    for (const [addr, meta] of deployed) {
      console.log(`    ${addr} (${meta.assetId})`)
    }
  }
})
