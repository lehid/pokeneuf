import { z } from 'zod';
import { canCrossCategories, CATEGORIES, type Category, type CategoryFamily } from './categories';
import { LAUNCH_DATE } from './config';
import { gridNumber, type GridDate } from './date';
import { distinctRepresentatives } from './matching';
import type { Memberships } from './memberships';

/** A grid is 3 rows × 3 columns of categories; each cell needs a Pokémon fitting both. */
export const GRID_SIZE = 3;
export const CELLS = GRID_SIZE * GRID_SIZE;

/** Rules every published grid obeys (ROADMAP §3.4). */
export const GRID_RULES = {
  /** A cell has at least this many valid answers… */
  minAnswers: 3,
  /** …and at most this many (the pool is only 493 Pokémon, so cells are tighter than in a big game). */
  maxAnswers: 80,
  /** No more than this many of the six categories come from the same family. */
  maxPerFamily: 2,
  /** Tighter limits for families that must stay a seasoning: at most one spelling question per grid. */
  maxByFamily: { name: 1 } as Partial<Record<CategoryFamily, number>>,
  /** The six categories span at least this many families… */
  minFamilies: 4,
  /** …and each line (the three rows, the three columns) spans at least this many. */
  minFamiliesPerLine: 2,
} as const;

/** Current layout of a grid file. Bump on any breaking change. */
export const GRID_VERSION = 1;

export type CategoryIds = [string, string, string];

export interface Grid {
  version: number;
  /** Grid number shown to players: days since launch + 1. */
  id: number;
  date: GridDate;
  /** Category ids. */
  rows: CategoryIds;
  cols: CategoryIds;
  /** Number of valid answers per cell, row-major: `cellSizes[cellIndex(row, col)]`. */
  cellSizes: number[];
  /** 0 (easiest) to 100 (hardest): see `difficultyOf`. */
  difficulty: number;
}

const gridDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const categoryIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** Shape of a grid file (`apps/web/public/grids/YYYY-MM-DD.json`). */
export const gridSchema = z.strictObject({
  version: z.literal(GRID_VERSION),
  id: z.number().int(),
  date: gridDateSchema,
  rows: z.tuple([categoryIdSchema, categoryIdSchema, categoryIdSchema]),
  cols: z.tuple([categoryIdSchema, categoryIdSchema, categoryIdSchema]),
  cellSizes: z.array(z.number().int().min(0)).length(GRID_SIZE * GRID_SIZE),
  difficulty: z.number().int().min(0).max(100),
});

// Compile-time guard: the file schema and the `Grid` type describe the same thing.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type SchemaMatchesGrid = Same<z.infer<typeof gridSchema>, Grid> extends true ? true : never;

