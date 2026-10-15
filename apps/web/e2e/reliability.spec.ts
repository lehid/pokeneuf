import { findSolution, solutionsFor, type Pokemon } from '@pokeneuf/core';
import { expect, test, type Page } from '@playwright/test';
import { gridOn, memberships, pokemonById } from '../src/node-data';

// Game reliability and accessibility (lot C): focus, two tabs, route changes, corrupted storage.
const DAY = '2026-11-05';
const grid = gridOn(DAY);
const solution = findSolution(grid, memberships) ?? [];
const SETTINGS = '{"version":1,"hideRules":true}';
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
  await expect(page.getByTestId('suggestions').locator('li').first()).toBeVisible();
  await page.getByTestId('guess-input').press('Enter');
  await expect(page.getByTestId('guess-sheet')).toBeHidden();
}

const isFocused = (page: Page, testId: string) =>
  expect(page.getByTestId(testId)).toBeFocused({ timeout: 5000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    window.localStorage.setItem('pokeneuf:v1:settings', settings);
  }, SETTINGS);
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
});

test.describe('focus goes back where it came from (H6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('to the cell, after a move is played', async ({ page }) => {
    await page.getByTestId('cell-0-0').focus();
    await play(page, 0, pokemonById(solution[0] ?? 1).nameFr);
    await isFocused(page, 'cell-0-0');
  });

  test('to the cell, after a wrong move or "Fermer"', async ({ page }) => {
    await page.getByTestId('cell-1-1').focus();
    await play(page, 4, wrongFor(4).nameFr);
    await isFocused(page, 'cell-1-1');

    await page.getByTestId('cell-2-2').click();
    await page.getByRole('button', { name: 'Fermer' }).click();
    await isFocused(page, 'cell-2-2');
  });

  test('to the "Abandonner" button, after "Continuer à jouer"', async ({ page }) => {
    await page.getByTestId('abandon').focus();
    await page.getByTestId('abandon').click();
    await page.getByTestId('abandon-no').click();
    await isFocused(page, 'abandon');
  });

  test('to the header, after a definition is read', async ({ page }) => {
    const header = page.getByTestId(`col-header-${grid.cols[0]}`);
    await header.click();
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(header).toBeFocused();
    await header.click();
    await page.keyboard.press('Escape');
    await expect(header).toBeFocused();
  });

  test('to the result button, after "Voir les solutions"', async ({ page }) => {
    await page.getByTestId('abandon').click();
    await page.getByTestId('abandon-yes').click();
    await page.getByTestId('see-solutions').click();
    await expect(page.getByTestId('end-dialog')).toBeHidden();
    // The focus is somewhere on the page, not lost on <body>.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  });
});

test('the abandon question starts on the safe answer: a double Enter never abandons (M1)', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('abandon').click();
  await isFocused(page, 'abandon-no');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('end-dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-end')).toHaveCount(0); // still playing
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '3');
});

test.describe('two tabs on the same grid (M2)', () => {
  test('a correct answer played in one tab appears in the other, which says so', async ({
    page,
    context,
  }) => {
    await page.goto('./');
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
    await other.goto('./');

    await play(other, 0, pokemonById(solution[0] ?? 1).nameFr);
    await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'filled');
    await expect(page.getByTestId('toast')).toContainText('autre onglet');

    // The stale tab can no longer overwrite it: its own move is played on top of the first.
    await play(page, 1, pokemonById(solution[1] ?? 1).nameFr);
    await page.reload();
    await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'filled');
    await expect(page.getByTestId('cell-0-1')).toHaveAttribute('data-state', 'filled');
  });

  test('errors made in one tab are not refunded by the other', async ({ page, context }) => {
    await page.goto('./');
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
    await other.goto('./');

    await play(other, 0, wrongFor(0).nameFr);
    await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');
    await page.reload();
    await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');
  });

  test('a game lost in one tab shows its result in the other, announced inside the dialog', async ({
    page,
    context,
  }) => {
    await page.goto('./');
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
    await other.goto('./');

    await other.getByTestId('abandon').click();
    await other.getByTestId('abandon-yes').click();
    await expect(other.getByTestId('end-dialog')).toBeVisible();

    const dialog = page.getByTestId('end-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('toast')).toContainText('autre onglet');
    await expect(dialog.getByTestId('score')).toHaveText('0/900');
  });
});

