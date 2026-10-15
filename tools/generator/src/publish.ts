import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { addDays, type GridDate } from '@pokeneuf/core';
import { GRIDS_DIR, gridPath, readGrids, writeIndex } from './files';

/** Days after today whose grid is already public (decision D1): tomorrow's, published the evening before. */
export const DEFAULT_AHEAD_DAYS = 1;

export interface PublishResult {
  /** Dates still in the folder, up to today + `ahead`. */
  kept: GridDate[];
  /** Dates taken out: the grids further ahead than that. */
  removed: GridDate[];
}

/**
 * Prepares the grid folder of a built site for publication: the grids of the past, of today and of
 * the next `ahead` days stay (tomorrow's by default, so that a late midnight deploy does not leave
 * the players without a grid), the ones further ahead are deleted, and `index.json` is rewritten to
 * match. The repository keeps every grid (the stock of the next 90 days). The client never lists
 * the days to come (`archiveDates`) and asks for today's grid by the Paris date.
 *
 * Never run on the source folder (`apps/web/public/grids`): it works in place, on the copy that the
 * build made in `dist`.
 */
export async function publishGrids(
  dir: string,
  today: GridDate,
  ahead: number = DEFAULT_AHEAD_DAYS,
): Promise<PublishResult> {
  if (!Number.isInteger(ahead) || ahead < 0) {
    throw new Error(`ahead must be a whole number of days, 0 or more (got ${ahead}).`);
  }
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
  const last = addDays(today, ahead);
  const kept = grids.filter((g) => g.date <= last);
  const removed = grids.filter((g) => g.date > last);
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
