import {
  checkGrid,
  gridUrl,
  isBeforeLaunch,
  parseGrid,
  parseGridIndex,
  type Grid,
  type GridDate,
  type Memberships,
} from '@pokeneuf/core';

export type GridLoad =
  | { kind: 'ready'; grid: Grid }
  /** No grid for this date: before the launch, or the stock ran out. */
  | { kind: 'missing'; beforeLaunch: boolean }
  /** Network down, broken file, or a grid that does not pass `checkGrid`. */
  | { kind: 'error' };

export interface LoadOptions {
  memberships: Memberships;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * The grid of a date (today's, or a past one for the archives). Always revalidated (`no-cache`): a stale grid is worse than a slow one, and the
 * grid of the day must never be kept for long by the browser, a CDN or a service worker.
 */
export async function loadGrid(
  date: GridDate,
  { memberships, baseUrl, fetchImpl = fetch }: LoadOptions,
): Promise<GridLoad> {
  // Everything is inside the try: a date that is not a real day makes `gridUrl` and `isBeforeLaunch`
  // throw, and a promise that rejects here would leave the page on "Chargement…" forever.
  try {
    const missing: GridLoad = { kind: 'missing', beforeLaunch: isBeforeLaunch(date) };
    let response: Response;
    try {
      response = await fetchImpl(gridUrl(date, baseUrl), { cache: 'no-cache' });
    } catch {
      return { kind: 'error' };
    }
    if (response.status === 404) return missing;
    if (!response.ok) return { kind: 'error' };

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      // Some servers answer a missing file with their HTML page and a 200.
      const html = response.headers.get('content-type')?.includes('text/html') ?? false;
      return html ? missing : { kind: 'error' };
    }

    const grid = parseGrid(raw);
    if (grid === null || grid.date !== date) return { kind: 'error' };
    if (checkGrid(grid, memberships).length > 0) return { kind: 'error' };
    return { kind: 'ready', grid };
  } catch {
    return { kind: 'error' };
  }
}

export type IndexLoad =
  | { kind: 'ready'; dates: GridDate[] }
  /** The index could not be read: network down, broken file. */
  | { kind: 'error' };

/** The dates of every published grid (`grids/index.json`), always revalidated like the grids. */
export async function loadGridIndex({
  baseUrl,
  fetchImpl = fetch,
}: Pick<LoadOptions, 'baseUrl' | 'fetchImpl'>): Promise<IndexLoad> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  try {
    const response = await fetchImpl(`${base}grids/index.json`, { cache: 'no-cache' });
    if (!response.ok) return { kind: 'error' };
    const index = parseGridIndex(await response.json());
    return index === null
      ? { kind: 'error' }
      : { kind: 'ready', dates: index.grids.map((g) => g.date) };
  } catch {
    return { kind: 'error' };
  }
}
