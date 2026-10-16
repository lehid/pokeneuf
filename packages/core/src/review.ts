import { z } from 'zod';
import { CATEGORIES, CATEGORY_FAMILIES, type Category, type CategoryFamily } from './categories';
import { STORAGE_PREFIX } from './config';
import type { GridDate } from './date';
import { checkGrid, GRID_SIZE, type CheckOptions, type Grid } from './grid';
import { gridDifficulty, type GridDifficulty } from './difficulty';
import type { Memberships } from './memberships';
import {
  rankScore,
  rarityTier,
  sortByPopularity,
  type Popularity,
  type RarityTier,
} from './scoring';

/**
 * Human review of the grids (ROADMAP §3.4, "page /preview en dev"). Pure helpers: they point the
 * reviewer at what deserves a second look; they never decide that a grid is wrong. The page that
 * shows them exists in development only.
 */

/** Numbers behind the review flags (isolated on purpose, like `SCORING`). */
export const REVIEW = {
  /** A cell with this many answers or fewer is flagged `few`: little room for a second guess. */
  fewAnswers: 5,
  /** The best-known answer of a cell is a mascot at this popularity or above… */
  obviousPopularity: 0.95,
  /** …and the cell is small enough for that mascot to hand the cell over (`obvious`). */
  obviousMaxAnswers: 12,
  /**
   * The cell holds this share or more of the members of the smaller of its two categories: one
   * category nearly implies the other, so the crossing teaches nothing (`redundant`).
   */
  redundantShare: 0.8,
  /** A grid with this many `few` cells or more deserves a close look on that count alone. */
  manyFewCells: 4,
  /** The generator refuses a grid with this many `few` cells or more: too little room to play. */
  maxFewCells: 6,
  /**
   * The generator refuses a `uniformRarity` cell at this size or above. A cell of 3 to 5 answers
   * is often uniform by nature; a large one where every answer sits in the same tier is a cell
   * whose answers cannot be told apart by how well known they are.
   */
  uniformRarityMinSize: 6,
} as const;

export const CELL_FLAG_KINDS = ['few', 'uniformRarity', 'obvious', 'redundant'] as const;
/** Why a cell is worth a look. `obvious` and `redundant` are the two ways a cell looks trivial. */
export type CellFlagKind = (typeof CELL_FLAG_KINDS)[number];

/** Why the definition of a row or column might surprise a player. */
export const SURPRISE_REASONS = [
  'language',
  'pokedexColor',
  'pokedexShape',
  'evolutionScope',
  'curatedList',
  'tiny',
] as const;
export type SurpriseReason = (typeof SURPRISE_REASONS)[number];

const SURPRISE_BY_FAMILY: Partial<Record<CategoryFamily, SurpriseReason>> = {
  name: 'language',
  color: 'pokedexColor',
  shape: 'pokedexShape',
  evolution: 'evolutionScope',
  status: 'curatedList',
  form: 'curatedList',
};

/** Why this category might surprise (its family, else its size), or `null` when it is plain. */
export function surpriseOf(category: Category): SurpriseReason | null {
  return SURPRISE_BY_FAMILY[category.family] ?? (category.bonus ? 'tiny' : null);
}

export interface ReviewedAnswer {
  /** National number. */
  id: number;
  /** 0 = the best-known answer of the cell, 1 = the most obscure. */
  rank: number;
  tier: RarityTier;
  popularity: number;
}

export interface CellReview {
  /** Row-major, 0-8. */
  index: number;
  size: number;
  /** Every answer, the best known first. */
  answers: ReviewedAnswer[];
  flags: CellFlagKind[];
}

export interface CellInput {
  answers: readonly number[];
  /** Members of the row category and of the column category. */
  rowSize: number;
  colSize: number;
}

/** The answers of a cell ranked from best known to rarest, and the flags that apply to it. */
export function reviewCell(index: number, input: CellInput, popularity: Popularity): CellReview {
  const { answers, rowSize, colSize } = input;
  const sorted = sortByPopularity(answers, popularity);
  const ranked = sorted.map((id): ReviewedAnswer => {
    const rank = rankScore(id, answers, popularity);
    return { id, rank, tier: rarityTier(rank), popularity: popularity(id) };
  });

  const flags: CellFlagKind[] = [];
  if (answers.length <= REVIEW.fewAnswers) flags.push('few');
  if (ranked.length > 1 && ranked.every((a) => a.tier === ranked[0]?.tier)) {
    flags.push('uniformRarity');
  }
  const best = ranked[0]?.popularity ?? 0;
  if (best >= REVIEW.obviousPopularity && answers.length <= REVIEW.obviousMaxAnswers) {
    flags.push('obvious');
  }
  const smaller = Math.min(rowSize, colSize);
  if (smaller > 0 && answers.length / smaller >= REVIEW.redundantShare) flags.push('redundant');
  return { index, size: answers.length, answers: ranked, flags };
}

