import {
  CATEGORIES,
  checkGrid,
  daysBetween,
  findSolution,
  gridDifficulty,
  gridNumber,
  GRID_RULES,
  LAUNCH_DATE,
  type Grid,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type GeneratorConfig } from './config';
import { createGenerator, dateRange, GenerationError, seedFromDate, weekdayOf } from './generate';
import { cooldownFindings } from './report';
import { realWorld } from './test-world';

let memberships: Memberships;
let popularity: Popularity;
let config: GeneratorConfig;
let generate: ReturnType<typeof createGenerator>;

const DAYS = 1000;
let grids: Grid[];
let cooldowns: number[];

beforeAll(async () => {
  ({ memberships, popularity } = await realWorld());
  config = await loadConfig();
  generate = createGenerator({ memberships, popularity, config });
  grids = [];
  cooldowns = [];
  for (const date of dateRange(LAUNCH_DATE, DAYS)) {
    const result = generate({ date, history: grids });
    grids.push(result.grid);
    cooldowns.push(result.categoryCooldownDays);
  }
}, 300_000);

describe(`${DAYS} consecutive grids on the real data`, () => {
  it('are all valid: variety, crossing rules, 3 to 80 answers per cell, 9 different Pokémon', () => {
    const problems = grids.flatMap((g) => checkGrid(g, memberships));
    expect(problems).toEqual([]);
    expect(grids).toHaveLength(DAYS);
  });

  it('can all be completed with 9 different Pokémon (no impossible grid)', () => {
    for (const g of grids) {
      const solution = findSolution(g, memberships);
      expect(solution, `grid ${g.id}`).not.toBeNull();
      expect(new Set(solution).size).toBe(9);
    }
  });

  it('never make a cell where one criterion implies the other', () => {
    const size = (id: string) => memberships.answersFor(id, id).length;
    for (const g of grids) {
      g.cellSizes.forEach((n, i) => {
        const row = g.rows[Math.floor(i / 3)] as string;
        const col = g.cols[i % 3] as string;
        expect(n, `grid ${g.id} cell ${i}`).toBeLessThan(Math.min(size(row), size(col)));
      });
    }
  });

  it('keep the spelling family to a minority of the grids (its weight alone does not)', () => {
    const withName = grids.filter((g) =>
      [...g.rows, ...g.cols].some((id) => id.startsWith('name-')),
    );
    expect(withName.length / grids.length).toBeLessThan(0.4);
  });

  it('keep every cell between the answer bounds', () => {
    const sizes = grids.flatMap((g) => g.cellSizes);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(GRID_RULES.minAnswers);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(GRID_RULES.maxAnswers);
  });

  it('are numbered from the launch date, one per day', () => {
    grids.forEach((g, i) => {
      expect(g.id).toBe(i + 1);
      expect(g.id).toBe(gridNumber(g.date));
    });
    expect(grids[0]?.date).toBe(LAUNCH_DATE);
  });

  it('never bring a row × column pair back within 30 days', () => {
    const { violations } = cooldownFindings(grids, config);
    expect(violations.filter((v) => v.kind === 'pair')).toEqual([]);
  });

  it('never bring a category back sooner than the configured floor, and rarely sooner than the target', () => {
    const { violations, relaxed } = cooldownFindings(grids, config);
    expect(violations).toEqual([]);
    for (const r of relaxed) expect(r.gap).toBeGreaterThanOrEqual(config.cooldown.minCategoryDays);
    // The target is honoured on most days; a shorter cooldown is the exception.
    expect(cooldowns.filter((c) => c === config.cooldown.categoryDays).length).toBeGreaterThan(
      DAYS * 0.3,
    );
    expect(Math.min(...cooldowns)).toBeGreaterThanOrEqual(config.cooldown.minCategoryDays);
  });

  it('follow the difficulty levels accepted on their weekday', () => {
    for (const g of grids) {
      const accepted = config.weekdayLevels[weekdayOf(g.date)];
      if (!accepted) continue;
      const { level } = gridDifficulty(g, memberships, popularity);
      expect(accepted, `${g.date} (${weekdayOf(g.date)}) is ${level}`).toContain(level);
    }
  });

  it('have at most one very hard grid per week, always on a Sunday', () => {
    const veryHard = grids.filter(
      (g) => gridDifficulty(g, memberships, popularity).level === 'veryHard',
    );
    expect(veryHard.length).toBeGreaterThan(DAYS / 7 - 5);
    for (const g of veryHard) expect(weekdayOf(g.date)).toBe('sun');
  });

  it('get harder from Monday to Sunday on average', () => {
    const average = (day: string) => {
      const scores = grids
        .filter((g) => weekdayOf(g.date) === day)
        .map((g) => gridDifficulty(g, memberships, popularity).score);
      return scores.reduce((s, v) => s + v, 0) / scores.length;
    };
    expect(average('mon')).toBeLessThan(average('wed'));
    expect(average('wed')).toBeLessThan(average('fri'));
    expect(average('fri')).toBeLessThan(average('sun'));
  });

  it('use every category, and the rare "bonus" ones less than the others', () => {
    const uses = new Map<string, number>(CATEGORIES.map((c) => [c.id, 0]));
    for (const g of grids)
      for (const id of [...g.rows, ...g.cols]) uses.set(id, (uses.get(id) ?? 0) + 1);
    expect([...uses].filter(([, n]) => n === 0)).toEqual([]);
    const mean = (list: typeof CATEGORIES) =>
      list.reduce((s, c) => s + (uses.get(c.id) ?? 0), 0) / list.length;
    expect(mean(CATEGORIES.filter((c) => c.bonus))).toBeLessThan(
      mean(CATEGORIES.filter((c) => !c.bonus)),
    );
  });

  it('are all different from each other, even turned sideways', () => {
    const key = (rows: readonly string[], cols: readonly string[]) =>
      JSON.stringify([[...rows].sort(), [...cols].sort()]);
    const keys = grids.map((g) => key(g.rows, g.cols));
    expect(new Set(keys).size).toBe(DAYS);
    const sideways = new Set(grids.map((g) => key(g.cols, g.rows)));
    expect(keys.filter((k) => sideways.has(k))).toEqual([]);
  });
});

