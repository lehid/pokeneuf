import {
  CATEGORIES,
  GRID_VERSION,
  LAUNCH_DATE,
  type Grid,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type GeneratorConfig } from './config';
import { buildIndex, type GridIndex } from './files';
import { createGenerator, dateRange } from './generate';
import { analyzeGrids, cooldownFindings, frozenGridFindings } from './report';
import { realWorld } from './test-world';

let memberships: Memberships;
let popularity: Popularity;
let config: GeneratorConfig;
let grids: Grid[];

beforeAll(async () => {
  ({ memberships, popularity } = await realWorld());
  config = await loadConfig();
  const generate = createGenerator({ memberships, popularity, config });
  grids = [];
  for (const date of dateRange(LAUNCH_DATE, 40))
    grids.push(generate({ date, history: grids }).grid);
}, 120_000);

const fake = (date: string, rows: string[], cols: string[]): Grid => ({
  version: GRID_VERSION,
  id: 1,
  date,
  rows: rows as Grid['rows'],
  cols: cols as Grid['cols'],
  cellSizes: Array(9).fill(5),
  difficulty: 50,
});

describe('cooldownFindings', () => {
  const a = fake(
    '2026-11-01',
    ['gen-1', 'type-fire', 'evo-base'],
    ['color-red', 'stat-total-500', 'size-height-2m'],
  );

  it('is empty when nothing comes back early', () => {
    const b = fake(
      '2026-11-20',
      ['gen-2', 'type-water', 'evo-final'],
      ['color-blue', 'stat-hp-50', 'size-weight-100kg'],
    );
    expect(cooldownFindings([a, b], config)).toEqual({ relaxed: [], violations: [] });
  });

  it('calls a category back before the target but after the floor "relaxed", not a violation', () => {
    const gap = config.cooldown.categoryDays - 1;
    const b = fake(
      `2026-11-0${1 + gap}`,
      ['gen-1', 'type-water', 'evo-final'],
      ['color-blue', 'stat-hp-50', 'size-weight-100kg'],
    );
    const { relaxed, violations } = cooldownFindings([a, b], config);
    expect(relaxed).toEqual([
      { kind: 'category', what: 'gen-1', dates: ['2026-11-01', b.date], gap },
    ]);
    expect(violations).toEqual([]);
  });

  it('flags a category back before the floor as a violation', () => {
    const b = fake(
      '2026-11-02',
      ['gen-1', 'type-water', 'evo-final'],
      ['color-blue', 'stat-hp-50', 'size-weight-100kg'],
    );
    const { violations } = cooldownFindings([a, b], config);
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'category', what: 'gen-1', gap: 1 }),
    ]);
  });

  it('flags a row × column pair back within 30 days, in either orientation', () => {
    const swapped = fake(
      '2026-11-25',
      ['color-red', 'a', 'b'].map((x) => x),
      ['gen-1', 'c', 'd'],
    );
    const { violations } = cooldownFindings([a, swapped], config);
    expect(violations.filter((v) => v.kind === 'pair')).toEqual([
      expect.objectContaining({ what: 'color-red × gen-1', gap: 24 }),
    ]);
  });

  it('does not depend on the order of the grids', () => {
    const b = fake('2026-11-02', ['gen-1', 'x', 'y'], ['p', 'q', 'r']);
    expect(cooldownFindings([b, a], config)).toEqual(cooldownFindings([a, b], config));
  });
});

/** All the grids are in the future: the strict rules apply to each of them. */
const BEFORE_ALL = '2026-10-01';
/** All the grids are public. */
const AFTER_ALL = '2027-06-01';

