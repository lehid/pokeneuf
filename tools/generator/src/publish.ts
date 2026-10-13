import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { GridDate } from '@pokeneuf/core';
import { GRIDS_DIR, gridPath, readGrids, writeIndex } from './files';

export interface PublishResult {
  /** Dates still in the folder, up to today. */
  kept: GridDate[];
  /** Dates taken out: the grids of the days to come. */
  removed: GridDate[];
}

/**
 * Prepares the grid folder of a built site for publication: only the grids of today and of the days
 * before it stay, the ones of the days to come are deleted, and `index.json` is rewritten to match.
 * The repository keeps every grid (the stock of the next 90 days); the site never shows tomorrow's.
 *
 * Never run on the source folder (`apps/web/public/grids`): it works in place, on the copy that the
 * build made in `dist`.
 */
export async function publishGrids(dir: string, today: GridDate): Promise<PublishResult> {
  if (path.resolve(dir) === path.resolve(GRIDS_DIR)) {
    throw new Error(
      `Refusing to prune ${dir}: it holds the source grids. Point at the built copy (apps/web/dist/grids).`,
    );
  }
  const folder = await stat(dir).catch(() => null);
  if (!folder?.isDirectory()) {
    // A mistyped path must not look like "nothing to remove": that would publish tomorrow's grids.
    throw new Error(`${dir} does not exist: build the site first (pnpm build).`);
  }
  const grids = await readGrids(dir);
  const kept = grids.filter((g) => g.date <= today);
  const removed = grids.filter((g) => g.date > today);
  await Promise.all(removed.map((g) => rm(gridPath(dir, g.date))));
  await writeIndex(kept, dir);
  return { kept: kept.map((g) => g.date), removed: removed.map((g) => g.date) };
}

/**
 * Past grids are history: once a day is over (or has begun), its grid is public and never changes.
 * The dates among `dates` that may no longer be regenerated.
 */
export function frozenDates(dates: readonly GridDate[], today: GridDate): GridDate[] {
  return dates.filter((date) => date <= today);
}
