import { z } from 'zod';
import { MAX_ERRORS, MAX_SCORE, STORAGE_PREFIX } from './config';
import { CELLS, type Grid } from './grid';
import { cellCategories, foundCount, type GameState } from './game';
import type { Memberships } from './memberships';
import { scoreGame, type Popularity } from './scoring';
import { gridNumber, isValidGridDate, type GridDate } from './date';

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
/** `YYYY-MM-DD` that is a real day: `2026-00-01` has the shape and must not get through (M3). */
const isoDate = z.string().refine(isValidGridDate, 'not a calendar date');

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
  // A finished version 2 game is history: its score is frozen and the data may have moved on since
  // (a rebuilt Pokédex, a changed category). Only a game still in progress, or one that predates
  // the frozen score, has to be consistent with the data it will be played against.
  const frozen = v2.success && state.status !== 'playing';
  for (const [cell, id] of state.cells.entries()) {
    if (id === null) continue;
    // Even a frozen game must name Pokémon that exist: the board looks each one up.
    if (id < 1 || id > memberships.count) return null;
    if (frozen) continue;
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
const historyEntrySchema = z
  .object({
    gridId: z.number().int(),
    /** Paris date of the grid: the streak is computed from it. */
    date: isoDate,
    status: z.enum(['won', 'lost', 'abandoned']),
    found: z.number().int().min(0).max(CELLS),
    errors: z.number().int().min(0).max(MAX_ERRORS),
    score: z.number().int().min(0).max(MAX_SCORE),
  })
  // The grid number is the date counted from the launch: an entry where they disagree was edited
  // or corrupted, and would let one day count twice.
  .refine(
    (entry) => isValidGridDate(entry.date) && entry.gridId === gridNumber(entry.date),
    'gridId does not match the date',
  );
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

const historyFileSchema = z.object({
  version: z.literal(HISTORY_STORAGE_VERSION),
  entries: z.array(z.unknown()),
});

/**
 * The finished games saved, checked entry by entry: a bad entry is dropped, the good ones stay
 * (one corrupt line must not wipe the whole history). At most one entry per grid and per date: if
 * the file holds several, the first one is the game that was really played.
 *
 * Migration: version 1 (phase 4) had no date and a placeholder score, and was written while the
 * game only had its demo grid. Those entries are not real games: they are dropped, not converted.
 */
export function parseHistory(raw: string | null): HistoryEntry[] {
  const file = historyFileSchema.safeParse(parseJson(raw));
  if (!file.success) return [];
  const kept: HistoryEntry[] = [];
  const grids = new Set<number>();
  const dates = new Set<GridDate>();
  for (const candidate of file.data.entries) {
    const entry = historyEntrySchema.safeParse(candidate);
    if (!entry.success) continue;
    if (grids.has(entry.data.gridId) || dates.has(entry.data.date)) continue;
    grids.add(entry.data.gridId);
    dates.add(entry.data.date);
    kept.push(entry.data);
  }
  return kept;
}

/**
 * Adds a finished game. One game per grid, and the first one wins: a finished game is never
 * replaced (two tabs finishing the same grid: a win must not overwrite a loss that came first).
 */
export function mergeHistoryEntry(
  entries: readonly HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  if (entries.some((e) => e.gridId === entry.gridId || e.date === entry.date)) return [...entries];
  return [...entries, entry];
}

export function serializeHistory(entries: readonly HistoryEntry[], entry: HistoryEntry): string {
  return JSON.stringify({
    version: HISTORY_STORAGE_VERSION,
    entries: mergeHistoryEntry(entries, entry),
  });
}

/**
 * Was this saved value written by a newer version of the game than the one that knows `known`?
 * Then it must be left untouched: the page works in memory only, and a visit from the newer
 * version later finds its data intact instead of overwritten by an older format.
 */
export function isFromNewerVersion(raw: string | null, known: number): boolean {
  const json = parseJson(raw);
  if (typeof json !== 'object' || json === null || !('version' in json)) return false;
  return typeof json.version === 'number' && json.version > known;
}

/**
 * Progress of a game: answers found plus errors made. Both only ever grow, so of two saves of the
 * same game, the one with the higher number is the later one.
 */
export function gameProgress(state: GameState): number {
  return foundCount(state) + state.errors;
}

/**
 * Should a game in memory give way to the same game as saved by another tab? Yes when the saved
 * one is over (a game finished anywhere is final) or has gone further. A game that is over in
 * memory is never replaced, and equal progress keeps what is on screen.
 */
export function shouldAdoptSaved(current: GameState, saved: GameState): boolean {
  if (saved.gridId !== current.gridId) return false;
  if (current.status !== 'playing') return false;
  if (saved.status !== 'playing') return true;
  return gameProgress(saved) > gameProgress(current);
}

/** Is this a `localStorage` key that belongs to the game? (To clear everything it saved.) */
export function isGameDataKey(key: string): boolean {
  return key.startsWith(STORAGE_PREFIX);
}
