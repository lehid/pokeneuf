import { LAUNCH_DATE } from './config';
import type { GridDate } from './date';
import { gridNumber } from './date';
import type { GameSummary } from './storage';

export const ARCHIVE_PAGE_SIZE = 10;

/**
 * The dates that can be played from the archives: published grids of days that are over, newest
 * first. Today's grid is the daily one, and a future grid is never offered.
 */
export function archiveDates(published: readonly GridDate[], today: GridDate): GridDate[] {
  return [...new Set(published)]
    .filter((date) => date >= LAUNCH_DATE && date < today)
    .sort((a, b) => b.localeCompare(a));
}

export interface Page<T> {
  items: T[];
  /** 1-based, and always a page that exists. */
  page: number;
  pages: number;
  total: number;
}

/** One page of a list. A page out of range falls back to the nearest one; an empty list has 1 page. */
export function paginate<T>(
  items: readonly T[],
  page: number,
  size: number = ARCHIVE_PAGE_SIZE,
): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: items.length,
  };
}

/** Is a game that ended on `finishedOn` a daily game of the grid of `gridDate`? */
export function endedOnItsDay(finishedOn: GridDate | null, gridDate: GridDate): boolean {
  return finishedOn !== null && finishedOn === gridDate;
}

export type ArchiveStatus = 'unplayed' | 'inProgress' | 'dailyDone' | 'archiveDone';

/**
 * Where a past grid stands: never played, in progress, finished on its own day (a daily game) or
 * finished later (an archive). A game that ends after midnight is an archive, even if it began on
 * the day.
 */
export function archiveStatus(summary: GameSummary | null, gridDate: GridDate): ArchiveStatus {
  if (summary === null) return 'unplayed';
  if (summary.status === 'playing') return 'inProgress';
  return endedOnItsDay(summary.finishedOn, gridDate) ? 'dailyDone' : 'archiveDone';
}

export interface ArchiveRow {
  date: GridDate;
  /** Grid number. */
  id: number;
  status: ArchiveStatus;
  /** Frozen score of a finished game, when known. */
  score: number | null;
  found: number;
}

export function archiveRow(date: GridDate, summary: GameSummary | null): ArchiveRow {
  const status = archiveStatus(summary, date);
  const finished = status === 'dailyDone' || status === 'archiveDone';
  return {
    date,
    id: gridNumber(date),
    status,
    score: finished ? (summary?.score ?? null) : null,
    found: summary?.found ?? 0,
  };
}