/**
 * What the generator refuses outright, among the things the review points at: a cell where one
 * criterion implies the other, a large cell whose answers are all alike in rarity, and a grid
 * made mostly of tiny cells. Everything else (`obvious`, a few small cells) is a matter of taste
 * and only reaches the human reviewer. Empty = nothing to refuse.
 */
export function blockingFlaws(cells: readonly CellReview[]): string[] {
  const flaws: string[] = [];
  if (cells.some((c) => c.flags.includes('redundant'))) flaws.push('redundant cell');
  if (
    cells.some((c) => c.flags.includes('uniformRarity') && c.size >= REVIEW.uniformRarityMinSize)
  ) {
    flaws.push('uniform rarity');
  }
  if (cells.filter((c) => c.flags.includes('few')).length >= REVIEW.maxFewCells) {
    flaws.push('too many small cells');
  }
  return flaws;
}

export interface LineReview {
  axis: 'row' | 'col';
  /** 0-2. */
  position: number;
  categoryId: string;
  family: CategoryFamily;
  /** Members of the category in the whole Pokédex. */
  members: number;
  surprise: SurpriseReason | null;
}

export interface GridReview {
  date: GridDate;
  id: number;
  difficulty: GridDifficulty;
  /** Row-major, like `cellAnswers`. */
  cells: CellReview[];
  /** The three rows, then the three columns. */
  lines: LineReview[];
  /** Everything `checkGrid` objects to; empty for a publishable grid. */
  problems: string[];
  /** Number of the six categories in each family. */
  familyMix: Partial<Record<CategoryFamily, number>>;
  nameCount: number;
  /** Cells per flag kind. */
  flagCounts: Record<CellFlagKind, number>;
  /** Lines with a surprising definition. */
  surpriseCount: number;
}

function emptyFlagCounts(): Record<CellFlagKind, number> {
  return { few: 0, uniformRarity: 0, obvious: 0, redundant: 0 };
}

/** Everything the review page shows about one grid. */
export function reviewGrid(
  grid: Grid,
  memberships: Memberships,
  popularity: Popularity,
  options: CheckOptions = {},
): GridReview {
  const registry = new Map((options.categories ?? CATEGORIES).map((c) => [c.id, c]));
  const find = (id: string): Category => {
    const category = registry.get(id);
    if (!category) throw new Error(`Unknown category: ${id}`);
    return category;
  };
  const rows = grid.rows.map(find);
  const cols = grid.cols.map(find);
  const lines: LineReview[] = [
    ...rows.map((c, i) => ({ axis: 'row' as const, c, i })),
    ...cols.map((c, i) => ({ axis: 'col' as const, c, i })),
  ].map(({ axis, c, i }) => ({
    axis,
    position: i,
    categoryId: c.id,
    family: c.family,
    members: memberships.size(c),
    surprise: surpriseOf(c),
  }));

  const cells = rows.flatMap((row, r) =>
    cols.map((col, c) =>
      reviewCell(
        r * GRID_SIZE + c,
        {
          answers: memberships.answersFor(row, col),
          rowSize: memberships.size(row),
          colSize: memberships.size(col),
        },
        popularity,
      ),
    ),
  );

  const familyMix: Partial<Record<CategoryFamily, number>> = {};
  for (const { family } of lines) familyMix[family] = (familyMix[family] ?? 0) + 1;

  const flagCounts = emptyFlagCounts();
  for (const cell of cells) for (const flag of cell.flags) flagCounts[flag]++;

  return {
    date: grid.date,
    id: grid.id,
    difficulty: gridDifficulty(grid, memberships, popularity),
    cells,
    lines,
    problems: checkGrid(grid, memberships, options),
    familyMix,
    nameCount: familyMix.name ?? 0,
    flagCounts,
    surpriseCount: lines.filter((l) => l.surprise !== null).length,
  };
}

/** What a reviewer can filter on: a cell flag, a surprising line, or a rule `checkGrid` reports. */
export type ReviewFilterKind = CellFlagKind | 'surprise' | 'problem';
export const REVIEW_FILTER_KINDS: readonly ReviewFilterKind[] = [
  ...CELL_FLAG_KINDS,
  'surprise',
  'problem',
];

/**
 * Does the grid carry this kind of flag? Without a kind: does it deserve a close look, which is
 * stricter than "has any flag": nearly every grid has a small cell or a spelling category, so those
 * only count here when a grid piles them up (`REVIEW.manyFewCells`) or they come with something else.
 */
export function hasFlag(review: GridReview, kind: ReviewFilterKind | null = null): boolean {
  switch (kind) {
    case null:
      return (
        review.flagCounts.few >= REVIEW.manyFewCells ||
        review.flagCounts.uniformRarity > 0 ||
        review.flagCounts.obvious > 0 ||
        review.flagCounts.redundant > 0 ||
        review.problems.length > 0
      );
    case 'surprise':
      return review.surpriseCount > 0;
    case 'problem':
      return review.problems.length > 0;
    default:
      return review.flagCounts[kind] > 0;
  }
}

