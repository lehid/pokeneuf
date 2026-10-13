import { addDays, type GridDate } from '@pokeneuf/core';

/** Days the grid stock must cover, counted from today (ROADMAP phase 5). */
export const MIN_STOCK_DAYS = 30;

/**
 * How many consecutive days, starting today, have a grid. A gap ends the count: a grid after a
 * missing day is of no use to the players of that missing day.
 */
export function stockDays(dates: readonly GridDate[], today: GridDate): number {
  const have = new Set(dates);
  let days = 0;
  while (have.has(addDays(today, days))) days++;
  return days;
}

/** Last date of the unbroken run that starts today, or `null` when today has no grid. */
export function stockEnd(dates: readonly GridDate[], today: GridDate): GridDate | null {
  const days = stockDays(dates, today);
  return days === 0 ? null : addDays(today, days - 1);
}
