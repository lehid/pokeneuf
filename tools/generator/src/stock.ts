import { addDays, LAUNCH_DATE, type GridDate } from '@pokeneuf/core';

/**
 * Days the grid stock must cover, counted from today or the launch day. 45 days leaves time for the
 * owner to notice the alert (weekly check) and to review a new batch before the stock runs out.
 */
export const MIN_STOCK_DAYS = 45;

/** The first day that needs a grid: today, or the launch day while the game has not launched. */
export function stockStart(today: GridDate): GridDate {
  return today < LAUNCH_DATE ? LAUNCH_DATE : today;
}

/**
 * How many consecutive days, starting today (or the launch day, before the launch), have a grid.
 * A gap ends the count: a grid after a missing day is of no use to the players of that missing day.
 */
export function stockDays(dates: readonly GridDate[], today: GridDate): number {
  const have = new Set(dates);
  const start = stockStart(today);
  let days = 0;
  while (have.has(addDays(start, days))) days++;
  return days;
}

/** Last date of the unbroken run that starts today (or at launch), or `null` when it has no grid. */
export function stockEnd(dates: readonly GridDate[], today: GridDate): GridDate | null {
  const days = stockDays(dates, today);
  return days === 0 ? null : addDays(stockStart(today), days - 1);
}
