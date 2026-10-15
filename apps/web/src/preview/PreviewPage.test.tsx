import {
  hasFlag,
  parseGrid,
  parseReviewed,
  REVIEWED_KEY,
  reviewGrid,
  sortByPopularity,
  getCategory,
  type Grid,
} from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { memberships, pokemonById, popularity } from '../data';
import { frPreview } from '../i18n/fr';
import { memoryStorage } from '../storage';
import { PreviewPage } from './PreviewPage';

// Vitest runs from the package root.
const gridsDir = `${process.cwd()}/public/grids/`;
const readGrid = (date: string): Grid => {
  const grid = parseGrid(JSON.parse(readFileSync(`${gridsDir}${date}.json`, 'utf8')));
  if (!grid) throw new Error(`bad grid ${date}`);
  return grid;
};

/** The first committed grids, served the way the dev server serves `public/grids/`. */
const DATES = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
const grids = DATES.map(readGrid);
const reviews = grids.map((g) => reviewGrid(g, memberships, popularity));

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing test fixture');
  return value;
}
const gridAt = (i: number) => must(grids[i]);
const reviewAt = (i: number) => must(reviews[i]);

function serve(files: Record<string, unknown> = {}): typeof fetch {
  const index = { version: 1, grids: grids.map((g) => ({ id: g.id, date: g.date })) };
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/grids/index.json')) return Response.json(index);
    const date = /grids\/(\d{4}-\d{2}-\d{2})\.json$/.exec(url)?.[1];
    const grid = grids.find((g) => g.date === date);
    if (date && date in files) return Response.json(files[date]);
    return grid ? Response.json(grid) : new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
}

const t = frPreview;

function show(props: Partial<React.ComponentProps<typeof PreviewPage>> = {}) {
  const storage = props.storage ?? memoryStorage();
  render(<PreviewPage storage={storage} baseUrl="/" fetchImpl={serve()} {...props} />);
  return storage;
}

