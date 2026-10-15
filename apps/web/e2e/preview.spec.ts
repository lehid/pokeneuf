import { expect, test } from '@playwright/test';
import { frPreview } from '../src/i18n/fr';

// The e2e server serves a production build: the review page (development only) must not exist there.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+01:00'));
});

for (const hash of ['#/preview', '#/preview/2026-11-05']) {
  test(`${hash} is the normal page of the day in production`, async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await page.goto(`./${hash}`);
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByText('Grille n° 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: frPreview.title })).toHaveCount(0);
    await expect(page.getByText(frPreview.devOnly)).toHaveCount(0);
    expect(scripts.filter((url) => /preview/i.test(url))).toEqual([]);
  });
}

test('the HTML of the production site does not mention the review page', async ({ page }) => {
  const html = await (await page.request.get('./')).text();
  expect(html).not.toMatch(/preview/i);
});
