import { parseArgs } from 'node:util';
import { gridDateFor } from '@pokeneuf/core';
import { fromWhereTyped, loadMemberships, loadPopularity } from './cli-common';
import { loadConfig } from './config';
import { GRIDS_DIR, MEMBERSHIPS_PATH, readGrids, readIndex } from './files';
import { analyzeGrids } from './report';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: GRIDS_DIR },
    memberships: { type: 'string', default: MEMBERSHIPS_PATH },
    today: { type: 'string' },
  },
});

const dir = fromWhereTyped(values.dir);
const [memberships, popularity, config, grids, index] = await Promise.all([
  loadMemberships(fromWhereTyped(values.memberships)),
  loadPopularity(),
  loadConfig(),
  readGrids(dir),
  readIndex(dir),
]);

// `--today` is for tests and dry runs; the real run uses the Paris date.
const today = values.today ?? gridDateFor(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error('--today must be YYYY-MM-DD');
  process.exit(2);
}

const { text, problems } = analyzeGrids(
  grids,
  memberships,
  popularity,
  config,
  index,
  undefined,
  today,
);
console.log(text);
process.exitCode = problems.length === 0 ? 0 : 1;
