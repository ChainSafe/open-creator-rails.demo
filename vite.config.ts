import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Linked `file:` SDK: pre-bundling can cache an incomplete export surface (`export *` + star re-exports).
  optimizeDeps: {
    exclude: ['@open-creator-rails/sdk'],
  },
})
