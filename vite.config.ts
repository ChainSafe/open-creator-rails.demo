import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const x402Target = env.VITE_X402_FACILITATOR_URL?.trim().replace(/\/$/, '')

  return {
    plugins: [react()],
    // Linked `file:` SDK: pre-bundling can cache an incomplete export surface (`export *` + star re-exports).
    optimizeDeps: {
      exclude: ['@open-creator-rails/sdk'],
    },
    server: x402Target
      ? {
          proxy: {
            '/api/x402': {
              target: x402Target,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/x402/, ''),
            },
          },
        }
      : undefined,
  }
})
