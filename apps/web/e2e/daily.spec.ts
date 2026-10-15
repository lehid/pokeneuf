import { findSolution } from '@pokeneuf/core';
import { expect, test } from '@playwright/test';
import { gridOn, memberships, pokemonById } from '../src/node-data';

const SETTINGS = '{"version":1,"hideRules":true}';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    window.localStorage.setItem('pokeneuf:v1:settings', settings);
  }, SETTINGS);
});

test('loads the grid of the day from the grid folder, revalidated', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+01:00'));
  // Record how the page calls fetch: the grid must be revalidated, never served from a stale cache.
  await page.addInitScript(() => {
    const calls: { url: string; cache: string | undefined }[] = [];
    Object.assign(window, { __fetches: calls });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      calls.push({ url: String(input), cache: init?.cache });
      return original(input, init);
    };
  });
  await page.goto('./');
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByText('Grille n° 5')).toBeVisible();
  const calls = await page.evaluate(
    () => (window as unknown as { __fetches: { url: string; cache?: string }[] }).__fetches,
  );
  expect(calls.map((c) => c.url.split('/').pop())).toEqual(['2026-11-05.json']);
  expect(calls[0]?.cache).toBe('no-cache');
});

test('shows a polite message when there is no grid today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-01-01T12:00:00+01:00'));
  await page.goto('./');
  await expect(page.getByTestId('no-grid')).toHaveText(
    'Pas de grille aujourd’hui, revenez demain.',
  );
  await expect(page.getByTestId('board')).toHaveCount(0);
});

test('before launch day, announces it and offers the demo grid', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00+02:00'));
  await page.goto('./');
  await expect(page.getByTestId('no-grid')).toContainText('1 novembre 2026');
  await page.getByTestId('try-demo').click();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByText('Grille de démonstration')).toBeVisible();
  await page.getByTestId('back-to-today').click();
  await expect(page.getByTestId('no-grid')).toBeVisible();
});

test('offers the new grid when the tab comes back after Paris midnight', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T23:59:00+01:00'));
  await page.goto('./');
  await expect(page.getByText('Grille n° 5')).toBeVisible();
  await page.getByTestId('cell-0-0').click();
  await page.keyboard.press('Escape');

  // Still the same day: nothing happens when the tab regains focus.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('new-grid-dialog')).toHaveCount(0);

  // 00:01 in Paris, next day.
  await page.clock.setFixedTime(new Date('2026-11-06T00:01:00+01:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('new-grid-dialog')).toBeVisible();
  await page.getByText('Jouer la nouvelle grille').click();
  await expect(page.getByText('Grille n° 6')).toBeVisible();
  await expect(page.getByTestId('new-grid-dialog')).toHaveCount(0);
  for (const row of [0, 1, 2]) {
    for (const col of [0, 1, 2]) {
      await expect(page.getByTestId(`cell-${row}-${col}`)).toHaveAttribute('data-state', 'empty');
    }
  }
});

test('the game in progress is kept when the player postpones the new grid', async ({ page }) => {
  const first = findSolution(gridOn('2026-11-05'), memberships)?.[0] ?? 1;
  await page.clock.setFixedTime(new Date('2026-11-05T23:59:00+01:00'));
  await page.goto('./');
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('guess-input').fill(pokemonById(first).nameFr);
  await page.getByTestId('guess-input').press('Enter');
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'filled');

  await page.clock.setFixedTime(new Date('2026-11-06T00:01:00+01:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('Plus tard').click();
  await expect(page.getByText('Grille n° 5')).toBeVisible();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'filled');
});

test.describe('difficulty of the day', () => {
  // The calendar: easy to start the week, hard at the weekend, one very hard grid a week (Sunday).
  const cases: [string, string, RegExp][] = [
    ['2026-11-02', 'Monday', /^(Très facile|Facile)$/],
    ['2026-11-03', 'Tuesday', /^Facile$/],
    ['2026-11-05', 'Thursday', /^Intermédiaire$/],
    ['2026-11-07', 'Saturday', /^Difficile$/],
    ['2026-11-08', 'Sunday', /^Très difficile$/],
  ];
  for (const [date, day, name] of cases) {
    test(`${day} ${date} is announced on the grid page`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`${date}T12:00:00+01:00`));
      await page.goto('./');
      const badge = page.getByTestId('difficulty');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('Difficulté');
      const label = (await badge.getByTestId('difficulty-text').textContent()) ?? '';
      expect(
        label.replace(/^Difficulté de la grille : /, '').replace(/ \(\d sur 5\)$/, ''),
      ).toMatch(name);
    });
  }

  test('a very hard grid fills all five squares, an easy one fewer', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
    await page.goto('./');
    await expect(page.getByTestId('difficulty')).toHaveAttribute('data-level', 'veryHard');
    await expect(page.getByTestId('difficulty-text')).toHaveText(/5 sur 5/);
    await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+01:00'));
    await page.goto('./');
    await expect(page.getByTestId('difficulty')).toHaveAttribute('data-level', 'easy');
    await expect(page.getByTestId('difficulty-text')).toHaveText(/2 sur 5/);
  });
});
