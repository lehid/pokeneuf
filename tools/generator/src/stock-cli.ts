import { parseArgs } from 'node:util';
import { fromWhereTyped } from './cli-common';
import { gridDateFor } from '@pokeneuf/core';
import { GRIDS_DIR, readGrids } from './files';
import { MIN_STOCK_DAYS, stockDays, stockEnd, stockStart } from './stock';

const USAGE = `Usage: pnpm grids:stock [--min N] [--dir DIR] [--today YYYY-MM-DD]

  Exits with 1 when the grids do not cover the next N days (default ${MIN_STOCK_DAYS}) from today (Paris), or from the launch day before the launch.`;

const { values } = parseArgs({
  options: {
    min: { type: 'string', default: String(MIN_STOCK_DAYS) },
    dir: { type: 'string', default: GRIDS_DIR },
    today: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const min = Number(values.min);
if (!Number.isInteger(min) || min < 1) {
  console.error(`--min must be a positive integer\n\n${USAGE}`);
  process.exit(2);
}
// `--today` is for tests and dry runs; the real run always uses the Paris date.
const today = values.today ?? gridDateFor(new Date());

const dates = (await readGrids(fromWhereTyped(values.dir))).map((g) => g.date);
const days = stockDays(dates, today);
const end = stockEnd(dates, today);
console.log(
  end === null
    ? `No grid for ${stockStart(today)}: the stock is empty.`
    : `Grid stock: ${days} day(s) from ${stockStart(today)}, up to ${end}.`,
);
if (days < min) {
  console.error(`Fewer than ${min} days of grids left: run "pnpm grids:generate" and commit them.`);
  process.exit(1);
}
