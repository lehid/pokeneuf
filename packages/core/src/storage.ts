import { z } from 'zod';
import { MAX_ERRORS, MAX_SCORE, STORAGE_PREFIX } from './config';
import { CELLS, type Grid } from './grid';
import { cellCategories, type GameState } from './game';
import type { Memberships } from './memberships';

/**
 * Persistence formats (ROADMAP phase 4). Pure: this module parses and serializes strings; reading
 * and writing `localStorage` is the web app's job. Any schema change = bump the version, add a
 * migration here and a test.
 */
export const GAME_STORAGE_VERSION = 1;
export const SETTINGS_STORAGE_VERSION = 1;
export const HISTORY_STORAGE_VERSION = 2;

export const gameKey = (gridId: number): string => `${STORAGE_PREFIX}game:${gridId}`;
export const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
export const HISTORY_KEY = `${STORAGE_PREFIX}history`;
export const DEVICE_ID_KEY = `${STORAGE_PREFIX}deviceId`;

const storedGameSchema = z.object({
  version: z.literal(GAME_STORAGE_VERSION),
  gridId: z.number().int(),
  cells: z.array(z.number().int().nullable()).length(CELLS),
  errors: z.number().int().min(0).max(MAX_ERRORS),
  status: z.enum(['playing', 'won', 'lost', 'abandoned']),
});
export type StoredGame = z.infer<typeof storedGameSchema>;

export function serializeGame(state: GameState): string {
  const stored: StoredGame = { version: GAME_STORAGE_VERSION, ...state };
  return JSON.stringify(stored);
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
 * dropped rather than repaired: the player simply restarts today's grid.
 */
export function parseStoredGame(
  raw: string | null,
  grid: Grid,
  memberships: Memberships,
): GameState | null {
  const parsed = storedGameSchema.safeParse(parseJson(raw));
  if (!parsed.success) return null;
  const { gridId, cells, errors, status } = parsed.data;
  const state: GameState = { gridId, cells, errors, status };
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
  return state;
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