async function ready() {
  await screen.findByTestId('preview-list');
}

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('PreviewPage', () => {
  it('states that it is a development page and has headings in order', async () => {
    show();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    expect(screen.getByTestId('dev-only').textContent).toBe(t.devOnly);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    // No jump of more than one level from a heading to the next.
    levels.forEach((level, i) => {
      if (i > 0) expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1);
    });
  });

  it('lists every grid with its date, number, weekday, difficulty and six categories', async () => {
    show();
    await ready();
    const items = within(screen.getByTestId('preview-list')).getAllByRole('listitem');
    expect(items).toHaveLength(grids.length);

    const first = screen.getByTestId('preview-grid-2026-11-01');
    const heading = within(first).getByRole('heading', { level: 3 }).textContent ?? '';
    expect(heading).toContain('n° 1');
    expect(heading).toContain('dimanche 1 novembre');
    expect(within(first).getByTestId('grid-meta').textContent).toContain(
      `${reviews[0]?.difficulty.score}/100`,
    );
    const labels = [...gridAt(0).rows, ...gridAt(0).cols].map((id) => getCategory(id).label.fr);
    for (const label of labels) expect(first.textContent).toContain(label);
  });

  it('opens a grid: nine cells, their sizes, their answers from best known to rarest', async () => {
    show();
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-02');
    fireEvent.click(within(item).getByTestId('toggle-detail'));

    const cells = within(item).getAllByTestId(/^cell-\d$/);
    expect(cells).toHaveLength(9);
    const grid = gridAt(1);
    cells.forEach((cell, i) => {
      expect(cell.getAttribute('data-size')).toBe(String(grid.cellSizes[i]));
      const names = within(cell)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('span')?.textContent);
      expect(names).toHaveLength(grid.cellSizes[i] ?? -1);
      const expected = sortByPopularity(
        must(reviewAt(1).cells[i]).answers.map((a) => a.id),
        popularity,
      );
      expect(names).toEqual(expected.map((id) => pokemonById(id).nameFr));
      // Every answer carries its estimated rarity tier.
      for (const li of within(cell).getAllByRole('listitem')) {
        expect(li.getAttribute('data-tier')).toMatch(/^(common|uncommon|rare|veryRare)$/);
      }
    });
    // The best-known answer of a cell is always the first and a `common` one.
    expect(within(must(cells[0])).getAllByRole('listitem')[0]?.getAttribute('data-tier')).toBe(
      'common',
    );

    const button = within(item).getByTestId('toggle-detail');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(within(item).queryAllByTestId(/^cell-\d$/)).toHaveLength(0);
  });

  it('shows the definition of a row or a column when it is expanded', async () => {
    show();
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-01');
    fireEvent.click(within(item).getByTestId('toggle-detail'));
    const line = within(item).getByTestId('line-row-0');
    const category = getCategory(gridAt(0).rows[0]);
    expect(line.textContent).toContain(category.label.fr);
    expect(line.textContent).toContain(category.definition.fr);
    expect(within(item).getAllByTestId(/^line-/)).toHaveLength(6);
  });

  it('flags cells with few answers, and says so on the cell', async () => {
    show();
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-01');
    fireEvent.click(within(item).getByTestId('toggle-detail'));
    const flagged = within(item)
      .getAllByTestId(/^cell-\d$/)
      .filter((cell) => (cell.getAttribute('data-flags') ?? '').includes('few'));
    const expected = reviewAt(0).cells.filter((c) => c.flags.includes('few')).length;
    expect(expected).toBeGreaterThan(0);
    expect(flagged).toHaveLength(expected);
    expect(flagged[0]?.textContent).toContain(t.cellFlagShort.few);
  });

  it('sums up the flags, the family mix and the name categories at the top', async () => {
    show();
    await ready();
    const summary = within(screen.getByTestId('summary'));
    const flagged = reviews.filter((r) => hasFlag(r)).length;
    expect(summary.getByTestId('summary-flagged').textContent).toBe(
      t.flaggedGrids(flagged, grids.length),
    );
    const few = reviews.reduce((n, r) => n + r.flagCounts.few, 0);
    const fewGrids = reviews.filter((r) => hasFlag(r, 'few')).length;
    expect(
      summary.getByTestId('summary-flags').querySelector('[data-kind="few"]')?.textContent,
    ).toContain(t.flagsCells(few, fewGrids));
    expect(summary.getByTestId('summary-families').querySelectorAll('li').length).toBe(10);
    expect(summary.getByTestId('summary-name').textContent).toContain('%');
  });

  it('filters on grids with flags, then on one kind of flag', async () => {
    show();
    await ready();
    const count = () => screen.getByTestId('grids-count').textContent;
    expect(count()).toBe(t.gridsCount(grids.length, grids.length));

    const kind = screen.getByTestId('flag-kind') as HTMLSelectElement;
    expect(kind.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('only-flagged'));
    expect(kind.disabled).toBe(false);
    const flagged = reviews.filter((r) => hasFlag(r)).length;
    expect(count()).toBe(t.gridsCount(flagged, grids.length));

    fireEvent.change(kind, { target: { value: 'redundant' } });
    const redundant = reviews.filter((r) => hasFlag(r, 'redundant')).length;
    expect(count()).toBe(t.gridsCount(redundant, grids.length));
    if (redundant === 0) expect(screen.getByTestId('no-match').textContent).toBe(t.noGrids);

    fireEvent.change(kind, { target: { value: 'problem' } });
    expect(count()).toBe(t.gridsCount(0, grids.length));
    expect(screen.getByTestId('no-match')).toBeTruthy();
  });

  it('keeps what the owner has read under a prefixed key, and brings it back', async () => {
    const storage = show();
    await ready();
    const box = (date: string) =>
      within(screen.getByTestId(`preview-grid-${date}`)).getByRole('checkbox', {
        name: t.markReviewed,
      }) as HTMLInputElement;
    expect(box('2026-11-03').checked).toBe(false);
    fireEvent.click(box('2026-11-03'));
    expect(box('2026-11-03').checked).toBe(true);

    expect(REVIEWED_KEY.startsWith('pokeneuf:v1:preview:')).toBe(true);
    expect([...parseReviewed(storage.get(REVIEWED_KEY))]).toEqual(['2026-11-03']);
    expect(screen.getByTestId('summary-reviewed').textContent).toBe(
      t.reviewedCount(1, grids.length),
    );

    cleanup();
    show({ storage });
    await ready();
    expect(box('2026-11-03').checked).toBe(true);

    fireEvent.click(screen.getByTestId('hide-reviewed'));
    expect(screen.queryByTestId('preview-grid-2026-11-03')).toBeNull();
    expect(screen.getByTestId('grids-count').textContent).toBe(
      t.gridsCount(grids.length - 1, grids.length),
    );
  });

  it('copies a Markdown list of the grids read and still to read', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    show({ storage: memoryStorage({ [REVIEWED_KEY]: '{"version":1,"dates":["2026-11-02"]}' }) });
    await ready();
    fireEvent.click(screen.getByTestId('export'));

    await waitFor(() =>
      expect(screen.getByTestId('export-status').textContent).toBe(t.exportCopied),
    );
    const text = (screen.getByTestId('export-text') as HTMLTextAreaElement).value;
    expect(writeText).toHaveBeenCalledWith(text);
    expect(text).toContain(`# ${t.exportTitle}`);
    expect(text).toContain('- [x] 2026-11-02 (n° 2)');
    expect(text).toContain('- [ ] 2026-11-01 (n° 1)');
    expect(text).toContain('- [ ] 2026-11-05 (n° 5)');
    expect(text).not.toContain('- [x] 2026-11-01');
  });

  it('still shows the list to select by hand when the clipboard is not available', async () => {
    vi.stubGlobal('navigator', {});
    show();
    await ready();
    fireEvent.click(screen.getByTestId('export'));
    await waitFor(() =>
      expect(screen.getByTestId('export-status').textContent).toBe(t.exportFailed),
    );
    expect((screen.getByTestId('export-text') as HTMLTextAreaElement).value).toContain(
      '2026-11-01',
    );
  });

  it('shows what is wrong with a grid instead of hiding it', async () => {
    const broken: Grid = { ...gridAt(2), difficulty: 99 };
    show({ fetchImpl: serve({ '2026-11-03': broken }) });
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-03');
    expect(item.getAttribute('data-flagged')).toBe('true');
    fireEvent.click(within(item).getByTestId('toggle-detail'));
    expect(within(item).getByTestId('problems').textContent).toContain('difficulty should be');
  });

  it('lists a grid file that cannot be read, and keeps the others', async () => {
    show({ fetchImpl: serve({ '2026-11-04': { nope: true } }) });
    await ready();
    expect(screen.getByTestId('unreadable').textContent).toBe(t.failedGrids('2026-11-04'));
    expect(screen.queryByTestId('preview-grid-2026-11-04')).toBeNull();
    expect(screen.getByTestId('preview-grid-2026-11-05')).toBeTruthy();
  });

  it('opens the grid named in the URL', async () => {
    show({ focusDate: '2026-11-04' });
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-04');
    expect(within(item).getByTestId('toggle-detail').getAttribute('aria-expanded')).toBe('true');
    expect(within(item).getAllByTestId(/^cell-\d$/)).toHaveLength(9);
  });

  it('offers a retry when the index cannot be read', async () => {
    const failing = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    show({ fetchImpl: failing });
    expect((await screen.findByTestId('load-error')).textContent).toBe(t.loadError);
    expect(screen.getByRole('button', { name: t.retry })).toBeTruthy();
  });
});

describe('the /preview route of the app (development)', () => {
  it('shows the review page', async () => {
    window.location.hash = '#/preview';
    render(<App storage={memoryStorage()} baseUrl="/" fetchImpl={serve()} />);
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    await ready();
    expect(screen.getByTestId('preview-grid-2026-11-01')).toBeTruthy();
  });

  it('opens the grid of #/preview/YYYY-MM-DD', async () => {
    window.location.hash = '#/preview/2026-11-03';
    render(<App storage={memoryStorage()} baseUrl="/" fetchImpl={serve()} />);
    await ready();
    const item = screen.getByTestId('preview-grid-2026-11-03');
    expect(within(item).getByTestId('toggle-detail').getAttribute('aria-expanded')).toBe('true');
  });

  it('follows the hash back to the game', async () => {
    window.location.hash = '#/preview';
    render(<App storage={memoryStorage()} baseUrl="/" fetchImpl={serve()} />);
    await ready();
    window.location.hash = '#/faq';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Questions fréquentes' }),
    ).toBeTruthy();
    expect(screen.queryByTestId('preview-list')).toBeNull();
  });
});
