import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Locally the sandbox ships its own Chromium; CI installs one with `playwright install`.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;
const PORT = 4173;
// The site is served under a base path on GitHub Pages (/<repo>/) and at the root on a custom domain.
const BASE = process.env.E2E_BASE ?? '/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    // The service worker (production build) would answer requests that tests mock or time-travel;
    // `pwa.spec.ts` turns it back on.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 667 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // CI has just built the app (at the root) in an earlier step; any other base needs its own build.
    command: `${process.env.CI && BASE === '/' ? '' : 'pnpm build && '}pnpm exec vite preview --port ${PORT} --strictPort`,
    env: { VITE_BASE: BASE },
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
