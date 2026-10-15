import {
  addDays,
  canCrossCategories,
  CATEGORIES,
  CATEGORY_FAMILIES,
  cellIndex,
  checkGrid,
  daysBetween,
  DIFFICULTY_LEVELS,
  difficultyOf,
  findSolution,
  GRID_RULES,
  GRID_SIZE,
  gridDateFor,
  gridDifficulty,
  gridNumber,
  hasFamilyDiversity,
  type Category,
  type DifficultyLevel,
  type Grid,
  type GridDate,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { WEEKDAYS, type GeneratorConfig } from './config';
import { weekdayOf } from './generate';
import { buildIndex, type GridIndex } from './files';

export interface CooldownFinding {
  kind: 'category' | 'pair';
  what: string;
  dates: [string, string];
  gap: number;
}

/**
 * Where a category (or a row × column pair) comes back sooner than allowed. Category repeats
 * under the target but at or over the configured floor are reported as `relaxed`, not as errors:
 * the generator shortens that cooldown on purpose when it has to.
 */
export function cooldownFindings(
  grids: readonly Grid[],
  config: GeneratorConfig,
): { relaxed: CooldownFinding[]; violations: CooldownFinding[] } {
  const relaxed: CooldownFinding[] = [];
  const violations: CooldownFinding[] = [];
  const sorted = [...grids].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i] as Grid;
      const b = sorted[j] as Grid;
      const gap = daysBetween(a.date, b.date);
      if (gap >= Math.max(config.cooldown.categoryDays, config.cooldown.pairDays)) break;

      if (gap < config.cooldown.categoryDays) {
        const shared = [...a.rows, ...a.cols].filter((id) => [...b.rows, ...b.cols].includes(id));
        for (const what of shared) {
          const finding: CooldownFinding = { kind: 'category', what, dates: [a.date, b.date], gap };
          (gap < config.cooldown.minCategoryDays ? violations : relaxed).push(finding);
        }
      }
      if (gap < config.cooldown.pairDays) {
        const pairsOf = (g: Grid) =>
          new Set(g.rows.flatMap((r) => g.cols.map((c) => [r, c].sort().join(' × '))));
        const second = pairsOf(b);
        for (const what of pairsOf(a)) {
          if (second.has(what))
            violations.push({ kind: 'pair', what, dates: [a.date, b.date], gap });
        }
      }
    }
  }
  return { relaxed, violations };
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
}

export interface GridReport {
  text: string;
  /** Rule breaks: the command fails when there are any. */
  problems: string[];
  /**
   * Drift of grids that are already public (today and the past): printed, never blocking. A data
   * fix can move a cell size or a difficulty level; a published grid is history and is not redone.
   */
  warnings: string[];
}

export interface GridFindings {
  /** Invariants without which the grid cannot be played. */
  hard: string[];
  /** Drift from the rules a *new* grid must obey (sizes, difficulty, variety). */
  soft: string[];
}

/**
 * The rules of `checkGrid`, split for a grid that is already public. Hard: the categories exist and
 * can cross, every cell keeps at least `minAnswers` answers, 9 different Pokémon can still fill
 * the grid, the number matches the date. Soft: the stated cell sizes, the 80-answer ceiling, the
 * stated difficulty and the variety of families, which a data change can move without making the
 * grid unplayable. `hard` and `soft` together hold exactly what `checkGrid` reports.
 */
export function frozenGridFindings(
  grid: Grid,
  memberships: Memberships,
  categories: readonly Category[] = CATEGORIES,
): GridFindings {
  const hard: string[] = [];
  const soft: string[] = [];
  const label = `grid ${grid.id} (${grid.date})`;
  const byId = new Map(categories.map((c) => [c.id, c]));

  if (grid.id !== gridNumber(grid.date)) {
    hard.push(`${label}: id should be ${gridNumber(grid.date)}`);
  }
  const ids = [...grid.rows, ...grid.cols];
  const rows: Category[] = [];
  const cols: Category[] = [];
  for (const [list, into] of [
    [grid.rows, rows],
    [grid.cols, cols],
  ] as const) {
    for (const id of list) {
      const category = byId.get(id);
      if (category) into.push(category);
      else hard.push(`${label}: unknown category "${id}"`);
    }
  }
  if (rows.length !== GRID_SIZE || cols.length !== GRID_SIZE) return { hard, soft };
  if (new Set(ids).size !== ids.length) hard.push(`${label}: a category appears twice`);
  if (!hasFamilyDiversity(rows, cols)) soft.push(`${label}: not enough variety of families`);

  rows.forEach((row, r) =>
    cols.forEach((col, c) => {
      const where = `${row.id} × ${col.id}`;
      if (!canCrossCategories(row, col)) hard.push(`${label}: ${where} must never cross`);
      const actual = memberships.answersFor(row, col).length;
      const stated = grid.cellSizes[cellIndex(r, c)];
      if (actual < GRID_RULES.minAnswers) {
        hard.push(
          `${label}: ${where} has ${actual} answers (at least ${GRID_RULES.minAnswers} needed)`,
        );
      } else if (actual > GRID_RULES.maxAnswers) {
        soft.push(
          `${label}: ${where} has ${actual} answers (usual maximum ${GRID_RULES.maxAnswers})`,
        );
      }
      if (stated !== actual) soft.push(`${label}: ${where} has ${actual} answers, not ${stated}`);
    }),
  );
  if (grid.difficulty !== difficultyOf(grid.cellSizes)) {
    soft.push(`${label}: difficulty should be ${difficultyOf(grid.cellSizes)}`);
  }
  if (hard.length === 0 && findSolution(grid, memberships) === null) {
    hard.push(`${label}: no set of 9 different Pokémon fills it`);
  }
  return { hard, soft };
}

