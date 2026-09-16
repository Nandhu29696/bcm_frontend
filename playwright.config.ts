import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (Phase 2.7).
 *
 * These need both servers running and a seeded database. They are NOT part of
 * `npm test` for that reason — an E2E suite that silently passes because it
 * never reached a real backend is worse than none.
 *
 *   Terminal 1:  python manage.py runserver 8002
 *   Terminal 2:  npm run dev            (VITE_API_TARGET must match)
 *   Terminal 3:  npm run e2e
 *
 * `webServer` starts Vite automatically; the Django backend is assumed to be up
 * already, because starting it here would hide the difference between "the app
 * is broken" and "the backend is not running".
 */
/** Its own port, so an already-running dev server is never reused. */
const E2E_PORT = Number(process.env.E2E_PORT || 5174)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Vite directly, not `npm run dev`: on Windows npm's grandchild process
    // outlives the run and the next one fails with "port already used".
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    // Deliberately NOT reusing whatever is on the default port. A dev server
    // started before a change to `vite.config.ts` keeps the old proxy target, so
    // reuse can point the whole suite at a different application — which fails
    // as a generic "something went wrong" on the login screen rather than as a
    // configuration error. `--strictPort` makes a clash loud instead of silent.
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
