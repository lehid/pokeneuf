import {
  abandon,
  applyGuess,
  DEVICE_ID_KEY,
  foundCount,
  GAME_STORAGE_VERSION,
  gameKey,
  HISTORY_KEY,
  HISTORY_STORAGE_VERSION,
  isFromNewerVersion,
  isOver,
  mergeHistoryEntry,
  scoreGame,
  newGame,
  parseHistory,
  parseSettings,
  parseStoredGame,
  serializeGame,
  serializeHistory,
  serializeSettings,
  SETTINGS_KEY,
  SETTINGS_STORAGE_VERSION,
  shouldAdoptSaved,
  endedOnItsDay,
  gridDateFor,
  type GameState,
  type GridDate,
  type HistoryEntry,
  type Popularity,
  type Grid,
  type GuessResult,
  type Memberships,
  type Settings,
} from '@pokeneuf/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { fr } from './i18n/fr';
import { newDeviceId, type KeyValueStorage } from './storage';

export type Dialog = 'rules' | 'abandon' | 'end' | 'stats' | null;

export interface GameStore {
  grid: Grid;
  game: GameState;
  settings: Settings;
  /**
   * The Paris date on which the game ended, `null` while it is in progress. A game that ends on
   * its own grid date is a daily game; any other (a past grid, or a game that ran past midnight)
   * is an archive: it never reaches the history, so never the stats or the streak.
   */
  finishedOn: GridDate | null;
  /** The score frozen when the game ended, `null` while it is in progress. Never recomputed. */
  finalScore: number | null;
  /** Finished daily games, for the stats and the streak. */
  history: HistoryEntry[];
  /** A short message shown for a moment ("copied"…). */
  toast: { text: string; seq: number } | null;
  /** Cell whose guess sheet is open. */
  selectedCell: number | null;
  /** Cell whose full list of answers is shown (finished games only). */
  solutionsCell: number | null;
  dialog: Dialog;
  /** The last guess, for the animation and the screen-reader announcement. `seq` makes it unique. */
  lastGuess: { cell: number; pokemonId: number; result: GuessResult; seq: number } | null;

  /** Today's date in Paris, from the store's clock (the grid on screen may be an older one). */
  today(): GridDate;
  selectCell(cell: number): void;
  closeCell(): void;
  guess(pokemonId: number): void;
  askAbandon(): void;
  confirmAbandon(): void;
  /** Brings the game up to date with what another tab saved (called on the `storage` event). */
  syncFromStorage(): void;
  openRules(): void;
  closeRules(hideNextTime: boolean): void;
  openEnd(): void;
  openStats(): void;
  showToast(text: string): void;
  clearToast(): void;
  closeDialog(): void;
  closeSolutions(): void;
}

export interface GameStoreDeps {
  grid: Grid;
  memberships: Memberships;
  popularity: Popularity;
  storage: KeyValueStorage;
  /** The clock, injectable for tests. Default: the system clock. */
  now?: () => Date;
}

function ensureDeviceId(storage: KeyValueStorage): void {
  if (storage.get(DEVICE_ID_KEY) === null) storage.set(DEVICE_ID_KEY, newDeviceId());
}

/** Why the game on screen is replaced by the one another tab saved. */
type SyncCause = 'guess' | 'abandon' | 'storage';

