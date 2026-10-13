import {
  abandon,
  applyGuess,
  DEVICE_ID_KEY,
  foundCount,
  gameKey,
  HISTORY_KEY,
  isOver,
  scoreGame,
  newGame,
  parseHistory,
  parseSettings,
  parseStoredGame,
  serializeGame,
  serializeHistory,
  serializeSettings,
  SETTINGS_KEY,
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
import type { KeyValueStorage } from './storage';

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

  selectCell(cell: number): void;
  closeCell(): void;
  guess(pokemonId: number): void;
  askAbandon(): void;
  confirmAbandon(): void;
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
  if (storage.get(DEVICE_ID_KEY) === null) storage.set(DEVICE_ID_KEY, crypto.randomUUID());
}

export function createGameStore({
  grid,
  memberships,
  popularity,
  storage,
  now = () => new Date(),
}: GameStoreDeps): StoreApi<GameStore> {
  ensureDeviceId(storage);
  const settings = parseSettings(storage.get(SETTINGS_KEY));
  const saved = parseStoredGame(storage.get(gameKey(grid.id)), grid, memberships, popularity);
  const game = saved?.state ?? newGame(grid);
  let finishedOn: GridDate | null = saved?.finishedOn ?? null;
  const fresh = foundCount(game) === 0 && game.errors === 0;

  let history = parseHistory(storage.get(HISTORY_KEY));

  /**
   * Saves the game. At its end, the score is frozen with the day it ended on; and only a game that
   * ends on its own day (a daily game) joins the history.
   */
  const save = (state: GameState): void => {
    if (state.status === 'playing') {
      storage.set(gameKey(grid.id), serializeGame({ state, finishedOn: null, score: null }));
      return;
    }
    finishedOn = gridDateFor(now());
    const score = scoreGame(state, grid, memberships, popularity).total;
    storage.set(gameKey(grid.id), serializeGame({ state, finishedOn, score }));
    if (!endedOnItsDay(finishedOn, grid.date)) return;
    const entry: HistoryEntry = {
      gridId: grid.id,
      date: grid.date,
      status: state.status,
      found: foundCount(state),
      errors: state.errors,
      score,
    };
    storage.set(HISTORY_KEY, serializeHistory(history, entry));
    history = parseHistory(storage.get(HISTORY_KEY));
  };

  let seq = 0;
  return createStore<GameStore>()((set, get) => ({
    grid,
    game,
    settings,
    finishedOn,
    history,
    toast: null,
    selectedCell: null,
    solutionsCell: null,
    dialog: fresh && !settings.hideRules ? 'rules' : null,
    lastGuess: null,

    selectCell(cell) {
      const { game: current } = get();
      if (isOver(current)) set({ solutionsCell: cell });
      else if (current.cells[cell] === null) set({ selectedCell: cell });
    },
    closeCell: () => set({ selectedCell: null }),

    guess(pokemonId) {
      const { game: current, selectedCell } = get();
      if (selectedCell === null) return;
      const { state, result } = applyGuess(current, grid, memberships, selectedCell, pokemonId);
      if (result === 'ignored') return;
      save(state);
      set({
        game: state,
        selectedCell: null,
        history,
        finishedOn,
        lastGuess: { cell: selectedCell, pokemonId, result, seq: ++seq },
        dialog: isOver(state) ? 'end' : get().dialog,
      });
    },

    askAbandon() {
      if (!isOver(get().game)) set({ dialog: 'abandon' });
    },
    confirmAbandon() {
      const state = abandon(get().game);
      save(state);
      set({ game: state, history, finishedOn, selectedCell: null, dialog: 'end' });
    },

    openRules: () => set({ dialog: 'rules' }),
    closeRules(hideNextTime) {
      if (hideNextTime) {
        const next = { ...get().settings, hideRules: true };
        storage.set(SETTINGS_KEY, serializeSettings(next));
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
  }));
}