describe('analyzeGrids', () => {
  const run = (
    list: readonly Grid[],
    index: GridIndex | null = buildIndex(list),
    today: string = BEFORE_ALL,
  ) => analyzeGrids(list, memberships, popularity, config, index, undefined, today);

  it('finds nothing wrong with generated grids, and describes them', () => {
    const { text, problems } = run(grids);
    expect(problems).toEqual([]);
    expect(text).toContain('40 grids, #1 (2026-11-01) to #40 (2026-12-10)');
    expect(text).toContain('Size difficulty (0 easy - 100 hard');
    expect(text).toContain('Level by weekday (veryEasy / easy / medium / hard / veryHard):');
    expect(text).toMatch(
      /mon: \d+ grids, \d+ \/ \d+ \/ \d+ \/ \d+ \/ \d+ {2}\(accepted: veryEasy, easy\)/,
    );
    expect(text).toContain('at most one per week');
    expect(text).toContain('Categories:');
    expect(text).toContain('Families:');
    expect(text).toContain('Pair cooldown (30 days): respected');
    expect(text).toContain('No problem found.');
  });

  it('flags grids whose level is not accepted on their weekday', () => {
    const strict = { ...config, weekdayLevels: { mon: ['veryEasy' as const] } };
    const { problems } = analyzeGrids(
      grids,
      memberships,
      popularity,
      strict,
      buildIndex(grids),
      undefined,
      BEFORE_ALL,
    );
    expect(problems.some((p) => /mon grid\(s\) outside the accepted levels veryEasy/.test(p))).toBe(
      true,
    );
  });

  it('flags more than one very hard grid in a calendar week', () => {
    const allVeryHard = {
      ...config,
      weekdayLevels: Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, ['veryHard' as const]]),
      ),
    };
    const generate = createGenerator({ memberships, popularity, config: allVeryHard });
    const week: Grid[] = [];
    // 2026-11-02 is a Monday: Monday to Sunday is one calendar week.
    for (const date of dateRange('2026-11-02', 7))
      week.push(generate({ date, history: week }).grid);
    const { problems } = analyzeGrids(
      week,
      memberships,
      popularity,
      allVeryHard,
      buildIndex(week),
      undefined,
      BEFORE_ALL,
    );
    expect(problems.some((p) => /7 very hard grids in the week of 2026-11-02/.test(p))).toBe(true);
  });

  it('says so when there is no grid', () => {
    expect(run([], { version: 1, grids: [] }).text).toContain('No grid.');
  });

  it('flags an invalid grid', () => {
    const broken: Grid[] = grids.map((g, i) =>
      i === 3 ? { ...g, cellSizes: g.cellSizes.map(() => 1) } : g,
    );
    const { problems } = run(broken);
    expect(problems.join('\n')).toMatch(/grid 4 .*answers/);
  });

  it('flags a missing day', () => {
    const { problems } = run(grids.filter((_, i) => i !== 5));
    expect(problems.join('\n')).toMatch(/missing days: 2026-11-05 → 2026-11-07/);
  });

  it('flags an index that does not match the files', () => {
    expect(run(grids, null).problems).toContain('index.json is missing');
    const stale = buildIndex(grids.slice(0, 10));
    expect(run(grids, stale).problems).toContain('index.json does not list exactly the grid files');
  });

  it('flags a category that comes back before the floor', () => {
    const repeated = grids.map((g, i) =>
      i === 1
        ? { ...g, rows: [(grids[0] as Grid).rows[0], g.rows[1], g.rows[2]] as Grid['rows'] }
        : g,
    );
    expect(run(repeated).problems.join('\n')).toMatch(/category "[a-z0-9-]+" returns after 1 day/);
  });

  it('lists the categories that were never used', () => {
    expect(run(grids.slice(0, 1)).text).toMatch(/never: .*type-/);
    const all = CATEGORIES.length;
    expect(run(grids.slice(0, 1)).text).toContain(`of ${all} used`);
  });
});

/** The same memberships after a data fix: every cell gains one answer (a Pokémon that is not in the pool). */
const grown = (extra: number): Memberships =>
  Object.assign(Object.create(memberships) as Memberships, {
    answersFor: (...args: Parameters<Memberships['answersFor']>) => [
      ...memberships.answersFor(...args),
      ...Array.from({ length: extra }, (_, i) => 9000 + i),
    ],
  });

/** …or after a data change that leaves every cell with two answers. */
const thin = (): Memberships =>
  Object.assign(Object.create(memberships) as Memberships, {
    answersFor: (...args: Parameters<Memberships['answersFor']>) =>
      memberships.answersFor(...args).slice(0, 2),
  });

