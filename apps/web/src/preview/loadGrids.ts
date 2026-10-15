import { gridUrl, parseGrid, type Grid, type GridDate } from '@pokeneuf/core';
import { loadGridIndex } from '../gridLoader';

export type PreviewLoad =
  | {
      kind: 'ready';
      /** Every grid file that could be read, by date. */
      grids: Grid[];
      /** Dates listed in the index whose file is missing or is not a grid. */
      unreadable: GridDate[];
    }
  /** The index itself could not be read. */
  | { kind: 'error' };

export interface PreviewLoadOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Every grid of `grids/index.json`, read as it is. Unlike the game's `loadGrid`, a grid that fails
 * `checkGrid` is still returned: showing what is wrong is the point of the review.
 */
export async function loadPreviewGrids({
  baseUrl,
  fetchImpl = fetch,
}: PreviewLoadOptions): Promise<PreviewLoad> {
  const index = await loadGridIndex({ baseUrl, fetchImpl });
  if (index.kind === 'error') return { kind: 'error' };

  const read = async (date: GridDate): Promise<Grid | null> => {
    try {
      const response = await fetchImpl(gridUrl(date, baseUrl), { cache: 'no-store' });
      if (!response.ok) return null;
      const grid = parseGrid(await response.json());
      return grid !== null && grid.date === date ? grid : null;
    } catch {
      return null;
    }
  };

  const dates = [...index.dates].sort();
  const results = await Promise.all(dates.map(read));
  const grids: Grid[] = [];
  const unreadable: GridDate[] = [];
  results.forEach((grid, i) => {
    if (grid) grids.push(grid);
    else unreadable.push(dates[i] as GridDate);
  });
  return { kind: 'ready', grids, unreadable };
}
