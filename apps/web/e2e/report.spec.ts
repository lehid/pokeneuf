import { ISSUES_URL, REPORT_TEMPLATE } from '@pokeneuf/core';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gridOn } from '../src/node-data';

// Tests only read the `href` of the links: no request to github.com may ever leave the page.
const DAY = '2026-11-05';
const dayGrid = gridOn(DAY);
const HREF_PREFIX = `${ISSUES_URL}/new?template=${REPORT_TEMPLATE}&`;

let githubRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  githubRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.endsWith('github.com')) githubRequests.push(request.url());
  });
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00+01:00`));
  await page.addInitScript(() => {
    window.localStorage.setItem('pokeneuf:v1:settings', '{"version":1,"hideRules":true}');
  });
  await page.goto('./');
});

test.afterEach(() => {
  expect(githubRequests).toEqual([]);
});

async function expectReportLink(link: Locator): Promise<URLSearchParams> {
  await expect(link).toBeVisible();
  await expect(link).toHaveText(/Signaler une erreur/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const href = (await link.getAttribute('href')) ?? '';
  expect(href.startsWith(HREF_PREFIX)).toBe(true);
  return new URL(href).searchParams;
}

async function openSolutions(page: Page, cell: string) {
  await page.getByTestId('abandon').click();
  await page.getByText('Oui, abandonner').click();
  await page.getByTestId('see-solutions').click();
  await page.getByTestId(cell).click();
  await expect(page.getByTestId('solutions-dialog')).toBeVisible();
}

test('the definition dialog links to the pre-filled form, reachable by keyboard', async ({
  page,
}) => {
  const id = dayGrid.rows[0] ?? '';
  await page.getByTestId(`row-header-${id}`).click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  const link = dialog.getByTestId('report-definition');
  const params = await expectReportLink(link);
  expect(params.get('location')).toContain(`(${id})`);
  expect(params.get('grid')).toContain(`n° ${dayGrid.id}`);

  // The focus starts on "Fermer"; one Tab reaches the link, which is inside the dialog.
  await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByTestId(`row-header-${id}`)).toBeFocused();
});

test('the solutions dialog links to the form with the cell and its categories', async ({
  page,
}) => {
  await openSolutions(page, 'cell-1-2');
  const dialog = page.getByTestId('solutions-dialog');
  const params = await expectReportLink(dialog.getByTestId('report-answer'));
  expect(params.get('location')).toContain('Case ligne 2 × colonne 3');
  expect(params.get('grid')).toContain(DAY);
  expect(params.get('kind')).toMatch(/^Une réponse/);

  await dialog.getByTestId('report-answer').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeFocused();
});

test('the FAQ data section links to the form, and the footer does not', async ({ page }) => {
  await expect(page.getByRole('contentinfo').getByText('Signaler une erreur')).toHaveCount(0);
  await page.getByTestId('footer-faq').click();
  await page.getByTestId('faq-data').locator('summary').click();
  await expectReportLink(page.getByTestId('report-faq'));
});
