import { parseArgs } from 'node:util';
import { gridDateFor } from '@pokeneuf/core';
import { fromWhereTyped } from './cli-common';
import { publishGrids } from './publish';

const USAGE = `Usage: pnpm grids:publish --dir apps/web/dist/grids [--today YYYY-MM-DD]

  Keeps in DIR the grids of today (Paris) and of the days before, deletes the grids of the days to
  come and rewrites index.json. Meant for the built site, never for apps/web/public/grids.`;

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    today: { type: 'string' },
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

try {
  const { kept, removed } = await publishGrids(fromWhereTyped(values.dir), today);
  console.log(
    `Published ${kept.length} grid(s) up to ${today}` +
      (kept.length > 0 ? ` (${kept[0]} to ${kept.at(-1)})` : '') +
      `; ${removed.length} grid(s) of the days to come kept out of the site.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
