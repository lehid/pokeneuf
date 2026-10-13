import { parseArgs } from 'node:util';
import { addDays, gridDateFor, LAUNCH_DATE, type Grid } from '@pokeneuf/core';
import { fromWhereTyped, loadMemberships, loadPopularity } from './cli-common';
import { loadConfig } from './config';
import { createGenerator, dateRange, GenerationError } from './generate';
import { frozenDates } from './publish';
import { GRIDS_DIR, MEMBERSHIPS_PATH, readGrids, writeGrid, writeIndex } from './files';

const USAGE = `Usage: pnpm grids:generate --from YYYY-MM-DD --days N [--force] [--out DIR] [--memberships FILE]

  --from   first date (Paris calendar date), not before the launch date (${LAUNCH_DATE})
  --days   number of consecutive days to cover (1-366)
  --force  regenerate dates that already have a grid (default: keep them, they feed the cooldowns);
           never for today or a past day: a published grid is history and does not change
  --today  the date taken for today, for tests (default: today in Paris)`;

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    days: { type: 'string' },
    out: { type: 'string', default: GRIDS_DIR },
    memberships: { type: 'string', default: MEMBERSHIPS_PATH },
    force: { type: 'boolean', default: false },
    today: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const from = values.from;
const days = Number(values.days);
if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) fail('--from is required, as YYYY-MM-DD');
if (!Number.isInteger(days) || days < 1 || days > 366)
  fail('--days must be an integer from 1 to 366');
if (from < LAUNCH_DATE) fail(`--from ${from} is before the launch date ${LAUNCH_DATE}`);

const outDir = fromWhereTyped(values.out);
const memberships = await loadMemberships(fromWhereTyped(values.memberships));
const config = await loadConfig();
const popularity = await loadPopularity();
const generate = createGenerator({ memberships, popularity, config });

const dates = dateRange(from, days);
const existing = await readGrids(outDir);
const today = values.today ?? gridDateFor(new Date());
if (values.force) {
  const have = new Set(existing.map((g) => g.date));
  const frozen = frozenDates(
    dates.filter((d) => have.has(d)),
    today,
  );
  if (frozen.length > 0) {
    fail(
      `--force would rewrite published grids (${frozen.slice(0, 3).join(', ')}${frozen.length > 3 ? '…' : ''}): ` +
        `the grids of today and of past days are history and never change.`,
    );
  }
}
const regenerated = new Set(values.force ? dates : []);
const grids: Grid[] = existing.filter((g) => !regenerated.has(g.date));
const have = new Set(grids.map((g) => g.date));

let generated = 0;
let kept = 0;
let attempts = 0;
const relaxed: Record<number, number> = {};
let failure: GenerationError | null = null;

for (const date of dates) {
  if (have.has(date)) {
    kept++;
    continue;
  }
  try {
    const result = generate({ date, history: grids });
    grids.push(result.grid);
    await writeGrid(result.grid, outDir);
    generated++;
    attempts += result.attempts;
    if (result.categoryCooldownDays < config.cooldown.categoryDays) {
      relaxed[result.categoryCooldownDays] = (relaxed[result.categoryCooldownDays] ?? 0) + 1;
    }
  } catch (error) {
    if (error instanceof GenerationError) {
      failure = error;
      break;
    }
    throw error;
  }
}

await writeIndex(grids, outDir);

console.log(
  `${from} → ${addDays(from, days - 1)}: ${generated} generated, ${kept} kept (${grids.length} grids in ${outDir})`,
);
if (generated > 0) console.log(`  average draws per grid: ${(attempts / generated).toFixed(0)}`);
const relaxedCount = Object.values(relaxed).reduce((s, n) => s + n, 0);
if (relaxedCount > 0) {
  console.log(
    `  category cooldown shortened for ${relaxedCount} grid(s): ` +
      Object.entries(relaxed)
        .map(([d, n]) => `${n}× to ${d} days`)
        .join(', '),
  );
}
console.log('Review with "pnpm grids:report" before committing.');
if (failure) {
  console.error(`\n${failure.message}`);
  process.exitCode = 1;
}
