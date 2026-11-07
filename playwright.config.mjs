import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://localhost:4173', reuseExistingServer: true },
});
