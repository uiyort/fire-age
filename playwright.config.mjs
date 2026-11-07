import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  // The professional view starts unlocked in tests; the lock has its own tests in layout.spec.mjs.
  use: {
    baseURL: 'http://localhost:4173',
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fire-age-pro-v1', value: '1' }] }] },
  },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://localhost:4173', reuseExistingServer: true },
});
