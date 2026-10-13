import { findSolution, solutionsFor, type Pokemon } from '@pokeneuf/core';
import { expect, test, type Page } from '@playwright/test';
import { demoGrid, memberships, pokemonById } from '../src/node-data';

const solution = findSolution(demoGrid, memberships) ?? [];
const name = (id: number): string => pokemonById(id).nameFr;

/** A Pokémon that fits neither the row nor the column of a cell. */
function wrongFor(cell: number): Pokemon {
  const ok = new Set(solutionsFor(demoGrid, memberships, cell));
  const found = [1, 25, 133, 150, 151, 249].map(pokemonById).find((p) => !ok.has(p.id));
  if (!found) throw new Error('no wrong Pokémon');
  return found;
}

const testId = (cell: number): string => `cell-${Math.floor(cell / 3)}-${cell % 3}`;

async function play(page: Page, cell: number, pokemon: string): Promise<void> {
  await page.getByTestId(testId(cell)).click();
  await page.getByTestId('guess-input').fill(pokemon);
  await page.getByTestId('guess-input').press('Enter');
}

test.beforeEach(async ({ page }) => {
  // Skip the rules popup except in the test about it.
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('pokeneuf:v1:settings') && !window.name.includes('rules')) {
      window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
    }
  });
  await page.goto('/');
});

test('won game: nine correct answers, end screen, solutions', async ({ page }) => {
  for (const [cell, id] of solution.entries()) await play(page, cell, name(id));
  await expect(page.getByTestId('end-dialog')).toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('1035');
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '3');

  await page.getByTestId('see-solutions').click();
  await expect(page.getByTestId('end-dialog')).toBeHidden();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('solutions-dialog')).toBeVisible();
  await expect(page.getByTestId('solutions-dialog').locator('li')).toHaveCount(
    demoGrid.cellSizes[0] ?? -1,
  );
});

test('lost game: three wrong answers end the game', async ({ page }) => {
  const wrong = wrongFor(0);
  await play(page, 0, wrong.nameFr);
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'empty');
  await play(page, 0, wrong.nameFr);
  await play(page, 0, wrong.nameFr);
  await expect(page.getByTestId('end-dialog')).toBeVisible();
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '0');
  await expect(page.getByTestId('score')).toHaveText('0');
});

test('abandon asks for confirmation first', async ({ page }) => {
  await page.getByTestId('abandon').click();
  await expect(page.getByText('Voulez-vous vraiment abandonner ?')).toBeVisible();
  await page.getByText('Continuer à jouer').click();
  await expect(page.getByTestId('end-dialog')).toBeHidden();

  await page.getByTestId('abandon').click();
  await page.getByText('Oui, abandonner').click();
  await expect(page.getByTestId('end-dialog')).toBeVisible();
  await page.getByTestId('see-solutions').click();
  await page.getByTestId('cell-2-2').click();
  await expect(page.getByTestId('solutions-dialog')).toBeVisible();
});

test('a game in progress survives a refresh', async ({ page }) => {
  await play(page, 0, name(solution[0] ?? 1));
  await play(page, 1, wrongFor(1).nameFr);
  await page.reload();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-state', 'filled');
  await expect(page.getByTestId('cell-0-0')).toContainText(name(solution[0] ?? 1));
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');
  await expect(page.getByTestId('rules-dialog')).toHaveCount(0);
});

test('a Pokémon already placed is greyed out and cannot be played again', async ({ page }) => {
  const first = solution[0] ?? 1;
  await play(page, 0, name(first));
  await page.getByTestId(testId(1)).click();
  await page.getByTestId('guess-input').fill(name(first));
  const item = page.getByTestId(`suggestion-${first}`);
  await expect(item).toHaveAttribute('data-disabled', 'true');
  await item.click({ force: true });
  await page.getByTestId('guess-input').press('Enter');
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '3');
  await expect(page.getByTestId('guess-sheet')).toBeVisible();
});

test('the combobox works with the keyboard and shows names, numbers and types', async ({
  page,
}) => {
  const id = solution[0] ?? 1;
  const p = pokemonById(id);
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('guess-input').fill(String(id));
  const item = page.getByTestId(`suggestion-${id}`);
  await expect(item).toContainText(p.nameFr);
  await expect(item).toContainText(p.nameEn);
  await expect(item).toContainText(`#${String(id).padStart(3, '0')}`);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guess-sheet')).toBeHidden();
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '3');
});

test('a header explains its category', async ({ page }) => {
  await page.getByTestId(`col-header-${demoGrid.cols[0]}`).click();
  await expect(page.getByText('Définition')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Définition')).toBeHidden();
});

test.describe('rules', () => {
  test('shown on first launch, hidden for good after "Ne plus afficher"', async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.name = 'rules';
    });
    await page.reload();
    await expect(page.getByTestId('rules-dialog')).toBeVisible();
    await page.getByLabel('Ne plus afficher').check();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect(page.getByTestId('rules-dialog')).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('rules-dialog')).toHaveCount(0);
  });
});

test('no horizontal scroll', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
