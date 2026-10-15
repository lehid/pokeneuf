import { solutionsFor, type Pokemon } from '@pokeneuf/core';
import { expect, test, type Page } from '@playwright/test';
import { gridOn, memberships, pokemonById } from '../src/node-data';

const paris = (date: string, time = '12:00') => new Date(`${date}T${time}:00+01:00`);

function wrongFor(date: string, cell: number): Pokemon {
  const grid = gridOn(date);
  const ok = new Set(solutionsFor(grid, memberships, cell));
  const found = [1, 25, 133, 150, 151, 249].map(pokemonById).find((p) => !ok.has(p.id));
  if (!found) throw new Error('no wrong Pokémon');
  return found;
}

async function play(page: Page, cell: number, name: string): Promise<void> {
  await page.getByTestId(`cell-${Math.floor(cell / 3)}-${cell % 3}`).click();
  await page.getByTestId('guess-input').fill(name);
  // Wait for the suggestion that Enter will play, and for the sheet to be gone: the next click must
  // not land while this sheet is still closing.
  await expect(page.getByTestId('suggestions').locator('li').first()).toBeVisible();
  await page.getByTestId('guess-input').press('Enter');
  await expect(page.getByTestId('guess-sheet')).toBeHidden();
}

/** Three wrong answers: the game is lost, with a score of 0. */
async function lose(page: Page, date: string): Promise<void> {
  for (let i = 0; i < 3; i++) await play(page, 0, wrongFor(date, 0).nameFr);
  await expect(page.getByTestId('end-dialog')).toBeVisible();
}

const row = (page: Page, date: string) => page.getByTestId(`archive-${date}`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
});

test('a daily game finished on its day shows "finished in daily" the next day, with its score', async ({
  page,
}) => {
  await page.clock.setFixedTime(paris('2026-11-05'));
  await page.goto('./');
  await lose(page, '2026-11-05');

  // Past midnight: that grid is now an archive entry, still finished in daily.
  await page.clock.setFixedTime(paris('2026-11-06', '00:05'));
  await page.goto('./#/archives');
  await expect(row(page, '2026-11-05')).toHaveAttribute('data-status', 'dailyDone');
  await expect(row(page, '2026-11-05').getByTestId('status')).toHaveText('Terminée en daily');
  await expect(row(page, '2026-11-05').getByTestId('row-score')).toHaveText('0/900');
  await expect(row(page, '2026-11-06')).toHaveCount(0); // today's grid is the daily one
  await expect(row(page, '2026-11-04')).toHaveAttribute('data-status', 'unplayed');
});

test('a game that runs past midnight is an archive: no stats, no streak', async ({ page }) => {
  await page.clock.setFixedTime(paris('2026-11-05', '23:55'));
  await page.goto('./');
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('guess-input').fill(wrongFor('2026-11-05', 0).nameFr);
  await page.getByTestId('guess-input').press('Enter');
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');

  await page.clock.setFixedTime(paris('2026-11-06', '00:05'));
  await play(page, 0, wrongFor('2026-11-05', 0).nameFr);
  await play(page, 0, wrongFor('2026-11-05', 0).nameFr);
  await expect(page.getByTestId('end-dialog')).toBeVisible();
  await expect(page.getByTestId('archive-note')).toContainText('archive');

  await page.getByTestId('open-stats-end').click();
  await expect(page.getByTestId('stat-Parties')).toHaveText('0');
  await expect(page.getByTestId('stat-Série')).toHaveText('0');

  await page.goto('./#/archives');
  await expect(row(page, '2026-11-05')).toHaveAttribute('data-status', 'archiveDone');
  await expect(row(page, '2026-11-05').getByTestId('status')).toHaveText('Terminée en archive');
});

