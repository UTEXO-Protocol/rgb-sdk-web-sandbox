import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.RGB_SANDBOX_REGTEST === '1' ? '**/regtest.spec.mjs' : '**/onchain.spec.mjs',
  timeout: 60_000,
  workers: 1,
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'dev', use: { baseURL: 'http://127.0.0.1:5193' } },
    { name: 'production', use: { baseURL: 'http://127.0.0.1:5194' } },
  ],
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort', url: 'http://127.0.0.1:5193', reuseExistingServer: false },
    { command: 'npm run preview -- --host 127.0.0.1 --port 5194 --strictPort', url: 'http://127.0.0.1:5194', reuseExistingServer: false },
  ],
});
