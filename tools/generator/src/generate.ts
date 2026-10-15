import {
  addDays,
  canCrossCategories,
  CATEGORIES,
  cellAnswers,
  daysBetween,
  difficultyOf,
  gridDifficulty,
  distinctRepresentatives,
  familyLimit,
  GRID_RULES,
  GRID_SIZE,
  GRID_VERSION,
  gridNumber,
  hasFamilyDiversity,
  LAUNCH_DATE,
  type Category,
  type CategoryFamily,
  type Grid,
  type GridDate,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { categoryWeights, WEEKDAYS, type GeneratorConfig } from './config';
import { PairTable } from './pairs';
import { hashString, mulberry32, weightedIndex, type Random } from './rng';

/** Identity of a puzzle: its rows and columns, in any order. */
function puzzleKey(rows: readonly string[], cols: readonly string[]): string {
  return JSON.stringify([[...rows].sort(), [...cols].sort()]);
}

export interface GeneratorContext {
  memberships: Memberships;
  /** How well known each Pokémon is (the `pop` of the Pokédex): part of what makes a grid hard. */
  popularity: Popularity;
  config: GeneratorConfig;
  /** Categories to draw from. Default: the whole registry. */
  categories?: readonly Category[];
  /** Day of grid #1. Default: `LAUNCH_DATE`. */
  launchDate?: GridDate;
}

export interface GenerateInput {
  date: GridDate;
  /** Default: derived from the date, so the same date always gives the same grid. */
  seed?: number;
  /** Grids already published or planned; they drive the cooldowns. A grid of `date` itself is ignored. */
  history: readonly Grid[];
}

export interface Generated {
  grid: Grid;
  /** Draws it took, over all stages (1 = the first try worked). */
  attempts: number;
  /** Cooldown actually applied to categories: below the configured target when it had to be relaxed. */
  categoryCooldownDays: number;
}

/** Why draws were thrown away: handy to understand a failure or to tune the config. */
export type Rejections = Record<string, number>;

export class GenerationError extends Error {
  constructor(
    readonly date: GridDate,
    readonly attempts: number,
    readonly rejections: Rejections,
  ) {
    super(
      `No valid grid for ${date} after ${attempts} draws. Rejected: ${
        Object.entries(rejections)
          .map(([reason, n]) => `${reason} ${n}`)
          .join(', ') || 'nothing'
      }`,
    );
  }
}

export function seedFromDate(date: GridDate): number {
  return hashString(`pokeneuf:grid:${date}`);
}

export function weekdayOf(date: GridDate): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as (typeof WEEKDAYS)[number];
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Draws without replacement, by weight, among the candidates `accept` lets through. */
function draw(
  pool: readonly Category[],
  count: number,
  weights: ReadonlyMap<string, number>,
  random: Random,
  accept: (chosen: readonly Category[], candidate: Category) => boolean,
): Category[] | null {
  const chosen: Category[] = [];
  while (chosen.length < count) {
    const candidates = pool.filter((c) => !chosen.includes(c) && accept(chosen, c));
    if (candidates.length === 0) return null;
    const index = weightedIndex(
      candidates.map((c) => weights.get(c.id) as number),
      random,
    );
    chosen.push(candidates[index] as Category);
  }
  return chosen;
}

/**
 * Builds the generator: `generate({ date, seed, history })` → a grid (ROADMAP §3.4).
 *
 * A grid is valid when (see `checkGrid`): 3 rows and 3 columns of distinct categories that may
 * cross and come from varied families; every cell has 3 to 80 answers; 9 different Pokémon can
 * fill it. On top of that the generator applies the cooldowns (category, row × column pair), the
 * family weights and the difficulty levels accepted on that weekday.
 *
 * Deterministic: the same inputs always give the same grid.
 */
export function createGenerator(context: GeneratorContext): (input: GenerateInput) => Generated {
  const { memberships, popularity, config } = context;
  const categories = context.categories ?? CATEGORIES;
  const launchDate = context.launchDate ?? LAUNCH_DATE;
  const weights = categoryWeights(categories, config);
  const pairs = new PairTable(memberships, categories);
  const { minAnswers, maxAnswers } = GRID_RULES;

  const familyCount = (list: readonly Category[], family: CategoryFamily) =>
    list.filter((c) => c.family === family).length;

  const totalWeight = [...weights.values()].reduce((sum, w) => sum + w, 0);

  /** Weights nudged toward each category's fair share of the recent grids (see `balanceWindowDays`). */
  function balancedWeights(date: GridDate, history: readonly Grid[]): ReadonlyMap<string, number> {
    const window = config.balanceWindowDays;
    if (window === 0) return weights;
    const recent = history.filter(
      (g) => g.date !== date && Math.abs(daysBetween(g.date, date)) <= window,
    );
    const used = new Map<string, number>();
    for (const g of recent)
      for (const id of [...g.rows, ...g.cols]) used.set(id, (used.get(id) ?? 0) + 1);
    const slots = recent.length * 2 * GRID_SIZE;
    return new Map(
      [...weights].map(([id, weight]) => {
        const expected = (weight / totalWeight) * slots;
        const boost = (expected + 1) / ((used.get(id) ?? 0) + 1);
        return [id, weight * Math.min(5, Math.max(0.2, boost))];
      }),
    );
  }

  const familyOf = new Map(categories.map((c) => [c.id, c.family]));

  /** Families whose cap (`familyWindow`: at most `max` grids in the `windowDays` centred on `date`) is reached. */
  function capped(date: GridDate, history: readonly Grid[]): Set<CategoryFamily> {
    const out = new Set<CategoryFamily>();
    for (const [family, rule] of Object.entries(config.familyWindow) as [
      CategoryFamily,
      { windowDays: number; max: number },
    ][]) {
      const used = history.filter(
        (g) =>
          g.date !== date &&
          Math.abs(daysBetween(g.date, date)) <= Math.floor(rule.windowDays / 2) &&
          [...g.rows, ...g.cols].some((id) => familyOf.get(id) === family),
      ).length;
      // `max` counts the grid being drawn too: the others in the window must leave room for it.
      if (used >= rule.max - 1) out.add(family);
    }
    return out;
  }

  return ({ date, seed = seedFromDate(date), history }) => {
    const candidate = (
      rows: readonly Category[],
      cols: readonly Category[],
      cellSizes: number[],
      difficulty = difficultyOf(cellSizes),
    ): Grid => ({
      version: GRID_VERSION,
      id: gridNumber(date, launchDate),
      date,
      rows: rows.map((c) => c.id) as Grid['rows'],
      cols: cols.map((c) => c.id) as Grid['cols'],
      cellSizes,
      difficulty,
    });
    const random = mulberry32(seed);
    const rejections: Rejections = {};
    const reject = (reason: string) => {
      rejections[reason] = (rejections[reason] ?? 0) + 1;
    };

    // Cooldowns look at both sides of the date: grids can be generated in any order.
    const near = (g: Grid, window: number) =>
      g.date !== date && Math.abs(daysBetween(g.date, date)) < window;
    const recentPairs = new Set<string>();
    for (const g of history) {
      if (!near(g, config.cooldown.pairDays)) continue;
      for (const r of g.rows) for (const c of g.cols) recentPairs.add(pairKey(r, c));
    }
    // The same puzzle, even turned sideways, is never published twice (whatever the days between).
    const seen = new Set<string>();
    for (const g of history) {
      if (g.date !== date) seen.add(puzzleKey(g.rows, g.cols)).add(puzzleKey(g.cols, g.rows));
    }
    const weightsNow = balancedWeights(date, history);
    const accepted = config.weekdayLevels[weekdayOf(date)];
    let attempts = 0;

    // The category cooldown is a target: when it leaves no valid grid, shorten it one day at a time.
    for (
      let cooldown = config.cooldown.categoryDays;
      cooldown >= config.cooldown.minCategoryDays;
      cooldown--
    ) {
      const recentCategories = new Set<string>();
      for (const g of history) {
        if (near(g, cooldown)) for (const id of [...g.rows, ...g.cols]) recentCategories.add(id);
      }
      // Family caps are a target too: they give way at the last stage, with the category cooldown.
      const cappedFamilies =
        cooldown > config.cooldown.minCategoryDays
          ? capped(date, history)
          : new Set<CategoryFamily>();
      const eligible = categories.filter(
        (c) => !recentCategories.has(c.id) && !cappedFamilies.has(c.family),
      );

      for (let attempt = 1; attempt <= config.attemptsPerStage; attempt++) {
        attempts++;
        const rows = draw(
          eligible,
          GRID_SIZE,
          weightsNow,
          random,
          (chosen, c) => familyCount(chosen, c.family) < familyLimit(c.family),
        );
        if (!rows) {
          reject('no rows');
          continue;
        }

        // Columns: only categories that make 3 to 80 answers with every row and may cross it.
        const columnPool = eligible.filter(
          (c) =>
            !rows.includes(c) &&
            rows.every(
              (r) =>
                canCrossCategories(r, c) &&
                !recentPairs.has(pairKey(r.id, c.id)) &&
                pairs.size(r.id, c.id) >= minAnswers &&
                pairs.size(r.id, c.id) <= maxAnswers &&
                // Not a cell where one criterion implies the other (every legendary × "500+ stats").
                pairs.size(r.id, c.id) < Math.min(pairs.size(r.id, r.id), pairs.size(c.id, c.id)),
            ),
        );
        const cols = draw(
          columnPool,
          GRID_SIZE,
          weightsNow,
          random,
          (chosen, c) => familyCount([...rows, ...chosen], c.family) < familyLimit(c.family),
        );
        if (!cols) {
          reject('no columns');
          continue;
        }
        if (!hasFamilyDiversity(rows, cols)) {
          reject('family variety');
          continue;
        }

        const cellSizes = rows.flatMap((r) => cols.map((c) => pairs.size(r.id, c.id)));
        if (
          seen.has(
            puzzleKey(
              rows.map((c) => c.id),
              cols.map((c) => c.id),
            ),
          )
        ) {
          reject('already published');
          continue;
        }
        const difficulty = difficultyOf(cellSizes);
        if (accepted) {
          const level = gridDifficulty(
            candidate(rows, cols, cellSizes),
            memberships,
            popularity,
          ).level;
          if (!accepted.includes(level)) {
            reject('difficulty target');
            continue;
          }
        }

        const grid = candidate(rows, cols, cellSizes, difficulty);
        if (!distinctRepresentatives(cellAnswers(grid, memberships))) {
          reject('no 9 different Pokémon');
          continue;
        }
        return { grid, attempts, categoryCooldownDays: cooldown };
      }
    }
    throw new GenerationError(date, attempts, rejections);
  };
}

/** The `days` consecutive dates from `from`. */
export function dateRange(from: GridDate, days: number): GridDate[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}
