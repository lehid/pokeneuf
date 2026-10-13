import { parseArgs } from 'node:util';
import { loadMemberships, loadPopularity } from './cli-common';
import { GRIDS_DIR, MEMBERSHIPS_PATH, readGrids } from './files';
import { formatSimulation, simulate } from './simulate';

const USAGE = `Usage: pnpm score:simulate [--games N] [--dir DIR]

  Plays N games per grid (default 40) with three kinds of players on the published grids and prints
  the scores per difficulty level, to compare with the target band.`;

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '40' },
    dir: { type: 'string', default: GRIDS_DIR },
    memberships: { type: 'string', default: MEMBERSHIPS_PATH },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const games = Number(values.games);
if (!Number.isInteger(games) || games < 1) {
  console.error(`--games must be a positive integer\n\n${USAGE}`);
  process.exit(2);
}

const [memberships, popularity, grids] = await Promise.all([
  loadMemberships(values.memberships),
  loadPopularity(),
  readGrids(values.dir),
]);
if (grids.length === 0) {
  console.error('No grid to play: run "pnpm grids:generate" first.');
  process.exit(1);
}
console.log(formatSimulation(simulate({ grids, memberships, popularity, gamesPerGrid: games })));
