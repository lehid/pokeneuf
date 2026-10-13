import { findSolution, solutionsFor, type Pokemon } from '@pokeneuf/core';
import { expect, test, type Page } from '@playwright/test';
import { gridOn, memberships, pokemonById } from '../src/node-data';

const DAY = '2026-11-05';
const grid = gridOn(DAY);
const solution = findSolution(grid, memberships) ?? [];
const cellId = (cell: number): string => `cell-${Math.floor(cell / 3)}-${cell % 3}`;

function wrongFor(cell: number): Pokemon {
  const ok = new Set(solutionsFor(grid, memberships, cell));
  const found = [1, 25, 133, 150, 151, 249].map(pokemonById).find((p) => !ok.has(p.id));
  if (!found) throw new Error('no wrong Pokémon');
  return found;
}

async function play(page: Page, cell: number, name: string): Promise<void> {
  await page.getByTestId(cellId(cell)).click();
  await page.getByTestId('guess-input').fill(name);
  await page.getByTestId('guess-input').press('Enter');
}

async function lose(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await play(page, 0, wrongFor(0).nameFr);
  await expect(page.getByTestId('end-dialog')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
  await page.goto('./');
});

test('every found answer carries its estimated rarity, and the header score follows', async ({
  page,
}) => {
  await expect(page.getByTestId('header-score')).toHaveAttribute('data-score', '0');
  await play(page, 0, pokemonById(solution[0] ?? 1).nameFr);
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute(
    'data-tier',
    /^(common|uncommon|rare|veryRare)$/,
  );
  await expect(page.getByTestId('cell-0-0')).toContainText(/Commun|Peu commun|Rare|Très rare/);
  const score = Number(await page.getByTestId('header-score').getAttribute('data-score'));
  expect(score).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('legend')).toContainText('Rareté estimée');
});

test('the end screen shows the score out of 900 and the rarest answer; solutions are sorted', async ({
  page,
}) => {
  for (const [cell, id] of solution.entries()) await play(page, cell, pokemonById(id).nameFr);
  const dialog = page.getByTestId('end-dialog');
  await expect(dialog.getByTestId('score')).toHaveText(/^\d+\/900$/);
  await expect(dialog.getByTestId('rarest')).toContainText('Réponse la plus rare');
  await expect(dialog.getByTestId('title')).toContainText(
    /Titre : (Curieux|Dresseur|Expert|Champion|Légende)/,
  );

  await page.getByTestId('see-solutions').click();
  await page.getByTestId('cell-1-1').click();
  const tiers = await page
    .getByTestId('solutions-dialog')
    .locator('[data-tier]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tier')));
  const order = ['common', 'uncommon', 'rare', 'veryRare'];
  const indexes = tiers.map((t) => order.indexOf(t ?? ''));
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  expect(tiers[0]).toBe('common');
  expect(tiers.at(-1)).toBe('veryRare');
});

test('sharing copies a spoiler-free text and says so', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Desktop browsers have no share sheet in this setup: force the clipboard path.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.reload();
  await lose(page);
  await page.getByTestId('share').click();
  await expect(page.getByTestId('toast')).toContainText('copié');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const lines = text.split('\n');
  expect(lines[0]).toMatch(/^PokéNeuf #5 — 0\/900 🔥 1$/);
  expect(lines.slice(1, 4)).toEqual(['❌❌❌', '❌❌❌', '❌❌❌']);
  expect(lines[4]).toMatch(/^http/);
  expect(text).not.toMatch(new RegExp(pokemonById(wrongFor(0).id).nameFr, 'i'));
});

test('the streak and the stats grow day after day, and an empty day breaks the streak', async ({
  page,
}) => {
  await lose(page);

  // Next day: a new grid, the streak of the day before is alive.
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+01:00'));
  await page.goto('./');
  await expect(page.getByText('Grille n° 6')).toBeVisible();
  await expect(page.getByTestId('streak')).toContainText('1 jour');
  await lose(page);
  await expect(page.getByTestId('streak')).toContainText('2 jours');

  await page.getByTestId('open-stats-end').click();
  const stats = page.getByTestId('stats-dialog');
  await expect(stats.getByTestId('stat-Parties')).toHaveText('2');
  await expect(stats.getByTestId('stat-Victoires')).toHaveText('0 %');
  await expect(stats.getByTestId('stat-Série')).toHaveText('2');
  await expect(stats.getByTestId('stat-Meilleure série')).toHaveText('2');
  await expect(stats.getByTestId('distribution').locator('li[data-count="2"]')).toHaveCount(1);

  // Two days later without playing in between: the streak is broken.
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  await page.goto('./');
  await expect(page.getByText('Grille n° 9')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveCount(0);
});