/** The same puzzle, whichever way it is turned: rows and columns swapped, lines in any order. */
function puzzleKey(grid: Grid): string {
  const sides = [[...grid.rows].sort().join(','), [...grid.cols].sort().join(',')].sort();
  return sides.join(' | ');
}

export function analyzeGrids(
  grids: readonly Grid[],
  memberships: Memberships,
  popularity: Popularity,
  config: GeneratorConfig,
  index: GridIndex | null,
  categories: readonly Category[] = CATEGORIES,
  today: GridDate = gridDateFor(new Date()),
): GridReport {
  const sorted = [...grids].sort((a, b) => a.date.localeCompare(b.date));
  const problems: string[] = [];
  const warnings: string[] = [];
  // A grid dated today or earlier is public: only its hard invariants can fail the report.
  const isFrozen = (date: GridDate) => date <= today;
  for (const grid of sorted) {
    if (isFrozen(grid.date)) {
      const { hard, soft } = frozenGridFindings(grid, memberships, categories);
      problems.push(...hard);
      warnings.push(...soft);
    } else {
      problems.push(...checkGrid(grid, memberships, { categories }));
    }
  }

  const seen = new Map<string, Grid>();
  for (const grid of sorted) {
    const key = puzzleKey(grid);
    const first = seen.get(key);
    if (first)
      problems.push(`the puzzle of ${grid.date} is the one already published on ${first.date}`);
    else seen.set(key, grid);
  }

  // Dates: no gaps, no duplicates.
  const gaps: string[] = [];
  sorted.forEach((grid, i) => {
    const previous = sorted[i - 1];
    if (previous && daysBetween(previous.date, grid.date) !== 1) {
      gaps.push(`${previous.date} → ${grid.date}`);
    }
  });
  if (gaps.length > 0) problems.push(`missing days: ${gaps.join(', ')}`);

  const expectedIndex = buildIndex(sorted);
  if (index === null) problems.push('index.json is missing');
  else if (JSON.stringify(index) !== JSON.stringify(expectedIndex)) {
    problems.push('index.json does not list exactly the grid files');
  }

  const { relaxed, violations } = cooldownFindings(sorted, config);
  for (const v of violations) {
    const line = `${v.kind} "${v.what}" returns after ${v.gap} day(s): ${v.dates.join(' and ')}`;
    // Judged on the later grid: a new grid must respect the cooldowns, a published pair is history.
    (isFrozen(v.dates[1]) ? warnings : problems).push(line);
  }

  const lines: string[] = [];
  const first = sorted[0];
  const last = sorted.at(-1);
  lines.push(
    sorted.length === 0
      ? 'No grid.'
      : `${sorted.length} grids, #${first?.id} (${first?.date}) to #${last?.id} (${last?.date})`,
  );

  if (sorted.length > 0) {
    const sizeDifficulty = sorted.map((g) => g.difficulty);
    lines.push(
      '',
      `Size difficulty (0 easy - 100 hard, number of answers only): min ${Math.min(...sizeDifficulty)}, average ${average(sizeDifficulty).toFixed(0)}, max ${Math.max(...sizeDifficulty)}`,
    );

    // The level players see: size, obscurity and mass of the answers (see `gridDifficulty`).
    // A grid with an unknown category is already a problem above: it has no level to show.
    const levels = new Map<GridDate, DifficultyLevel>();
    for (const g of sorted) {
      try {
        levels.set(g.date, gridDifficulty(g, memberships, popularity).level);
      } catch {
        /* reported as a problem */
      }
    }
    lines.push('', `Level by weekday (${DIFFICULTY_LEVELS.join(' / ')}):`);
    for (const day of [...WEEKDAYS.slice(1), WEEKDAYS[0]]) {
      const ofDay = sorted.filter((g) => weekdayOf(g.date) === day);
      const counts = DIFFICULTY_LEVELS.map(
        (level) => ofDay.filter((g) => levels.get(g.date) === level).length,
      );
      const accepted = config.weekdayLevels[day];
      const outsideOf = (list: readonly Grid[]) =>
        accepted
          ? list.filter((g) => !accepted.includes(levels.get(g.date) as DifficultyLevel)).length
          : 0;
      for (const [list, into] of [
        [ofDay.filter((g) => isFrozen(g.date)), warnings],
        [ofDay.filter((g) => !isFrozen(g.date)), problems],
      ] as const) {
        const outside = outsideOf(list);
        if (outside > 0)
          into.push(
            `${outside} ${day} grid(s) outside the accepted levels ${accepted?.join(', ')}`,
          );
      }
      lines.push(
        `  ${day}: ${ofDay.length} grids, ${counts.join(' / ')}` +
          (accepted ? `  (accepted: ${accepted.join(', ')})` : ''),
      );
    }

    // At most one very hard grid per calendar week (Monday to Sunday).
    const veryHardPerWeek = new Map<string, number>();
    const lastVeryHard = new Map<string, GridDate>();
    for (const g of sorted) {
      if (levels.get(g.date) !== 'veryHard') continue;
      const monday = addDays(g.date, -((WEEKDAYS.indexOf(weekdayOf(g.date)) + 6) % 7));
      veryHardPerWeek.set(monday, (veryHardPerWeek.get(monday) ?? 0) + 1);
      lastVeryHard.set(monday, g.date);
    }
    for (const [monday, n] of veryHardPerWeek) {
      // A week whose last very hard grid is public is history; a week still being filled is strict.
      if (n > 1)
        (isFrozen(lastVeryHard.get(monday) as GridDate) ? warnings : problems).push(
          `${n} very hard grids in the week of ${monday}`,
        );
    }
    lines.push(
      `Very hard grids: ${[...veryHardPerWeek.values()].reduce((a, b) => a + b, 0)}, at most one per week`,
    );

    const sizes = sorted.flatMap((g) => g.cellSizes);
    lines.push(
      '',
      `Cells: ${sizes.length}, answers per cell min ${Math.min(...sizes)}, median ${median(sizes)}, max ${Math.max(...sizes)}; ` +
        `${sizes.filter((s) => s <= 5).length} cells have 5 answers or fewer`,
    );

    const uses = new Map<string, number>(categories.map((c) => [c.id, 0]));
    for (const g of sorted)
      for (const id of [...g.rows, ...g.cols]) uses.set(id, (uses.get(id) ?? 0) + 1);
    const ranked = [...uses].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    const never = ranked.filter(([, n]) => n === 0).map(([id]) => id);
    lines.push(
      '',
      `Categories: ${ranked.length - never.length} of ${ranked.length} used`,
      `  most:  ${ranked
        .slice(0, 5)
        .map(([id, n]) => `${id} ${n}`)
        .join(', ')}`,
      `  least: ${ranked
        .filter(([, n]) => n > 0)
        .slice(-5)
        .reverse()
        .map(([id, n]) => `${id} ${n}`)
        .join(', ')}`,
      `  never: ${never.length === 0 ? 'none' : never.join(', ')}`,
    );

    const familyOf = new Map(categories.map((c) => [c.id, c.family]));
    const perFamily = new Map<string, number>();
    for (const [id, n] of uses)
      perFamily.set(
        familyOf.get(id) as string,
        (perFamily.get(familyOf.get(id) as string) ?? 0) + n,
      );
    const total = [...perFamily.values()].reduce((s, n) => s + n, 0);
    lines.push(
      'Families: ' +
        CATEGORY_FAMILIES.map(
          (f) => `${f} ${(((perFamily.get(f) ?? 0) / total) * 100).toFixed(0)}%`,
        ).join(', '),
    );

    const byGap = new Map<number, number>();
    for (const r of relaxed) byGap.set(r.gap, (byGap.get(r.gap) ?? 0) + 1);
    lines.push(
      '',
      relaxed.length === 0
        ? `Category cooldown (${config.cooldown.categoryDays} days): always respected`
        : `Category cooldown (target ${config.cooldown.categoryDays} days, floor ${config.cooldown.minCategoryDays}): came back early ${relaxed.length} time(s) — ` +
            [...byGap]
              .sort(([a], [b]) => a - b)
              .map(([gap, n]) => `${n}× at ${gap} days`)
              .join(', '),
      `Pair cooldown (${config.cooldown.pairDays} days): ${violations.some((v) => v.kind === 'pair') ? 'BROKEN' : 'respected'}`,
    );
  }

  if (warnings.length > 0) {
    lines.push(
      '',
      `${warnings.length} warning(s) on grids already public (${today} and before), not blocking:`,
      ...warnings.map((w) => `  ~ ${w}`),
    );
  }
  lines.push(
    '',
    problems.length === 0 ? 'No problem found.' : `${problems.length} problem(s):`,
    ...problems.map((p) => `  ! ${p}`),
  );
  return { text: lines.join('\n'), problems, warnings };
}