test('the "copied" toast is announced inside the end dialog (M10)', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.goto('./');
  await page.getByTestId('abandon').click();
  await page.getByTestId('abandon-yes').click();
  await page.getByTestId('share').click();
  const toast = page.getByTestId('end-dialog').getByRole('status').getByTestId('toast');
  await expect(toast).toContainText('copié');
});

test.describe('changing page (M11)', () => {
  test('starts at the top with the focus on the heading of the new page', async ({ page }) => {
    await page.goto('./');
    // Not on the first load: the focus is not moved.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');

    await page.getByTestId('footer-faq').scrollIntoViewIfNeeded();
    // On a phone the page scrolls to reach the footer; a desktop window may show it all at once.
    const scrolled = await page.evaluate(() => window.scrollY);
    if (page.viewportSize()?.width === 375) expect(scrolled).toBeGreaterThan(0);
    await page.getByTestId('footer-faq').click();
    await expect(page.locator('h2:focus')).toContainText('Questions fréquentes');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByTestId('back-to-game').click();
    await expect(page.locator('h1:focus')).toBeVisible();
  });
});

test.describe('the page of a tab left open past midnight (LOW)', () => {
  test('offers the new grid at Paris midnight without any focus event, and remembers "Plus tard"', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(`${DAY}T23:59:30+01:00`) });
    await page.goto('./');
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId('new-grid-dialog')).toHaveCount(0);

    await page.clock.fastForward(40_000);
    await expect(page.getByTestId('new-grid-dialog')).toBeVisible();

    await page.getByText('Plus tard').click();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.clock.fastForward(5000);
    await expect(page.getByTestId('new-grid-dialog')).toHaveCount(0);
    await expect(page.getByText('Grille n° 5')).toBeVisible();
  });
});

test.describe('corrupted storage (M3)', () => {
  test('a date that only has the shape of one does not blank the page', async ({ page }) => {
    await page.addInitScript(() => {
      const bad = { gridId: 1, date: '2026-00-01', status: 'won', found: 9, errors: 0, score: 5 };
      window.localStorage.setItem(
        'pokeneuf:v1:history',
        JSON.stringify({ version: 2, entries: [bad] }),
      );
      window.localStorage.setItem(
        'pokeneuf:v1:game:5',
        JSON.stringify({
          version: 2,
          gridId: 5,
          cells: Array(9).fill(null),
          errors: 3,
          status: 'lost',
          finishedOn: '2026-00-01',
          score: 0,
        }),
      );
    });
    await page.goto('./');
    await expect(page.getByTestId('board')).toBeVisible();
    await page.getByTestId('open-stats').click();
    await expect(page.getByTestId('stats-dialog')).toBeVisible();
  });

  test('an archive whose date is not a day does not wait forever', async ({ page }) => {
    await page.goto('./#/archive/2026-11-99');
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByText('Grille n° 5')).toBeVisible();
  });
});

test('the archives link of the footer works in demo mode (LOW)', async ({ page }) => {
  await page.goto('./?demo');
  await expect(page.getByText('Grille de démonstration')).toBeVisible();
  await page.getByTestId('footer-archives').click();
  await expect(page.getByRole('heading', { name: 'Archives' })).toBeVisible();
  await page.getByTestId('back-to-today').click();
  await expect(page.getByText('Grille de démonstration')).toBeVisible();
});

test('the combobox finds a Pokémon by "#0025", "n°25" or "0025" (LOW)', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('cell-0-0').click();
  for (const query of ['#0025', 'n°25', '0025']) {
    await page.getByTestId('guess-input').fill(query);
    await expect(page.getByTestId('suggestion-25')).toBeVisible();
    await expect(page.getByTestId('suggestions').locator('li')).toHaveCount(1);
  }
});

test('fast typing keeps every keystroke (the input is not controlled any more)', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('guess-input').pressSequentially('pikachu', { delay: 0 });
  await expect(page.getByTestId('guess-input')).toHaveValue('pikachu');
  await expect(page.getByTestId('suggestion-25')).toBeVisible();
});