describe('determinism', () => {
  it('gives the same grid for the same date, history and seed', () => {
    const history = grids.slice(0, 40);
    const date = grids[40]?.date as string;
    expect(generate({ date, history })).toEqual(generate({ date, history }));
    expect(generate({ date, history }).grid).toEqual(grids[40]);
  });

  it('does not depend on the order of the history', () => {
    const history = grids.slice(10, 50);
    const date = grids[50]?.date as string;
    expect(generate({ date, history: [...history].reverse() }).grid).toEqual(
      generate({ date, history }).grid,
    );
  });

  it('is rebuilt identically by a fresh generator', () => {
    const again = createGenerator({ memberships, popularity, config });
    const history: Grid[] = [];
    for (const date of dateRange(LAUNCH_DATE, 30)) history.push(again({ date, history }).grid);
    expect(history).toEqual(grids.slice(0, 30));
  });

  it('derives the default seed from the date alone', () => {
    expect(seedFromDate('2026-11-01')).toBe(seedFromDate('2026-11-01'));
    expect(seedFromDate('2026-11-01')).not.toBe(seedFromDate('2026-11-02'));
    const date = '2027-06-15';
    expect(generate({ date, history: [] }).grid).toEqual(
      generate({ date, history: [], seed: seedFromDate(date) }).grid,
    );
  });

  it('gives another grid for another seed', () => {
    const date = '2027-06-15';
    const a = generate({ date, history: [], seed: 1 }).grid;
    const b = generate({ date, history: [], seed: 2 }).grid;
    expect(a).not.toEqual(b);
    expect(checkGrid(b, memberships)).toEqual([]);
  });

  it('ignores a grid already published for the same date', () => {
    const date = grids[20]?.date as string;
    const withSelf = generate({ date, history: grids.slice(0, 21) }).grid;
    const without = generate({ date, history: grids.slice(0, 20) }).grid;
    expect(withSelf).toEqual(without);
  });
});

describe('cooldowns', () => {
  it('see grids on both sides of the date, so any order of generation is safe', () => {
    const date = grids[100]?.date as string;
    const around = [...grids.slice(90, 100), ...grids.slice(101, 112)];
    const { grid } = generate({ date, history: around });
    const sharing = (g: Grid) =>
      [...g.rows, ...g.cols].filter((id) => [...grid.rows, ...grid.cols].includes(id));
    for (const other of around) {
      const gap = Math.abs(daysBetween(other.date, date));
      if (gap < config.cooldown.minCategoryDays) expect(sharing(other), other.date).toEqual([]);
    }
    expect(checkGrid(grid, memberships)).toEqual([]);
  });

  it('keep a pair away for 30 days whatever the side', () => {
    const date = grids[200]?.date as string;
    const around = grids.slice(171, 230).filter((g) => g.date !== date);
    const { grid } = generate({ date, history: around });
    const pairs = new Set(
      around.flatMap((g) => g.rows.flatMap((r) => g.cols.map((c) => [r, c].sort().join('|')))),
    );
    for (const r of grid.rows)
      for (const c of grid.cols) expect(pairs.has([r, c].sort().join('|'))).toBe(false);
  });
});

describe('when no grid is possible', () => {
  it('fails loudly with the reasons, instead of publishing something invalid', () => {
    const strict = createGenerator({
      memberships,
      popularity,
      config: {
        ...config,
        // A month of cooldown with only a few days of history to stay clear of: impossible.
        cooldown: { categoryDays: 40, minCategoryDays: 40, pairDays: 30 },
        attemptsPerStage: 30,
      },
    });
    const history = grids.slice(0, 12);
    const date = grids[12]?.date as string;
    expect(() => strict({ date, history })).toThrow(GenerationError);
    try {
      strict({ date, history });
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const failure = error as GenerationError;
      expect(failure.date).toBe(date);
      expect(failure.attempts).toBe(30);
      expect(Object.keys(failure.rejections).length).toBeGreaterThan(0);
      expect(failure.message).toMatch(new RegExp(`No valid grid for ${date}`));
    }
  });

  it('reports an unreachable difficulty target as such', () => {
    const impossible = createGenerator({
      memberships,
      // Every Pokémon equally famous: every grid is easy to think of, so none can be very hard.
      popularity: () => 1,
      config: { ...config, attemptsPerStage: 20, weekdayLevels: { mon: ['veryHard'] } },
    });
    const monday = dateRange(LAUNCH_DATE, 7).find((d) => weekdayOf(d) === 'mon') as string;
    try {
      impossible({ date: monday, history: [] });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as GenerationError).rejections['difficulty target']).toBeGreaterThan(0);
    }
  });
});

describe('weekdayOf', () => {
  it('reads the calendar date, whatever the time zone of the machine', () => {
    expect(weekdayOf('2026-11-01')).toBe('sun');
    expect(weekdayOf('2026-11-02')).toBe('mon');
    expect(weekdayOf('2026-10-25')).toBe('sun'); // the day the clocks change in Paris
    expect(weekdayOf('2028-02-29')).toBe('tue');
  });
});