describe('frozen grids (today and the past)', () => {
  const analyze = (list: readonly Grid[], world: Memberships, today: string) =>
    analyzeGrids(list, world, popularity, config, buildIndex(list), undefined, today);

  it('reports exactly what checkGrid reports, split in hard and soft', () => {
    for (const grid of grids.slice(0, 5)) {
      expect(frozenGridFindings(grid, memberships)).toEqual({ hard: [], soft: [] });
    }
    const drifted = frozenGridFindings(grids[0] as Grid, grown(1));
    expect(drifted.hard).toEqual([]);
    expect(drifted.soft.length).toBeGreaterThanOrEqual(9); // 9 stated cell sizes are now wrong
    expect(frozenGridFindings(grids[0] as Grid, thin()).hard.length).toBeGreaterThan(0);
  });

  it('does not fail on a data change that shifts the cell sizes of a past grid (a warning)', () => {
    const world = grown(2);
    const past = analyze(grids, world, AFTER_ALL);
    expect(past.problems).toEqual([]);
    expect(past.warnings.join('\n')).toMatch(/answers, not /);
    expect(past.text).toMatch(/warning\(s\) on grids already public.*not blocking/);
    expect(past.text).toContain('No problem found.');
  });

  it('still fails on the same data change for grids that are not public yet', () => {
    const future = analyze(grids, grown(2), BEFORE_ALL);
    expect(future.problems.join('\n')).toMatch(/answers, not /);
    expect(future.warnings).toEqual([]);
  });

  it('mixes both: only the public part is forgiven', () => {
    const today = (grids[19] as Grid).date; // 20 public grids, 20 to come
    const { problems, warnings } = analyze(grids, grown(1), today);
    expect(warnings.length).toBeGreaterThan(0);
    expect(problems.length).toBeGreaterThan(0);
    for (const line of problems) {
      const date = /\((\d{4}-\d{2}-\d{2})\)/.exec(line)?.[1];
      if (date) expect(date > today).toBe(true);
    }
  });

  it('fails when a cell of a past grid has fewer than 3 answers', () => {
    const { problems } = analyze(grids.slice(0, 3), thin(), AFTER_ALL);
    expect(problems.join('\n')).toMatch(/has 2 answers \(at least 3 needed\)/);
  });

  it('fails on a category that no longer exists, a pair that cannot cross, or a wrong number', () => {
    const unknown = grids.map((g, i) =>
      i === 0 ? { ...g, rows: ['gone-forever', g.rows[1], g.rows[2]] as Grid['rows'] } : g,
    );
    expect(analyze(unknown, memberships, AFTER_ALL).problems.join('\n')).toMatch(
      /unknown category "gone-forever"/,
    );
    const renumbered = grids.map((g, i) => (i === 2 ? { ...g, id: 99 } : g));
    expect(analyze(renumbered, memberships, AFTER_ALL).problems.join('\n')).toMatch(
      /id should be 3/,
    );
  });

  it('fails when the same puzzle was published twice, even turned around', () => {
    const [a, b] = grids as [Grid, Grid];
    const twin: Grid = { ...b, rows: a.cols, cols: a.rows, cellSizes: a.cellSizes };
    const { problems } = analyze([a, twin], memberships, AFTER_ALL);
    expect(problems.join('\n')).toMatch(
      /puzzle of 2026-11-02 is the one already published on 2026-11-01/,
    );
  });

  it('turns weekday-level, cooldown and very-hard-week findings into warnings', () => {
    const strict = { ...config, weekdayLevels: { mon: ['veryEasy' as const] } };
    const run2 = (today: string) =>
      analyzeGrids(grids, memberships, popularity, strict, buildIndex(grids), undefined, today);
    expect(run2(AFTER_ALL).problems).toEqual([]);
    expect(run2(AFTER_ALL).warnings.join('\n')).toMatch(
      /mon grid\(s\) outside the accepted levels/,
    );
    expect(run2(BEFORE_ALL).problems.join('\n')).toMatch(/mon grid\(s\) outside/);

    const repeated = grids.map((g, i) =>
      i === 1
        ? { ...g, rows: [(grids[0] as Grid).rows[0], g.rows[1], g.rows[2]] as Grid['rows'] }
        : g,
    );
    const frozen = analyze(repeated, memberships, AFTER_ALL);
    expect(frozen.problems.join('\n')).not.toMatch(/returns after/);
    expect(frozen.warnings.join('\n')).toMatch(/category "[a-z0-9-]+" returns after 1 day/);
    expect(analyze(repeated, memberships, BEFORE_ALL).problems.join('\n')).toMatch(
      /returns after 1 day/,
    );
  });

  it('keeps failing on structural problems: missing days and a wrong index', () => {
    const gap = grids.filter((_, i) => i !== 5);
    expect(analyze(gap, memberships, AFTER_ALL).problems.join('\n')).toMatch(/missing days/);
    expect(
      analyzeGrids(grids, memberships, popularity, config, null, undefined, AFTER_ALL).problems,
    ).toContain('index.json is missing');
  });
});
