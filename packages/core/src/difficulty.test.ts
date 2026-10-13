import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY,
  DIFFICULTY_LEVELS,
  gridDifficulty,
  levelOf,
  type DifficultyLevel,
} from './difficulty';
import { difficultyOf } from './grid';
import { worldGrid as grid, worldMemberships as memberships } from './test-world';

/** The lower the national number, the better known. */
const known = (id: number) => 1 / id;

describe('levelOf', () => {
  it('cuts the score at the bounds, each bound belonging to the lower level', () => {
    const [a, b, c, d] = DIFFICULTY.bounds as [number, number, number, number];
    const expected: [number, DifficultyLevel][] = [
      [0, 'veryEasy'],
      [a, 'veryEasy'],
      [a + 1, 'easy'],
      [b, 'easy'],
      [b + 1, 'medium'],
      [c, 'medium'],
      [c + 1, 'hard'],
      [d, 'hard'],
      [d + 1, 'veryHard'],
      [100, 'veryHard'],
    ];
    for (const [score, level] of expected) expect(levelOf(score), String(score)).toBe(level);
  });

  it('has five levels, in order, and as many bounds as levels but one', () => {
    expect(DIFFICULTY_LEVELS).toEqual(['veryEasy', 'easy', 'medium', 'hard', 'veryHard']);
    expect(DIFFICULTY.bounds).toHaveLength(DIFFICULTY_LEVELS.length - 1);
    expect([...DIFFICULTY.bounds].sort((x, y) => x - y)).toEqual([...DIFFICULTY.bounds]);
    const weights = Object.values(DIFFICULTY.weights).reduce((sum, w) => sum + w, 0);
    expect(weights).toBeCloseTo(1, 10);
  });
});

describe('gridDifficulty', () => {
  it('gives a score from 0 to 100, its level and its three parts', () => {
    const result = gridDifficulty(grid, memberships, known);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(result.level).toBe(levelOf(result.score));
    expect(DIFFICULTY_LEVELS[result.levelIndex]).toBe(result.level);
    for (const part of Object.values(result.parts)) {
      expect(part).toBeGreaterThanOrEqual(0);
      expect(part).toBeLessThanOrEqual(1);
    }
  });

  it('counts the size of the cells as the grid file does', () => {
    const { parts } = gridDifficulty(grid, memberships, known);
    const sizes = [...grid.rows].flatMap((row) =>
      [...grid.cols].map((col) => memberships.answersFor(row, col).length),
    );
    expect(parts.size).toBeCloseTo(difficultyOf(sizes) / 100, 10);
  });

  it('is harder when even the best-known answers are obscure', () => {
    const famous = gridDifficulty(grid, memberships, () => 1);
    const obscure = gridDifficulty(grid, memberships, () => 0.01);
    expect(famous.parts.obscurity).toBe(0);
    expect(obscure.parts.obscurity).toBeGreaterThan(0.99);
    expect(obscure.score).toBeGreaterThan(famous.score);
  });

  it('is harder when a cell holds a smaller share of the famous Pokémon', () => {
    // Same cells, but all the fame sits on Pokémon outside them (multiples of 1999): the cells
    // keep their sizes and hold almost none of the popularity.
    const fameElsewhere = (id: number) => (id % 1999 === 0 ? 1 : 0.001);
    const spread = gridDifficulty(grid, memberships, () => 0.5);
    const elsewhere = gridDifficulty(grid, memberships, fameElsewhere);
    expect(elsewhere.parts.mass).toBeGreaterThan(spread.parts.mass);
  });

  it('does not change when all the popularities are scaled the same way', () => {
    const a = gridDifficulty(grid, memberships, (id) => 1 / id);
    const b = gridDifficulty(grid, memberships, (id) => 0.5 / id);
    expect(b.parts.mass).toBeCloseTo(a.parts.mass, 10);
  });

  it('is deterministic', () => {
    expect(gridDifficulty(grid, memberships, known)).toEqual(
      gridDifficulty(grid, memberships, known),
    );
  });

  it('copes with a world where nobody is known at all', () => {
    const result = gridDifficulty(grid, memberships, () => 0);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
