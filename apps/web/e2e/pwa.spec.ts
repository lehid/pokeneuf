import { APP_NAME } from '@pokeneuf/core';
import { expect, test } from '@playwright/test';

// The one spec that lets the service worker run (the others block it, see playwright.config.ts).
test.use({ serviceWorkers: 'allow' });

const paris = (date: string, time = '12:00') => new Date(`${date}T${time}:00+01:00`);

test('the manifest names the app, stays under the base path and has real icons', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();
  const manifestUrl = new URL(href ?? '', page.url());
  const manifest = await (await request.get(manifestUrl.href)).json();
  const base = new URL(baseURL ?? '').pathname;

  expect(manifest.name).toBe(APP_NAME);
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('fr');
  expect(manifest.start_url).toBe(base);
  expect(manifest.scope).toBe(base);
  const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose ?? 'any');
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const response = await request.get(new URL(icon.src, manifestUrl).href);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('the head has the link preview tags and a static image', async ({ page, request }) => {
  await page.goto('./');
  const content = (selector: string) => page.locator(selector).getAttribute('content');
  expect(await content('meta[property="og:title"]')).toContain(APP_NAME);
  expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image');
  const image = (await content('meta[property="og:image"]')) ?? '';
  expect(await content('meta[name="twitter:image"]')).toBe(image);
  const response = await request.get(new URL(image, page.url()).href);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('after a first visit the app shell opens offline, and no grid is ever cached', async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(paris('2026-11-05'));
  await page.goto('./');
  await expect(page.getByTestId('lives')).toBeVisible();

  // Wait for the worker to be installed, then for it to control this page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await page.reload();

  await context.setOffline(true);
  // `setOffline` does not reach the network requests the service worker itself makes (Playwright
  // limitation): without this, the worker would still fetch the grid and this test could not tell
  // "never cached" from "fetched live". Cut the grid requests of the worker too.
  await context.route('**/grids/**', (route) => route.abort('internetdisconnected'));
  await page.goto('./#/faq');
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeVisible();

  // The game itself needs the grid of the day: offline it says so, instead of showing a stale one.
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((url) => url.includes('/grids/'))).toEqual([]);
  expect(cached.some((url) => url.endsWith('.js'))).toBe(true);
});