test('replaying an archive changes neither the stats nor the streak', async ({ page }) => {
  await page.clock.setFixedTime(paris('2026-11-05'));
  await page.goto('./');
  await lose(page, '2026-11-05'); // a daily game: 1 played, a streak of 1

  await page.clock.setFixedTime(paris('2026-11-06'));
  await page.goto('./#/archives');
  await row(page, '2026-11-03').getByTestId('archive-action').click();
  await expect(page.getByText('Grille n° 3')).toBeVisible();
  await expect(page.getByText(/Archive · /)).toBeVisible();
  await lose(page, '2026-11-03');
  await expect(page.getByTestId('archive-note')).toBeVisible();

  await page.goto('./#/archives');
  await expect(row(page, '2026-11-03')).toHaveAttribute('data-status', 'archiveDone');

  // Back to the page of the day: the stats still hold the one daily game.
  await page.goto('./');
  await expect(page.getByTestId('streak')).toContainText('1 jour');
  await page.getByTestId('open-stats').click();
  await expect(page.getByTestId('stat-Parties')).toHaveText('1');
  await expect(page.getByTestId('stat-Série')).toHaveText('1');
});

test('an archive in progress can be resumed, and a finished one can be looked at', async ({
  page,
}) => {
  await page.clock.setFixedTime(paris('2026-11-06'));
  await page.goto('./#/archive/2026-11-02');
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('guess-input').fill(wrongFor('2026-11-02', 0).nameFr);
  await page.getByTestId('guess-input').press('Enter');

  await page.goto('./#/archives');
  await expect(row(page, '2026-11-02')).toHaveAttribute('data-status', 'inProgress');
  await expect(row(page, '2026-11-02').getByTestId('archive-action')).toHaveText('Reprendre');
  await row(page, '2026-11-02').getByTestId('archive-action').click();
  await expect(page.getByTestId('lives')).toHaveAttribute('data-left', '2');
  await play(page, 0, wrongFor('2026-11-02', 0).nameFr);
  await play(page, 0, wrongFor('2026-11-02', 0).nameFr);
  await expect(page.getByTestId('end-dialog')).toBeVisible();

  await page.goto('./#/archives');
  await expect(row(page, '2026-11-02').getByTestId('archive-action')).toHaveText('Voir');
});

test('never offers today or a grid of the future', async ({ page }) => {
  await page.clock.setFixedTime(paris('2026-11-05'));
  await page.goto('./#/archives');
  await expect(page.getByTestId('archive-list').getByRole('listitem')).toHaveCount(4);
  for (const date of ['2026-11-05', '2026-11-08', '2027-01-20']) {
    await page.goto(`./#/archive/${date}`);
    await expect(page.getByTestId('grid-unavailable')).toBeVisible();
    await expect(page.getByTestId('board')).toHaveCount(0);
  }
});

test('paginates the archives, ten by page', async ({ page }) => {
  await page.clock.setFixedTime(paris('2027-01-20')); // 80 days are over
  await page.goto('./#/archives');
  const nav = page.getByTestId('pagination');
  await expect(nav).toHaveAttribute('data-pages', '8');
  await expect(page.getByTestId('archive-list').getByRole('listitem')).toHaveCount(10);
  await expect(page.getByTestId('archive-list').getByRole('listitem').first()).toHaveAttribute(
    'data-testid',
    'archive-2027-01-19',
  );
  await expect(page.getByTestId('previous-page')).toHaveCount(0);

  await page.getByTestId('next-page').click();
  await expect(nav).toHaveAttribute('data-page', '2');
  await expect(page.getByText('Page 2 sur 8')).toBeVisible();
  await expect(page.getByTestId('archive-list').getByRole('listitem').first()).toHaveAttribute(
    'data-testid',
    'archive-2027-01-09',
  );

  await page.getByTestId('previous-page').click();
  await expect(nav).toHaveAttribute('data-page', '1');

  await page.goto('./#/archives?page=8');
  await expect(page.getByTestId('archive-list').getByRole('listitem')).toHaveCount(10);
  await expect(page.getByTestId('next-page')).toHaveCount(0);
  await expect(page.getByTestId('archive-list').getByRole('listitem').last()).toHaveAttribute(
    'data-testid',
    'archive-2026-11-01',
  );
});

test('is reachable from the page of the day and leads back to it', async ({ page }) => {
  await page.clock.setFixedTime(paris('2026-11-05'));
  await page.goto('./');
  await page.getByTestId('open-archives').click();
  await expect(page.getByTestId('archive-list')).toBeVisible();
  await page.getByTestId('back-to-today').click();
  await expect(page.getByTestId('board')).toBeVisible();
});