export function createGameStore({
  grid,
  memberships,
  popularity,
  storage,
  now = () => new Date(),
}: GameStoreDeps): StoreApi<GameStore> {
  ensureDeviceId(storage);
  const settings = parseSettings(storage.get(SETTINGS_KEY));
  const readSaved = () =>
    parseStoredGame(storage.get(gameKey(grid.id)), grid, memberships, popularity);
  const saved = readSaved();
  const game = saved?.state ?? newGame(grid);
  const fresh = foundCount(game) === 0 && game.errors === 0;

  /**
   * Writes a value, unless what is stored was written by a NEWER version of the game: it stays
   * untouched (the newer version will read it back intact) and this page works in memory only.
   */
  const write = (key: string, value: string, knownVersion: number): void => {
    if (isFromNewerVersion(storage.get(key), knownVersion)) return;
    storage.set(key, value);
  };

  /** The history as saved now (another tab may have added to it), or `fallback` if unreadable. */
  const readHistory = (fallback: HistoryEntry[]): HistoryEntry[] => {
    const raw = storage.get(HISTORY_KEY);
    return isFromNewerVersion(raw, HISTORY_STORAGE_VERSION) ? fallback : parseHistory(raw);
  };

  /** Adds a finished daily game to the history, re-read first: the first entry of a grid wins. */
  const recordHistory = (entry: HistoryEntry, inMemory: HistoryEntry[]): HistoryEntry[] => {
    const raw = storage.get(HISTORY_KEY);
    if (isFromNewerVersion(raw, HISTORY_STORAGE_VERSION)) {
      return mergeHistoryEntry(inMemory, entry);
    }
    storage.set(HISTORY_KEY, serializeHistory(parseHistory(raw), entry));
    return parseHistory(storage.get(HISTORY_KEY));
  };

  /**
   * Saves a game. While playing, the progress; at its end, the score is frozen with the day it
   * ended on, and only a game that ends on its own day (a daily game) joins the history.
   */
  const save = (
    state: GameState,
    history: HistoryEntry[],
  ): { finishedOn: GridDate | null; finalScore: number | null; history: HistoryEntry[] } => {
    if (state.status === 'playing') {
      write(
        gameKey(grid.id),
        serializeGame({ state, finishedOn: null, score: null }),
        GAME_STORAGE_VERSION,
      );
      return { finishedOn: null, finalScore: null, history };
    }
    const finishedOn = gridDateFor(now());
    const score = scoreGame(state, grid, memberships, popularity).total;
    write(gameKey(grid.id), serializeGame({ state, finishedOn, score }), GAME_STORAGE_VERSION);
    if (!endedOnItsDay(finishedOn, grid.date)) return { finishedOn, finalScore: score, history };
    const entry: HistoryEntry = {
      gridId: grid.id,
      date: grid.date,
      status: state.status,
      found: foundCount(state),
      errors: state.errors,
      score,
    };
    return { finishedOn, finalScore: score, history: recordHistory(entry, history) };
  };

  let seq = 0;
  return createStore<GameStore>()((set, get) => {
    /**
     * Before a move, and when another tab writes: if the saved game is over or went further than
     * the one on screen, the saved one wins and the player is told. Otherwise a stale tab would
     * overwrite a correct answer, "refund" errors, or turn a loss into a win.
     */
    const adoptSaved = (cause: SyncCause): boolean => {
      const other = readSaved();
      const current = get();
      if (other === null || !shouldAdoptSaved(current.game, other.state)) return false;
      const over = isOver(other.state);
      const cell = current.selectedCell;
      set({
        game: other.state,
        finishedOn: other.finishedOn,
        finalScore: other.score,
        history: readHistory(current.history),
        // The sheet stays open only while its cell is still free in the game that was adopted.
        selectedCell: over || (cell !== null && other.state.cells[cell] !== null) ? null : cell,
        dialog: over ? 'end' : current.dialog,
      });
      if (over) {
        get().showToast(cause === 'guess' ? fr.syncedFinished : fr.syncedFinishedQuiet);
      } else if (cause !== 'abandon') {
        get().showToast(cause === 'guess' ? fr.syncedProgress : fr.syncedProgressQuiet);
      }
      return true;
    };

    return {
      grid,
      game,
      settings,
      finishedOn: saved?.finishedOn ?? null,
      finalScore: saved?.score ?? null,
      history: parseHistory(storage.get(HISTORY_KEY)),
      toast: null,
      selectedCell: null,
      solutionsCell: null,
      dialog: fresh && !settings.hideRules ? 'rules' : null,
      lastGuess: null,

      today: () => gridDateFor(now()),

      selectCell(cell) {
        const { game: current } = get();
        if (isOver(current)) set({ solutionsCell: cell });
        else if (current.cells[cell] === null) set({ selectedCell: cell });
      },
      closeCell: () => set({ selectedCell: null }),

      guess(pokemonId) {
        if (get().selectedCell === null) return;
        if (adoptSaved('guess')) return;
        const { game: current, selectedCell, history } = get();
        if (selectedCell === null) return;
        const { state, result } = applyGuess(current, grid, memberships, selectedCell, pokemonId);
        if (result === 'ignored') return;
        const saves = save(state, history);
        set({
          game: state,
          selectedCell: null,
          ...saves,
          lastGuess: { cell: selectedCell, pokemonId, result, seq: ++seq },
          dialog: isOver(state) ? 'end' : get().dialog,
        });
      },

      askAbandon() {
        if (!isOver(get().game)) set({ dialog: 'abandon' });
      },
      confirmAbandon() {
        adoptSaved('abandon');
        const { game: current, history } = get();
        if (isOver(current)) return; // already over, in another tab: its result is on screen
        const state = abandon(current);
        set({ game: state, ...save(state, history), selectedCell: null, dialog: 'end' });
      },

      syncFromStorage() {
        if (!adoptSaved('storage')) set({ history: readHistory(get().history) });
      },

      openRules: () => set({ dialog: 'rules' }),
      closeRules(hideNextTime) {
        if (hideNextTime) {
          const next = { ...get().settings, hideRules: true };
          write(SETTINGS_KEY, serializeSettings(next), SETTINGS_STORAGE_VERSION);
          set({ settings: next });
        }
        set({ dialog: null });
      },
      openEnd: () => set({ dialog: 'end' }),
      openStats: () => set({ dialog: 'stats' }),
      showToast: (text) => set({ toast: { text, seq: ++seq } }),
      clearToast: () => set({ toast: null }),
      closeDialog: () => set({ dialog: null }),
      closeSolutions: () => set({ solutionsCell: null }),
    };
  });
}
