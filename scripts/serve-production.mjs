/**
 * Production static server: SPA fallback for the React app, but real files for
 * /pet-shop-player/* (Unity WebGL). `serve -s` alone serves index.html for
 * /pet-shop-player and React Router 404s inside the iframe.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const PORT = Number(process.env.PORT) || 3000

const BROTLI_SUFFIXES = [
  { suffix: '.framework.js.br', contentType: 'application/javascript', encoding: 'br' },
  { suffix: '.wasm.br', contentType: 'application/wasm', encoding: 'br' },
  { suffix: '.js.br', contentType: 'application/javascript', encoding: 'br' },
  { suffix: '.data.br', contentType: 'application/octet-stream', encoding: 'br' },
]

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
  for (const entry of BROTLI_SUFFIXES) {
    if (filePath.endsWith(entry.suffix)) return entry
  }
  return null
}

function normalizePathname(pathname) {
  if (pathname === '/pet-shop-player' || pathname === '/pet-shop-player/') {
    return '/pet-shop-player/index.html'
  }
  return pathname
}

function distFilePath(pathname) {
  const relative = pathname.replace(/^\/+/, '')
  if (!relative || relative.includes('..')) return null
  const filePath = join(ROOT, relative)
  if (!filePath.startsWith(ROOT)) return null
  if (!existsSync(filePath)) return null
  const stat = statSync(filePath)
  if (!stat.isFile()) return null
  return filePath
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`)
    const pathname = normalizePathname(decodeURIComponent(url.pathname))

    const filePath = distFilePath(pathname)
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
      if (pathname.startsWith('/pet-shop-player/')) {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
      res.end(body)
      return
    }

    const spaPath = distFilePath('/index.html')
    if (!spaPath) {
      res.statusCode = 500
      res.end('dist/index.html missing — run pnpm build:pet-shop')
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(await readFile(spaPath))
  } catch (err) {
    res.statusCode = 500
    res.end(err instanceof Error ? err.message : 'Internal error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${ROOT} on http://0.0.0.0:${PORT}`)
})
