import { defineConfig, devices } from '@playwright/test';

/** Admin e2e – needs `npm run dev` here (3001) and the website (3000) for the preview test. */
export default defineConfig({
  testDir: './tests/e2e', timeout: 30_000, workers: 1, reporter: [['list']],
  use: { baseURL: process.env.ADMIN_URL ?? 'http://localhost:3001', reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
