import { CATEGORIES } from '@pokeneuf/core';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { missingLegalFields } from '../src/content/legal';

const paris = (date: string, time = '12:00') => new Date(`${date}T${time}:00+01:00`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
  await page.clock.setFixedTime(paris('2026-11-05'));
});

test('the footer leads to the FAQ, the changelog and the legal notices, and back to the game', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('lives')).toBeVisible();
  await expect(page.getByText(/non affilié/)).toBeVisible();

  await page.getByTestId('footer-faq').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeVisible();
  await expect(page).toHaveTitle(/Questions fréquentes · /);
  await page.getByTestId('back-to-game').click();
  await expect(page.getByTestId('lives')).toBeVisible();

  await page.getByTestId('footer-changelog').click();
  await expect(page.getByRole('heading', { level: 3, name: /Version 1\.0/ })).toBeVisible();
  await page.getByTestId('footer-legal').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Mentions légales' })).toBeVisible();
  await expect(page.getByText(/GitHub Pages/)).toBeVisible();
  await expect(page.getByText(/non affilié/)).toBeVisible();
});

test('the FAQ defines every category of the registry', async ({ page }) => {
  await page.goto('./#/faq');
  await page.getByTestId('faq-categories').locator('summary').click();
  await expect(page.locator('[data-category]')).toHaveCount(CATEGORIES.length);
  await expect(page.locator('[data-category="type-fire"]')).toContainText('Type Feu');
});

test('a FAQ section opens with the keyboard', async ({ page }) => {
  await page.goto('./#/faq');
  const score = page.getByTestId('faq-score');
  await expect(score).not.toHaveAttribute('open', '');
  await score.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(score).toHaveAttribute('open', '');
  await expect(score).toContainText('Légende : à partir de 850 points');
});

test('the legal notices flag what the owner still has to provide', async ({ page }) => {
  await page.goto('./#/legal');
  await expect(page.getByTestId(/^legal-todo-/)).toHaveCount(missingLegalFields().length);
});

test('an info page survives a reload', async ({ page }) => {
  await page.goto('./#/changelog');
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Nouveautés' })).toBeVisible();
});

for (const hash of ['#/faq', '#/changelog', '#/legal']) {
  test(`${hash} fits a phone screen and has one h1`, async ({ page }) => {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('the 404 page sends a known path to its hash route, and says so for an unknown one', async ({
  page,
  baseURL,
}) => {
  const notFound = readFileSync(fileURLToPath(new URL('../dist/404.html', import.meta.url)));
  // What GitHub Pages does: answer an unknown path with 404.html and a 404 status.
  await page.route(/\/(faq|nope)$/, (route) =>
    route.fulfill({ status: 404, contentType: 'text/html', body: notFound }),
  );

  await page.goto(new URL('faq', baseURL).href);
  await expect(page).toHaveURL(/#\/faq$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeVisible();

  await page.goto(new URL('nope', baseURL).href);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await page.getByRole('link', { name: /Retour à/ }).click();
  await expect(page.getByTestId('lives')).toBeVisible();
});
