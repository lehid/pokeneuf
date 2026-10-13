import { parseArgs } from 'node:util';
import { fromWhereTyped, loadMemberships, loadPopularity } from './cli-common';
import { loadConfig } from './config';
import { GRIDS_DIR, MEMBERSHIPS_PATH, readGrids, readIndex } from './files';
import { analyzeGrids } from './report';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: GRIDS_DIR },
    memberships: { type: 'string', default: MEMBERSHIPS_PATH },
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

const { text, problems } = analyzeGrids(grids, memberships, popularity, config, index);
console.log(text);
process.exitCode = problems.length === 0 ? 0 : 1;
