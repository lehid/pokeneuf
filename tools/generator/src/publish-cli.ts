import { parseArgs } from 'node:util';
import { addDays, gridDateFor } from '@pokeneuf/core';
import { fromWhereTyped } from './cli-common';
import { DEFAULT_AHEAD_DAYS, publishGrids } from './publish';

const USAGE = `Usage: pnpm grids:publish --dir apps/web/dist/grids [--ahead N] [--today YYYY-MM-DD]

  Keeps in DIR the grids up to today (Paris) + N days (default ${DEFAULT_AHEAD_DAYS}: tomorrow's is public the evening
  before), deletes the grids further ahead and rewrites index.json. Meant for the built site,
  never for apps/web/public/grids.`;

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    today: { type: 'string' },
    ahead: { type: 'string', default: String(DEFAULT_AHEAD_DAYS) },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!values.dir) {
  console.error(`--dir is required\n\n${USAGE}`);
  process.exit(2);
}
const today = values.today ?? gridDateFor(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`--today must be YYYY-MM-DD\n\n${USAGE}`);
  process.exit(2);
}

const ahead = Number(values.ahead);
if (!/^\d+$/.test(values.ahead)) {
  console.error(`--ahead must be a whole number of days (0 or more)\n\n${USAGE}`);
  process.exit(2);
}

try {
  const { kept, removed } = await publishGrids(fromWhereTyped(values.dir), today, ahead);
  console.log(
    `Published ${kept.length} grid(s) up to ${addDays(today, ahead)} (today ${today} + ${ahead})` +
      (kept.length > 0 ? ` (${kept[0]} to ${kept.at(-1)})` : '') +
      `; ${removed.length} grid(s) further ahead kept out of the site.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
