import { parseArgs } from 'node:util';
import { gridDateFor } from '@pokeneuf/core';
import { fromWhereTyped } from './cli-common';
import { ROOT } from './files';
import { changesSince, frozenChanges, GRIDS_REPO_PATH } from './immutable';

const USAGE = `Usage: pnpm grids:immutable [--base origin/main] [--today YYYY-MM-DD] [--repo DIR] [--dir PATH]

  Fails (exit 1) when a grid file dated today (Paris) or earlier is modified, renamed or deleted
  compared with the base ref: a published grid is history and never changes. Adding grids is fine.
  --base   ref to compare with (default origin/main)
  --repo   git repository to inspect (default: this repository)
  --dir    folder of the grids, relative to the repository root (default ${GRIDS_REPO_PATH})
  --today  the date taken for today, for tests (default: today in Paris)`;

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    today: { type: 'string' },
    repo: { type: 'string' },
    dir: { type: 'string', default: GRIDS_REPO_PATH },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const today = values.today ?? gridDateFor(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`--today must be YYYY-MM-DD\n\n${USAGE}`);
  process.exit(2);
}

try {
  const repo = values.repo ? fromWhereTyped(values.repo) : ROOT;
  const base = values.base;
  const changes = await changesSince(base, repo);
  const frozen = frozenChanges(changes, today, values.dir);
  if (frozen.length > 0) {
    console.error(
      `${frozen.length} published grid change(s) compared with ${base} (today is ${today}):`,
    );
    for (const change of frozen) console.error(`  ! ${change.reason}`);
    console.error(
      'A grid dated today or earlier is history: revert these changes. To fix a mistake, talk to the owner first.',
    );
    process.exit(1);
  }
  console.log(`No published grid (${today} and before) changed compared with ${base}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
