import { expect, test, type Page } from '@playwright/test';

async function endGame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
  await page.goto('./?demo');
  await page.getByTestId('abandon').click();
  await page.getByRole('button', { name: 'Oui, abandonner' }).click();
  await expect(page.getByTestId('end-dialog')).toBeVisible();
}

const animationOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the end recap fills its gauge and reveals its squares step by step', async ({ page }) => {
    await endGame(page);
    expect(await animationOf(page, '.gauge-fill')).toBe('gauge-fill');
    expect(await animationOf(page, '.result-cell')).toBe('result-cell');
  });
});

test.describe('with prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the end recap stays still', async ({ page }) => {
    await endGame(page);
    expect(await animationOf(page, '.gauge-fill')).toBe('none');
    expect(await animationOf(page, '.result-cell')).toBe('none');
  });
});

test('the end recap fits a phone and shows the picto of the title', async ({ page }) => {
  await endGame(page);
  const dialog = page.getByTestId('end-dialog');
  await expect(dialog.getByTestId('result-grid').locator('span')).toHaveCount(9);
  await expect(dialog.getByTestId('title').locator('svg[data-title="curious"]')).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
});
