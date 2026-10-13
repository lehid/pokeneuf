import { GRID_TIME_ZONE, LAUNCH_DATE } from './config';

/** ISO calendar date, e.g. "2026-11-01". */
export type GridDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GRID_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The grid date for a given instant: the calendar date in Europe/Paris.
 * The only function allowed to turn "now" into a grid date.
 */
export function gridDateFor(now: Date): GridDate {
  // en-CA formats as YYYY-MM-DD.
  return parisFormatter.format(now);
}

function toUtcDay(date: GridDate): number {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Invalid grid date: ${date}`);
  }
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid grid date: ${date}`);
  }
  return Math.round(ms / DAY_MS);
}

/** Number of calendar days from `from` to `to` (can be negative). */
export function daysBetween(from: GridDate, to: GridDate): number {
  return toUtcDay(to) - toUtcDay(from);
}

/** Grid number shown to players: #1 on LAUNCH_DATE. Returns 0 or less before launch. */
export function gridNumber(date: GridDate, launchDate: GridDate = LAUNCH_DATE): number {
  return daysBetween(launchDate, date) + 1;
}

/** Calendar date `days` after `date`. */
export function addDays(date: GridDate, days: number): GridDate {
  return new Date((toUtcDay(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Has a new grid date started since `loadedDate` was loaded? (The tab stayed open past Paris midnight.) */
export function hasNewGrid(loadedDate: GridDate, now: Date): boolean {
  return gridDateFor(now) !== loadedDate;
}

/** Is there no grid yet for this date, because the game has not launched? */
export function isBeforeLaunch(date: GridDate, launchDate: GridDate = LAUNCH_DATE): boolean {
  return gridNumber(date, launchDate) < 1;
}

/**
 * Where a grid file lives: `grids/{date}.json` under the app's base path (`import.meta.env.BASE_URL`),
 * so the site works under `/<repo>/` on GitHub Pages and under `/` on a custom domain.
 */
export function gridUrl(date: GridDate, baseUrl: string): string {
  toUtcDay(date);
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}grids/${date}.json`;
}
