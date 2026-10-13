import { MAX_SCORE } from './config';
import { cellCategories, type GameState } from './game';
import { CELLS, type Grid } from './grid';
import type { Memberships } from './memberships';

/**
 * Score and rarity (ROADMAP §3.5). The rarity of an answer is its rank inside the cell, by
 * popularity: the most obvious answer is `common`, the most obscure one `veryRare`.
 *
 * `Popularity` is the only thing that differs between v1 (the estimated `pop` of the Pokédex) and
 * v2 (a live share computed from the picks of all players): pass the other function, nothing else
 * changes.
 */
export type Popularity = (pokemonId: number) => number;

export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'veryRare'] as const;
export type RarityTier = (typeof RARITY_TIERS)[number];

/** Tunable numbers of the score (isolated on purpose, ROADMAP §3.5). */
export const SCORING = {
  /** Every correct answer is worth at least this: finishing the grid matters most. */
  basePoints: 30,
  /** …plus up to this much for the most obscure answer of the cell… */
  rankPoints: 85,
  /**
   * …on a square-root curve: a somewhat uncommon answer already earns most of the bonus, and the
   * very top is not out of reach. (With a straight line, a player who answers what comes to mind
   * first scored about 300, and 900 was out of reach for anyone who does not aim at the obscure.)
   */
  rankCurve: 0.5,
  /** Lost per wrong answer. */
  errorPenalty: 20,
  maxScore: MAX_SCORE,
  /** A rank score under 0.25 is `common`, under 0.5 `uncommon`, under 0.75 `rare`, else `veryRare`. */
  tierBounds: [0.25, 0.5, 0.75] as readonly number[],
} as const;

/**
 * 0 for the most popular valid answer of a cell, 1 for the most obscure. Answers with the same
 * popularity share a rank (the number of answers strictly more popular), so the order of the list
 * never matters. A cell with a single answer is 0.
 */
export function rankScore(
  pokemonId: number,
  answers: readonly number[],
  popularity: Popularity,
): number {
  if (answers.length <= 1) return 0;
  const own = popularity(pokemonId);
  const moreKnown = answers.filter((id) => popularity(id) > own).length;
  return moreKnown / (answers.length - 1);
}

export function rarityTier(score: number): RarityTier {
  const [common = 0.25, uncommon = 0.5, rare = 0.75] = SCORING.tierBounds;
  if (score < common) return 'common';
  if (score < uncommon) return 'uncommon';
  if (score < rare) return 'rare';
  return 'veryRare';
}

/** Points of a correct answer from its rank score: 30 + round(85 × √rank). */
export function pointsFor(score: number): number {
  return (
    SCORING.basePoints + Math.round(SCORING.rankPoints * Math.max(0, score) ** SCORING.rankCurve)
  );
}

/** Total of a game, bounded to [0, MAX_SCORE]. */
export function totalScore(points: readonly number[], errors: number): number {
  const sum = points.reduce((total, p) => total + p, 0) - SCORING.errorPenalty * errors;
  return Math.min(SCORING.maxScore, Math.max(0, sum));
}

/** Valid answers of a cell, the most popular first (ties by national number). */
export function sortByPopularity(answers: readonly number[], popularity: Popularity): number[] {
  return [...answers].sort((a, b) => popularity(b) - popularity(a) || a - b);
}

export interface CellScore {
  rank: number;
  points: number;
  tier: RarityTier;
}

export interface GameScore {
  /** Per cell, row-major: `null` while empty. */
  cells: (CellScore | null)[];
  /** Σ points − 20 × errors, bounded to [0, 900]. */
  total: number;
  found: number;
  errors: number;
  /** The found cell with the most obscure answer (the first one on a tie), if any. */
  rarestCell: number | null;
}

export function scoreGame(
  state: GameState,
  grid: Grid,
  memberships: Memberships,
  popularity: Popularity,
): GameScore {
  const cells = state.cells.map((id, cell): CellScore | null => {
    if (id === null) return null;
    const [row, col] = cellCategories(grid, cell);
    const rank = rankScore(id, memberships.answersFor(row, col), popularity);
    return { rank, points: pointsFor(rank), tier: rarityTier(rank) };
  });
  const found = cells.filter((c): c is CellScore => c !== null);
  let rarestCell: number | null = null;
  for (const [cell, score] of cells.entries()) {
    if (score === null) continue;
    const best = rarestCell === null ? null : cells[rarestCell];
    if (best === null || best === undefined || score.rank > best.rank) rarestCell = cell;
  }
  return {
    cells,
    total: totalScore(
      found.map((c) => c.points),
      state.errors,
    ),
    found: found.length,
    errors: state.errors,
    rarestCell,
  };
}

/** The highest total the rules can give (all 9 cells at the top rank, no error), before the bound. */
export const MAX_RAW_SCORE = CELLS * (SCORING.basePoints + SCORING.rankPoints);
