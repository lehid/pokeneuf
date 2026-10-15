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

/**
 * Is this a real calendar date, written `YYYY-MM-DD`? The shape alone is not enough ("2026-00-01",
 * "2026-11-99" have it): the date must survive a round trip through the real date arithmetic.
 */
export function isValidGridDate(date: string): boolean {
  if (!ISO_DATE.test(date)) return false;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === date;
}

function toUtcDay(date: GridDate): number {
  if (!isValidGridDate(date)) {
    throw new Error(`Invalid grid date: ${date}`);
  }
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
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

/**
 * Milliseconds from `now` until the grid date changes (the next midnight in Paris). Found by
 * searching the instant itself rather than adding "24 hours", so it stays right on the two days a
 * year when the clocks change and the day lasts 23 or 25 hours.
 */
export function msUntilNextGridDate(now: Date): number {
  const today = gridDateFor(now);
  const start = now.getTime();
  // The longest Paris day is 25 hours: the date has certainly changed 26 hours from now.
  let low = 0; // still `today` at start + low
  let high = 26 * 3_600_000; // already the next date at start + high
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (gridDateFor(new Date(start + middle)) === today) low = middle;
    else high = middle;
  }
  return high;
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
