/**
 * Production static server: SPA fallback for the React app, but real files for
 * /pet-shop-player/* (Unity WebGL). `serve -s` alone serves index.html for
 * /pet-shop-player and React Router 404s inside the iframe.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const PORT = Number(process.env.PORT) || 3000

const BROTLI_BY_EXT = {
  '.wasm.br': { contentType: 'application/wasm', encoding: 'br' },
  '.js.br': { contentType: 'application/javascript', encoding: 'br' },
  '.data.br': { contentType: 'application/octet-stream', encoding: 'br' },
  '.framework.js.br': { contentType: 'application/javascript', encoding: 'br' },
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
}

function brotliMeta(filePath) {
  for (const [suffix, meta] of Object.entries(BROTLI_BY_EXT)) {
    if (filePath.endsWith(suffix)) return meta
  }
  return null
}

function resolvePath(pathname) {
  if (pathname === '/pet-shop-player' || pathname === '/pet-shop-player/') {
    return '/pet-shop-player/index.html'
  }
  return pathname
}

async function readDist(relativePath) {
  const safe = relativePath.replace(/\.\./g, '')
  const filePath = join(ROOT, safe)
  if (!filePath.startsWith(ROOT)) return null
  if (!existsSync(filePath)) return null
  return filePath
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`)
    let pathname = decodeURIComponent(url.pathname)
    pathname = resolvePath(pathname)

    const filePath = await readDist(pathname)
    if (filePath) {
      const brotli = brotliMeta(filePath)
      const body = await readFile(filePath)
      res.statusCode = 200
      if (brotli) {
        res.setHeader('Content-Type', brotli.contentType)
        res.setHeader('Content-Encoding', brotli.encoding)
      } else {
        const ext = extname(filePath)
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
      }
      if (pathname.includes('/pet-shop-player/')) {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
      res.end(body)
      return
    }

    const spa = await readDist('/index.html')
    if (!spa) {
      res.statusCode = 500
      res.end('dist/index.html missing — run pnpm build:pet-shop')
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(await readFile(spa))
  } catch (err) {
    res.statusCode = 500
    res.end(err instanceof Error ? err.message : 'Internal error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${ROOT} on http://0.0.0.0:${PORT}`)
})
