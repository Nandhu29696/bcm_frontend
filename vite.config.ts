import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The backend does not always run on 8000 — another service may already hold
  // that port. Proxying to a port owned by a different application fails in the
  // most confusing way possible: requests succeed, and return someone else's
  // data. Set VITE_API_TARGET in `.env.local` to point at your own backend.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    build: {
      // Vendor code in its own long-lived chunks: an application release does
      // not make every returning browser re-download React (Phase 10.2).
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
            if (id.includes('@tanstack')) return 'tanstack'
            return 'vendor'
          },
        },
      },
    },
    server: {
      port: 5173,
      // Proxy the API in development so the browser sees one origin and CORS and
      // cookie handling behave the same as they will behind a reverse proxy.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/media': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