/** A grid read from untrusted JSON, or `null` if it is not one (wrong shape or other version). */
export function parseGrid(raw: unknown): Grid | null {
  const parsed = gridSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function cellIndex(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

/**
 * How hard a grid is, from the sizes of its cells: a small cell leaves few Pokémon to find.
 * Each cell scores 1 at `minAnswers` and 0 at `maxAnswers` (on a log scale: going from 3 to 6
 * answers matters more than from 60 to 63); the grid score is the mean, as a 0-100 integer.
 */
export function difficultyOf(cellSizes: readonly number[]): number {
  const { minAnswers, maxAnswers } = GRID_RULES;
  const span = Math.log(maxAnswers / minAnswers);
  const cell = (size: number) =>
    Math.min(1, Math.max(0, 1 - Math.log(Math.max(size, 1) / minAnswers) / span));
  const mean = cellSizes.reduce((sum, size) => sum + cell(size), 0) / cellSizes.length;
  return Math.round(mean * 100);
}

/** How many of the six categories of a grid may belong to this family. */
export function familyLimit(family: CategoryFamily): number {
  return GRID_RULES.maxByFamily[family] ?? GRID_RULES.maxPerFamily;
}

/** Number of distinct families among categories. */
export function familyCount(categories: readonly Category[]): number {
  return new Set(categories.map((c) => c.family)).size;
}

/** Does this choice of six categories obey the diversity rules? (Cell sizes are checked apart.) */
export function hasFamilyDiversity(rows: readonly Category[], cols: readonly Category[]): boolean {
  const all = [...rows, ...cols];
  const perFamily = new Map<CategoryFamily, number>();
  for (const c of all) perFamily.set(c.family, (perFamily.get(c.family) ?? 0) + 1);
  return (
    [...perFamily].every(([family, n]) => n <= familyLimit(family)) &&
    perFamily.size >= GRID_RULES.minFamilies &&
    familyCount(rows) >= GRID_RULES.minFamiliesPerLine &&
    familyCount(cols) >= GRID_RULES.minFamiliesPerLine
  );
}

export interface CheckOptions {
  /** Categories the grid may use. Default: the registry. */
  categories?: readonly Category[];
  /** Launch date for the grid number. Default: `LAUNCH_DATE`. Pass `null` to skip that check. */
  launchDate?: GridDate | null;
}

/** Every answer of every cell (row-major), by national number. */
export function cellAnswers(grid: Grid, memberships: Memberships): number[][] {
  return grid.rows.flatMap((row) => grid.cols.map((col) => memberships.answersFor(row, col)));
}

/** One Pokémon per cell, all different, or `null` if the grid cannot be completed. */
export function findSolution(grid: Grid, memberships: Memberships): number[] | null {
  return distinctRepresentatives(cellAnswers(grid, memberships));
}

/**
 * Every way this grid breaks the rules, as readable lines. Empty = publishable.
 * The single source of truth for "is this grid valid": the generator, the report and the tests
 * all go through it.
 */
export function checkGrid(
  grid: Grid,
  memberships: Memberships,
  options: CheckOptions = {},
): string[] {
  const problems: string[] = [];
  const registry = options.categories ?? CATEGORIES;
  const byId = new Map(registry.map((c) => [c.id, c]));
  const label = `grid ${grid.id} (${grid.date})`;

  if (grid.version !== GRID_VERSION) problems.push(`${label}: version ${grid.version}`);
  if (grid.rows.length !== GRID_SIZE || grid.cols.length !== GRID_SIZE) {
    return [...problems, `${label}: needs ${GRID_SIZE} rows and ${GRID_SIZE} columns`];
  }
  if (grid.cellSizes.length !== CELLS) {
    return [...problems, `${label}: needs ${CELLS} cell sizes, has ${grid.cellSizes.length}`];
  }

  const launch = options.launchDate === undefined ? LAUNCH_DATE : options.launchDate;
  if (launch !== null && grid.id !== gridNumber(grid.date, launch)) {
    problems.push(`${label}: id should be ${gridNumber(grid.date, launch)}`);
  }

  const rows: Category[] = [];
  const cols: Category[] = [];
  for (const [ids, into] of [
    [grid.rows, rows],
    [grid.cols, cols],
  ] as const) {
    for (const id of ids) {
      const category = byId.get(id);
      if (category) into.push(category);
      else problems.push(`${label}: unknown category "${id}"`);
    }
  }
  if (rows.length !== GRID_SIZE || cols.length !== GRID_SIZE) return problems;

  const ids = [...grid.rows, ...grid.cols];
  if (new Set(ids).size !== ids.length) problems.push(`${label}: a category appears twice`);

  if (!hasFamilyDiversity(rows, cols)) {
    problems.push(`${label}: not enough variety of families`);
  }

  rows.forEach((row, r) =>
    cols.forEach((col, c) => {
      const where = `${row.id} × ${col.id}`;
      if (!canCrossCategories(row, col)) problems.push(`${label}: ${where} must never cross`);
      const actual = memberships.answersFor(row, col).length;
      const stated = grid.cellSizes[cellIndex(r, c)];
      if (stated !== actual)
        problems.push(`${label}: ${where} has ${actual} answers, not ${stated}`);
      if (actual < GRID_RULES.minAnswers || actual > GRID_RULES.maxAnswers) {
        problems.push(
          `${label}: ${where} has ${actual} answers (allowed ${GRID_RULES.minAnswers}-${GRID_RULES.maxAnswers})`,
        );
      }
    }),
  );

  if (grid.difficulty !== difficultyOf(grid.cellSizes)) {
    problems.push(`${label}: difficulty should be ${difficultyOf(grid.cellSizes)}`);
  }

  if (problems.length === 0 && findSolution(grid, memberships) === null) {
    problems.push(`${label}: no set of 9 different Pokémon fills it`);
  }
  return problems;
}
