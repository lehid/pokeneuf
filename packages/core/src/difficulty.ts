import { cellAnswers, difficultyOf, type Grid } from './grid';
import type { Memberships } from './memberships';
import type { Popularity } from './scoring';

/**
 * How hard a grid is to fill, as one of five levels shown to the player. Three things make a grid
 * hard, and the number of answers is only the first:
 *
 * - **size**: few answers per cell (`difficultyOf`, a log scale);
 * - **obscurity**: even the best-known answer of a cell is not that well known;
 * - **mass**: the cell holds a tiny share of the Pokémon people think of first (the share of the
 *   total popularity, on a log scale).
 *
 * Everything is fixed numbers, never relative to the other grids, so a grid keeps its level.
 */
export const DIFFICULTY_LEVELS = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY = {
  /** Weights of the three parts in the 0-100 score. */
  weights: { size: 0.4, obscurity: 0.3, mass: 0.3 },
  /** Observed range of the raw obscurity (mean of 1 - best popularity) and mass (mean of -log10 share). */
  obscurityMax: 0.7,
  massMin: 1.2,
  massMax: 2.1,
  /**
   * Last score of each level but the last: a score up to the first bound is `veryEasy`, up to the
   * second `easy`, and so on; above the last, `veryHard`. Quintiles of 365 grids drawn without any
   * target: left alone, the generator would split evenly (about a fifth each).
   */
  bounds: [47, 57, 64, 72] as readonly number[],
} as const;

export interface GridDifficulty {
  /** 0 (easiest) to 100. */
  score: number;
  level: DifficultyLevel;
  /** 0 for `veryEasy` … 4 for `veryHard`. */
  levelIndex: number;
  /** The three parts, each from 0 to 1. */
  parts: { size: number; obscurity: number; mass: number };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function levelOf(score: number): DifficultyLevel {
  const index = DIFFICULTY.bounds.filter((bound) => score > bound).length;
  return DIFFICULTY_LEVELS[index] ?? 'veryHard';
}

export function gridDifficulty(
  grid: Grid,
  memberships: Memberships,
  popularity: Popularity,
): GridDifficulty {
  const cells = cellAnswers(grid, memberships);
  let total = 0;
  for (let id = 1; id <= memberships.count; id++) total += popularity(id);

  const size = difficultyOf(cells.map((answers) => answers.length)) / 100;
  const obscurity =
    cells.reduce((sum, answers) => sum + (1 - Math.max(0, ...answers.map(popularity))), 0) /
    cells.length;
  const mass =
    cells.reduce((sum, answers) => {
      // Nobody known at all: no information, so every Pokémon counts the same.
      const share =
        total > 0
          ? answers.reduce((s, id) => s + popularity(id), 0) / total
          : answers.length / memberships.count;
      return sum - Math.log10(Math.max(share, Number.MIN_VALUE));
    }, 0) / cells.length;

  const parts = {
    size: clamp01(size),
    obscurity: clamp01(obscurity / DIFFICULTY.obscurityMax),
    mass: clamp01((mass - DIFFICULTY.massMin) / (DIFFICULTY.massMax - DIFFICULTY.massMin)),
  };
  const w = DIFFICULTY.weights;
  const score = Math.round(
    100 * (w.size * parts.size + w.obscurity * parts.obscurity + w.mass * parts.mass),
  );
  const level = levelOf(score);
  return { score, level, levelIndex: DIFFICULTY_LEVELS.indexOf(level), parts };
}
