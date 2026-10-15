import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  CATEGORY_FAMILIES,
  DIFFICULTY_LEVELS,
  type Category,
  type CategoryFamily,
} from '@pokeneuf/core';
import { z } from 'zod';

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const days = z.number().int().min(0);

const configSchema = z.strictObject({
  cooldown: z.strictObject({
    /** A category does not come back before this many days (the target)… */
    categoryDays: days,
    /**
     * …but 6 categories a day for 7 days is 42 of the 69 categories, so when no valid grid exists
     * the generator shortens it one day at a time, down to this floor. Never silent: the report
     * lists the dates where it happened.
     */
    minCategoryDays: days,
    /** A row × column pair does not come back before this many days. Never relaxed. */
    pairDays: days,
  }),
  /** How often each family is drawn, relative to the others. */
  familyWeights: z.record(z.enum(CATEGORY_FAMILIES), z.number().positive()),
  /** Weight of a `bonus` category relative to a regular one of the same family. */
  bonusWeight: z.number().positive(),
  /** Per-category tuning (relative to the others of its family). Default 1. */
  categoryWeights: z.record(z.string(), z.number().positive()),
  /**
   * Difficulty levels accepted per weekday (see `gridDifficulty`), e.g. `"mon": ["veryEasy", "easy"]`.
   * A weekday without an entry takes any grid.
   */
  weekdayLevels: z.partialRecord(z.enum(WEEKDAYS), z.array(z.enum(DIFFICULTY_LEVELS)).min(1)),
  /**
   * Categories used less than their weight says (over this many days, both sides of the date) are
   * drawn more, the others less. Without it, the categories left after a week of cooldown are
   * always the rarest ones, which cannot make a valid grid. 0 turns it off.
   */
  balanceWindowDays: days,
  /** Draws tried at each cooldown length before shortening it. */
  attemptsPerStage: z.number().int().positive(),
});

export type GeneratorConfig = z.infer<typeof configSchema>;

export function parseConfig(input: unknown): GeneratorConfig {
  const result = configSchema.safeParse(input);
  if (!result.success)
    throw new Error(`Invalid generator config:\n${z.prettifyError(result.error)}`);
  const { categoryDays, minCategoryDays } = result.data.cooldown;
  if (minCategoryDays > categoryDays)
    throw new Error('cooldown.minCategoryDays is above categoryDays');
  return result.data;
}

export const CONFIG_PATH = fileURLToPath(new URL('../config/generator.json', import.meta.url));

export async function loadConfig(path: string = CONFIG_PATH): Promise<GeneratorConfig> {
  return parseConfig(JSON.parse(await readFile(path, 'utf8')) as unknown);
}

/**
 * Probability weight of each category: its family's weight, shared among the family's categories
 * (so a family with many categories is not drawn more often for that reason), then tuned by
 * `categoryWeights` and `bonusWeight`.
 */
export function categoryWeights(
  categories: readonly Category[],
  config: GeneratorConfig,
): Map<string, number> {
  const ids = new Set(categories.map((c) => c.id));
  for (const id of Object.keys(config.categoryWeights)) {
    if (!ids.has(id)) throw new Error(`categoryWeights: unknown category "${id}"`);
  }
  const relative = (c: Category) =>
    config.categoryWeights[c.id] ?? (c.bonus ? config.bonusWeight : 1);
  const totals = new Map<CategoryFamily, number>();
  for (const c of categories) totals.set(c.family, (totals.get(c.family) ?? 0) + relative(c));
  return new Map(
    categories.map((c) => [
      c.id,
      (config.familyWeights[c.family] * relative(c)) / (totals.get(c.family) as number),
    ]),
  );
}
