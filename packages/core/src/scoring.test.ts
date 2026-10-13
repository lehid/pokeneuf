import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import {
  MAX_RAW_SCORE,
  pointsFor,
  rankScore,
  rarityTier,
  scoreGame,
  SCORING,
  sortByPopularity,
  totalScore,
} from './scoring';
import { worldGrid as grid, worldMemberships as memberships, worldSolution } from './test-world';

/** The lower the national number, the better known: easy to reason about. */
const known = (id: number) => 1 / id;
const obscure = (id: number) => id;

// Cell 0 of the test world: the 30 multiples of 65 (65, 130 … 1950).
const cell0 = memberships.answersFor(grid.rows[0] ?? '', grid.cols[0] ?? '');

describe('rankScore', () => {
  it('is 0 for the most popular answer and 1 for the most obscure', () => {
    expect(cell0).toHaveLength(30);
    expect(rankScore(65, cell0, known)).toBe(0);
    expect(rankScore(1950, cell0, known)).toBe(1);
  });

  it('is the number of better-known answers over all the others', () => {
    expect(rankScore(65 * 16, cell0, known)).toBeCloseTo(15 / 29, 10); // 15 answers come first
    expect(rankScore(65 * 2, cell0, known)).toBeCloseTo(1 / 29, 10);
  });

  it('gives the same rank to answers of the same popularity, whatever the order of the list', () => {
    const flat = () => 0.5;
    expect(rankScore(65, cell0, flat)).toBe(0);
    expect(rankScore(1950, cell0, flat)).toBe(0);
    expect(rankScore(130, [...cell0].reverse(), known)).toBe(rankScore(130, cell0, known));
  });

  it('is 0 when there is a single answer', () => {
    expect(rankScore(7, [7], known)).toBe(0);
    expect(rankScore(7, [], known)).toBe(0);
  });

  it('is turned upside down by another popularity (what v2 will plug in)', () => {
    for (const id of [65, 650, 1300, 1950]) {
      expect(rankScore(id, cell0, obscure)).toBeCloseTo(1 - rankScore(id, cell0, known), 10);
    }
  });
});

describe('rarityTier', () => {
  it('cuts at 0.25, 0.5 and 0.75', () => {
    expect(rarityTier(0)).toBe('common');
    expect(rarityTier(0.2499)).toBe('common');
    expect(rarityTier(0.25)).toBe('uncommon');
    expect(rarityTier(0.4999)).toBe('uncommon');
    expect(rarityTier(0.5)).toBe('rare');
    expect(rarityTier(0.7499)).toBe('rare');
    expect(rarityTier(0.75)).toBe('veryRare');
    expect(rarityTier(1)).toBe('veryRare');
  });
});

describe('points', () => {
  it('are 30 + round(85 × √rank score)', () => {
    expect(pointsFor(0)).toBe(30);
    expect(pointsFor(1)).toBe(115);
    expect(pointsFor(0.25)).toBe(73); // 30 + round(42.5)
    expect(pointsFor(0.5)).toBe(90); // 30 + round(60.1)
    expect(pointsFor(15 / 29)).toBe(91);
    expect(pointsFor(0.0001)).toBe(31);
  });

  it('give a somewhat uncommon answer most of the bonus: the curve is concave', () => {
    // the first quarter of the rank range earns over 40 % of the bonus (a straight line: 25 %)
    expect(pointsFor(0.25) - pointsFor(0)).toBeGreaterThan(0.4 * (pointsFor(1) - pointsFor(0)));
    for (let i = 1; i <= 10; i++) {
      expect(pointsFor(i / 10)).toBeGreaterThanOrEqual(pointsFor((i - 1) / 10));
    }
    expect(pointsFor(-1)).toBe(30);
  });

  it('add up, lose 20 per error, and stay within [0, 900]', () => {
    expect(totalScore([65, 40, 115], 0)).toBe(220);
    expect(totalScore([115, 115, 115], 1)).toBe(325);
    expect(totalScore([30, 30], 3)).toBe(0);
    expect(totalScore([], 2)).toBe(0);
    expect(totalScore(Array<number>(9).fill(115), 0)).toBe(SCORING.maxScore);
    expect(MAX_RAW_SCORE).toBe(1035);
  });
});

describe('sortByPopularity', () => {
  it('lists the best-known first, ties by national number, without touching the input', () => {
    const input = [3, 1, 2];
    expect(sortByPopularity(input, known)).toEqual([1, 2, 3]);
    expect(sortByPopularity(input, () => 1)).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('scoreGame', () => {
  const withCells = (n: number, errors = 0): GameState => ({
    ...newGame(grid),
    errors,
    cells: worldSolution.map((id, i) => (i < n ? id : null)),
  });

  it('is empty before the first answer', () => {
    const score = scoreGame(newGame(grid), grid, memberships, known);
    expect(score).toEqual({
      cells: Array(9).fill(null),
      total: 0,
      found: 0,
      errors: 0,
      rarestCell: null,
    });
  });

  it('scores every found cell by its rank in its own cell', () => {
    const score = scoreGame(withCells(9), grid, memberships, known);
    expect(score.found).toBe(9);
    let sum = 0;
    for (const [cell, s] of score.cells.entries()) {
      const [row, col] = [grid.rows[Math.floor(cell / 3)] ?? '', grid.cols[cell % 3] ?? ''];
      const expected = rankScore(worldSolution[cell] ?? 0, memberships.answersFor(row, col), known);
      expect(s?.rank).toBeCloseTo(expected, 10);
      expect(s?.points).toBe(pointsFor(expected));
      expect(s?.tier).toBe(rarityTier(expected));
      sum += s?.points ?? 0;
    }
    expect(score.total).toBe(Math.min(900, sum));
  });

  it('takes the errors off the total', () => {
    const clean = scoreGame(withCells(4), grid, memberships, known);
    const dirty = scoreGame(withCells(4, 2), grid, memberships, known);
    expect(dirty.total).toBe(Math.max(0, clean.total - 40));
    expect(dirty.errors).toBe(2);
  });

  it('points at the cell with the most obscure answer', () => {
    const score = scoreGame(withCells(9), grid, memberships, known);
    const ranks = score.cells.map((c) => c?.rank ?? -1);
    expect(score.rarestCell).toBe(ranks.indexOf(Math.max(...ranks)));
  });

  it('is frozen by the data: the same game always has the same score', () => {
    const a = scoreGame(withCells(9, 1), grid, memberships, known);
    const b = scoreGame(withCells(9, 1), grid, memberships, known);
    expect(a).toEqual(b);
  });
});