/** Number of flagged cells (a cell with two flags counts once). */
export function flaggedCellCount(review: GridReview): number {
  return review.cells.filter((c) => c.flags.length > 0).length;
}

export interface ReviewSummary {
  grids: number;
  /** Grids with at least one flag of any kind. */
  flaggedGrids: number;
  /** Grids per kind of flag. */
  gridsByFlag: Record<ReviewFilterKind, number>;
  /** Cells per kind of flag, over every grid. */
  cellsByFlag: Record<CellFlagKind, number>;
  cells: number;
  /** Rows and columns per family, over every grid. */
  familyMix: Record<CategoryFamily, number>;
  lines: number;
  /** Share (0-1) of the rows and columns that are spelling questions. */
  nameShare: number;
  gridsWithName: number;
  surprisingLines: number;
  /** Mean number of answers per cell. */
  meanCellSize: number;
}

export function summarizeReviews(reviews: readonly GridReview[]): ReviewSummary {
  const gridsByFlag = Object.fromEntries(
    REVIEW_FILTER_KINDS.map((k) => [k, reviews.filter((r) => hasFlag(r, k)).length]),
  ) as Record<ReviewFilterKind, number>;
  const cellsByFlag = emptyFlagCounts();
  const familyMix = Object.fromEntries(CATEGORY_FAMILIES.map((f) => [f, 0])) as Record<
    CategoryFamily,
    number
  >;
  let surprisingLines = 0;
  let sizeTotal = 0;
  let cells = 0;
  let lines = 0;
  for (const review of reviews) {
    for (const kind of CELL_FLAG_KINDS) cellsByFlag[kind] += review.flagCounts[kind];
    for (const line of review.lines) familyMix[line.family]++;
    surprisingLines += review.surpriseCount;
    for (const cell of review.cells) sizeTotal += cell.size;
    cells += review.cells.length;
    lines += review.lines.length;
  }
  return {
    grids: reviews.length,
    flaggedGrids: reviews.filter((r) => hasFlag(r)).length,
    gridsByFlag,
    cellsByFlag,
    cells,
    familyMix,
    lines,
    nameShare: lines === 0 ? 0 : familyMix.name / lines,
    gridsWithName: reviews.filter((r) => r.nameCount > 0).length,
    surprisingLines,
    meanCellSize: cells === 0 ? 0 : sizeTotal / cells,
  };
}

/* -------------------------------- "relu" marks -------------------------------- */

export const REVIEWED_STORAGE_VERSION = 1;
/** Development only: the dates of the grids the owner has read. */
export const REVIEWED_KEY = `${STORAGE_PREFIX}preview:reviewed`;

const reviewedSchema = z.object({
  version: z.literal(REVIEWED_STORAGE_VERSION),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export function serializeReviewed(dates: Iterable<GridDate>): string {
  return JSON.stringify({ version: REVIEWED_STORAGE_VERSION, dates: [...new Set(dates)].sort() });
}

/** The reviewed dates saved, or none when there is nothing or it cannot be trusted. */
export function parseReviewed(raw: string | null): Set<GridDate> {
  if (raw === null) return new Set();
  try {
    const parsed = reviewedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? new Set(parsed.data.dates) : new Set();
  } catch {
    return new Set();
  }
}

export interface ReviewEntry {
  date: GridDate;
  id: number;
}

export interface ReviewMarkdownLabels {
  title: string;
  reviewed: (count: number, total: number) => string;
  pending: (count: number, total: number) => string;
  entry: (entry: ReviewEntry) => string;
}

/** A Markdown checklist of the grids read and not read yet, by date. */
export function reviewMarkdown(
  entries: readonly ReviewEntry[],
  reviewed: ReadonlySet<GridDate>,
  labels: ReviewMarkdownLabels,
): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const done = sorted.filter((e) => reviewed.has(e.date));
  const todo = sorted.filter((e) => !reviewed.has(e.date));
  const list = (items: ReviewEntry[], mark: 'x' | ' ') =>
    items.length === 0 ? ['_—_'] : items.map((e) => `- [${mark}] ${labels.entry(e)}`);
  return [
    `# ${labels.title}`,
    '',
    `## ${labels.reviewed(done.length, sorted.length)}`,
    '',
    ...list(done, 'x'),
    '',
    `## ${labels.pending(todo.length, sorted.length)}`,
    '',
    ...list(todo, ' '),
    '',
  ].join('\n');
}

/* -------------------------------- the /preview route -------------------------------- */

const PREVIEW_HASH = /^#\/preview(?:\/(\d{4}-\d{2}-\d{2}))?$/;

/**
 * `#/preview` and `#/preview/2026-11-05`: the review page, development only. Kept out of
 * `parseRoute` on purpose: in production the hash is just an unknown route (the page of the day).
 */
export function parsePreviewRoute(hash: string): { date: GridDate | null } | null {
  const match = PREVIEW_HASH.exec(hash);
  return match ? { date: match[1] ?? null } : null;
}

export function previewHash(date: GridDate | null = null): string {
  return date === null ? '#/preview' : `#/preview/${date}`;
}
