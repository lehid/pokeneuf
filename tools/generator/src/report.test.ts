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
import { analyzeGrids, cooldownFindings } from './report';
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

describe('analyzeGrids', () => {
  const run = (list: readonly Grid[], index: GridIndex | null = buildIndex(list)) =>
    analyzeGrids(list, memberships, popularity, config, index);

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
    const { problems } = analyzeGrids(grids, memberships, popularity, strict, buildIndex(grids));
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
    const { problems } = analyzeGrids(week, memberships, popularity, allVeryHard, buildIndex(week));
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
