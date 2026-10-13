import {
  checkGrid,
  gridUrl,
  isBeforeLaunch,
  parseGrid,
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
 * Today's grid. Always revalidated (`no-cache`): a stale grid is worse than a slow one, and the
 * grid of the day must never be kept for long by the browser, a CDN or a service worker.
 */
export async function loadDailyGrid(
  date: GridDate,
  { memberships, baseUrl, fetchImpl = fetch }: LoadOptions,
): Promise<GridLoad> {
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
}
