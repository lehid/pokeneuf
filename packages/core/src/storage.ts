import { z } from 'zod';
import { MAX_ERRORS, MAX_SCORE, STORAGE_PREFIX } from './config';
import { CELLS, type Grid } from './grid';
import { cellCategories, type GameState } from './game';
import type { Memberships } from './memberships';
import { scoreGame, type Popularity } from './scoring';
import type { GridDate } from './date';

/**
 * Persistence formats (ROADMAP phase 4). Pure: this module parses and serializes strings; reading
 * and writing `localStorage` is the web app's job. Any schema change = bump the version, add a
 * migration here and a test.
 */
export const GAME_STORAGE_VERSION = 2;
export const SETTINGS_STORAGE_VERSION = 1;
export const HISTORY_STORAGE_VERSION = 2;

export const gameKey = (gridId: number): string => `${STORAGE_PREFIX}game:${gridId}`;
export const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
export const HISTORY_KEY = `${STORAGE_PREFIX}history`;
export const DEVICE_ID_KEY = `${STORAGE_PREFIX}deviceId`;

const gameBase = {
  gridId: z.number().int(),
  cells: z.array(z.number().int().nullable()).length(CELLS),
  errors: z.number().int().min(0).max(MAX_ERRORS),
  status: z.enum(['playing', 'won', 'lost', 'abandoned']),
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Version 1 (phases 4-6): the game only. */
const storedGameV1 = z.object({ version: z.literal(1), ...gameBase });
/** Version 2 (phase 7): plus the day the game ended and its frozen score. */
const storedGameV2 = z.object({
  version: z.literal(2),
  ...gameBase,
  finishedOn: isoDate.nullable(),
  score: z.number().int().min(0).max(MAX_SCORE).nullable(),
});

/** A game as saved: its state, and how it ended. */
export interface SavedGame {
  state: GameState;
  /**
   * The Paris date on which the game ended, `null` while it is in progress. A game that ends on its
   * own grid date is a daily game; one that ends later (or is a past grid played from the archives)
   * counts as an archive and never reaches the stats or the streak.
   */
  finishedOn: GridDate | null;
  /** Score frozen when the game ended, `null` while it is in progress. */
  score: number | null;
}

export function serializeGame(saved: SavedGame): string {
  return JSON.stringify({
    version: GAME_STORAGE_VERSION,
    ...saved.state,
    finishedOn: saved.finishedOn,
    score: saved.score,
  });
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * A saved game, or `null` when there is none or it cannot be trusted (corrupt, unknown version,
 * another grid, a placed Pokémon that does not fit its cell, inconsistent status). A bad save is
 * dropped rather than repaired: the player simply restarts the grid.
 *
 * Migration: a version 1 game that had ended was a daily game (the only mode that existed), so it
 * ends "on its grid date", and its score is computed now.
 */
export function parseStoredGame(
  raw: string | null,
  grid: Grid,
  memberships: Memberships,
  popularity: Popularity,
): SavedGame | null {
  const json = parseJson(raw);
  const v2 = storedGameV2.safeParse(json);
  const v1 = v2.success ? null : storedGameV1.safeParse(json);
  if (!v2.success && !v1?.success) return null;

  const base = v2.success ? v2.data : v1?.success ? v1.data : null;
  if (base === null) return null;
  const state: GameState = {
    gridId: base.gridId,
    cells: base.cells,
    errors: base.errors,
    status: base.status,
  };
  if (state.gridId !== grid.id) return null;

  const placed = state.cells.filter((id): id is number => id !== null);
  if (new Set(placed).size !== placed.length) return null;
  for (const [cell, id] of state.cells.entries()) {
    if (id === null) continue;
    if (id < 1 || id > memberships.count) return null;
    const [row, col] = cellCategories(grid, cell);
    if (!memberships.isValid(id, row, col)) return null;
  }

  const full = placed.length === CELLS;
  if ((state.status === 'won') !== full) return null;
  if (state.status === 'lost' && state.errors < MAX_ERRORS) return null;
  if (state.status === 'playing' && state.errors >= MAX_ERRORS) return null;

  const over = state.status !== 'playing';
  if (v2.success) {
    const { finishedOn, score } = v2.data;
    // In progress: no end date, no score. Over: both.
    if (over !== (finishedOn !== null) || over !== (score !== null)) return null;
    return { state, finishedOn, score };
  }
  return {
    state,
    finishedOn: over ? grid.date : null,
    score: over ? scoreGame(state, grid, memberships, popularity).total : null,
  };
}

/** What the list of archives needs to know about a saved game, without loading its grid. */
export interface GameSummary {
  status: GameState['status'];
  found: number;
  finishedOn: GridDate | null;
  score: number | null;
}

/**
 * A light read of a saved game (no grid, so no check against its cells). `gridDate` is the date of
 * the grid it belongs to: a version 1 game that had ended was a daily one, ended on that date.
 */
export function readGameSummary(raw: string | null, gridDate: GridDate): GameSummary | null {
  const json = parseJson(raw);
  const v2 = storedGameV2.safeParse(json);
  if (v2.success) {
    const { status, cells, finishedOn, score } = v2.data;
    return { status, found: cells.filter((id) => id !== null).length, finishedOn, score };
  }
  const v1 = storedGameV1.safeParse(json);
  if (!v1.success) return null;
  const over = v1.data.status !== 'playing';
  return {
    status: v1.data.status,
    found: v1.data.cells.filter((id) => id !== null).length,
    finishedOn: over ? gridDate : null,
    score: null,
  };
}

const settingsSchema = z.object({
  version: z.literal(SETTINGS_STORAGE_VERSION),
  /** "Ne plus afficher" on the rules modal. */
  hideRules: z.boolean(),
});
export type Settings = Omit<z.infer<typeof settingsSchema>, 'version'>;

export const DEFAULT_SETTINGS: Settings = { hideRules: false };

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: SETTINGS_STORAGE_VERSION, ...settings });
}

export function parseSettings(raw: string | null): Settings {
  const parsed = settingsSchema.safeParse(parseJson(raw));
  if (!parsed.success) return DEFAULT_SETTINGS;
  return { hideRules: parsed.data.hideRules };
}

/**
 * One finished game, kept in `history` (today's grid only: archives never count, ROADMAP §3.5).
 * `score` is frozen at the end of the game, so later changes to the data never rewrite it.
 */
const historyEntrySchema = z.object({
  gridId: z.number().int(),
  /** Paris date of the grid: the streak is computed from it. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['won', 'lost', 'abandoned']),
  found: z.number().int().min(0).max(CELLS),
  errors: z.number().int().min(0).max(MAX_ERRORS),
  score: z.number().int().min(0).max(MAX_SCORE),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

const historySchema = z.object({
  version: z.literal(HISTORY_STORAGE_VERSION),
  entries: z.array(historyEntrySchema),
});

/**
 * Migration: version 1 (phase 4) had no date and a placeholder score, and was written while the
 * game only had its demo grid. Those entries are not real games: they are dropped, not converted.
 */
export function parseHistory(raw: string | null): HistoryEntry[] {
  const parsed = historySchema.safeParse(parseJson(raw));
  return parsed.success ? parsed.data.entries : [];
}

/** Adds a finished game; one entry per grid (a later one replaces an earlier one). */
export function serializeHistory(entries: readonly HistoryEntry[], entry: HistoryEntry): string {
  const kept = entries.filter((e) => e.gridId !== entry.gridId);
  return JSON.stringify({ version: HISTORY_STORAGE_VERSION, entries: [...kept, entry] });
}
