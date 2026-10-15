import {
  computeStats,
  findSolution,
  gameKey,
  HISTORY_KEY,
  parseHistory,
  SETTINGS_KEY,
  solutionsFor,
} from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { demoGrid, memberships, popularity } from './data';
import { fr } from './i18n/fr';
import { memoryStorage } from './storage';
import { createGameStore } from './store';

const solution = findSolution(demoGrid, memberships) ?? [];
const WRONG = (cell: number): number => {
  const ok = new Set(solutionsFor(demoGrid, memberships, cell));
  for (let id = 1; id <= memberships.count; id++) if (!ok.has(id)) return id;
  throw new Error('every Pokémon fits');
};
/** Noon in Paris on the day of the grid: the game is played on its day. */
const ON_THE_DAY = new Date(`${demoGrid.date}T11:00:00Z`);

function single(initial: Record<string, string> = {}, now: () => Date = () => ON_THE_DAY) {
  const storage = memoryStorage(initial);
  const store = createGameStore({ grid: demoGrid, memberships, popularity, storage, now });
  return {
    storage,
    state: () => store.getState(),
    play: (cell: number, id: number) => {
      store.getState().selectCell(cell);
      store.getState().guess(id);
    },
  };
}

/** Two tabs of the same browser: two stores over one storage, each with its own memory. */
function twoTabs(initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial);
  const tab = () => {
    const store = createGameStore({
      grid: demoGrid,
      memberships,
      popularity,
      storage,
      now: () => ON_THE_DAY,
    });
    return {
      state: () => store.getState(),
      play: (cell: number, id: number) => {
        store.getState().selectCell(cell);
        store.getState().guess(id);
      },
    };
  };
  return { storage, a: tab(), b: tab() };
}

const filled = (cells: (number | null)[]) => cells.filter((c) => c !== null).length;

describe('two tabs on the same grid (M2)', () => {
  it('adopts a correct answer saved by the other tab instead of overwriting it', () => {
    const { a, b, storage } = twoTabs();
    b.play(0, solution[0] ?? 0);
    a.state().selectCell(1);
    a.state().guess(WRONG(1)); // stale: it still thinks nothing was played
    expect(a.state().game.cells[0]).toBe(solution[0]);
    expect(a.state().game.errors).toBe(0); // the wrong answer was not played
    expect(a.state().selectedCell).toBe(1); // the sheet stays open on a free cell
    expect(a.state().toast?.text).toBe(fr.syncedProgress);
    expect(JSON.parse(storage.get(gameKey(demoGrid.id)) ?? '{}')).toMatchObject({
      cells: [solution[0], ...Array(8).fill(null)],
      errors: 0,
    });
  });

  it('does not refund errors: the errors made in the other tab are kept', () => {
    const { a, b } = twoTabs();
    b.play(0, WRONG(0));
    b.play(0, WRONG(0));
    a.play(0, solution[0] ?? 0); // stale tab, 0 errors on screen
    expect(a.state().game.errors).toBe(2);
    expect(a.state().game.cells[0]).toBeNull();
    // Once up to date, the same move is simply played.
    a.play(0, solution[0] ?? 0);
    expect(a.state().game.cells[0]).toBe(solution[0]);
    expect(a.state().game.errors).toBe(2);
  });

  it('shows the end of a game finished in the other tab, with its frozen score', () => {
    const { a, b, storage } = twoTabs();
    for (let i = 0; i < 3; i++) b.play(0, WRONG(0));
    expect(b.state().game.status).toBe('lost');
    a.play(1, solution[1] ?? 0);
    expect(a.state().game.status).toBe('lost');
    expect(a.state().game.cells[1]).toBeNull();
    expect(a.state().dialog).toBe('end');
    expect(a.state().finalScore).toBe(b.state().finalScore);
    expect(a.state().finishedOn).toBe(demoGrid.date);
    expect(a.state().toast?.text).toBe(fr.syncedFinished);
    expect(parseHistory(storage.get(HISTORY_KEY))).toHaveLength(1);
  });

  it('never turns a finished game into another in the history: the first one is kept', () => {
    const { a, b, storage } = twoTabs();
    // Tab A is one move from winning; tab B (which first catches up with A) abandons.
    solution.slice(0, 8).forEach((id, cell) => a.play(cell, id));
    b.state().askAbandon();
    b.state().confirmAbandon();
    expect(b.state().game.status).toBe('abandoned');
    a.play(8, solution[8] ?? 0);
    expect(a.state().game.status).toBe('abandoned'); // A gave way: no win replaces it
    const entries = parseHistory(storage.get(HISTORY_KEY));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('abandoned');
  });

  it('abandoning in a stale tab keeps the progress made elsewhere', () => {
    const { a, b } = twoTabs();
    b.play(0, solution[0] ?? 0);
    a.state().askAbandon();
    a.state().confirmAbandon();
    expect(a.state().game.status).toBe('abandoned');
    expect(a.state().game.cells[0]).toBe(solution[0]);
    expect(a.state().history[0]?.found).toBe(1);
  });

  it('keeps what it has when it is further along than the save, and the other tab follows', () => {
    const { a, b } = twoTabs();
    a.play(0, solution[0] ?? 0);
    a.play(1, solution[1] ?? 0);
    b.play(2, solution[2] ?? 0); // B catches up first, then plays
    expect(filled(b.state().game.cells)).toBe(2);
    expect(b.state().game.cells[2]).toBeNull();
    a.state().syncFromStorage();
    expect(filled(a.state().game.cells)).toBe(2); // nothing to adopt: same progress
  });

  it('syncs on the storage event, without a move, and tells the player quietly', () => {
    const { a, b } = twoTabs();
    b.play(4, solution[4] ?? 0);
    a.state().syncFromStorage();
    expect(a.state().game.cells[4]).toBe(solution[4]);
    expect(a.state().toast?.text).toBe(fr.syncedProgressQuiet);
    a.state().clearToast();
    a.state().syncFromStorage(); // nothing new to adopt: no second message
    expect(a.state().toast).toBeNull();
  });

  it('opens the result when the other tab finished the game', () => {
    const { a, b } = twoTabs();
    b.state().askAbandon();
    b.state().confirmAbandon();
    a.state().syncFromStorage();
    expect(a.state().dialog).toBe('end');
    expect(a.state().game.status).toBe('abandoned');
    expect(a.state().history).toEqual(b.state().history);
    expect(a.state().toast?.text).toBe(fr.syncedFinishedQuiet);
  });

  it('does not lose what other tabs wrote to the history meanwhile', () => {
    const { a, storage } = twoTabs();
    const other = { gridId: 3, date: '2026-11-03', status: 'won', found: 9, errors: 0, score: 500 };
    storage.set(HISTORY_KEY, JSON.stringify({ version: 2, entries: [other] }));
    a.state().askAbandon();
    a.state().confirmAbandon();
    expect(parseHistory(storage.get(HISTORY_KEY)).map((e) => e.gridId)).toEqual([3, 1]);
    expect(a.state().history.map((e) => e.gridId)).toEqual([3, 1]);
  });
});

describe('a finished game keeps its frozen score (M13)', () => {
  it('exposes the stored score, not a recomputed one', () => {
    const first = single();
    first.state().askAbandon();
    first.state().confirmAbandon();
    const raw = JSON.parse(first.storage.get(gameKey(demoGrid.id)) ?? '{}') as Record<
      string,
      unknown
    >;
    const again = single({ [gameKey(demoGrid.id)]: JSON.stringify({ ...raw, score: 123 }) });
    expect(again.state().finalScore).toBe(123);
    expect(again.state().game.status).toBe('abandoned');
  });

  it('is null while the game is in progress', () => {
    expect(single().state().finalScore).toBeNull();
  });

  it('survives a change of the data: a finished game whose cells no longer fit is still shown', () => {
    const won = {
      version: 2,
      gridId: demoGrid.id,
      cells: [WRONG(0), ...solution.slice(1)],
      errors: 0,
      status: 'won',
      finishedOn: demoGrid.date,
      score: 777,
    };
    const { state } = single({ [gameKey(demoGrid.id)]: JSON.stringify(won) });
    expect(state().game.status).toBe('won');
    expect(state().finalScore).toBe(777);
  });
});

describe('corrupted or newer storage (M3)', () => {
  it('survives a date that has the shape of a date but is not one', () => {
    const entry = { gridId: 1, date: '2026-00-01', status: 'won', found: 9, errors: 0, score: 5 };
    const { state } = single({
      [HISTORY_KEY]: JSON.stringify({ version: 2, entries: [entry] }),
      [gameKey(demoGrid.id)]: JSON.stringify({
        version: 2,
        gridId: demoGrid.id,
        cells: Array(9).fill(null),
        errors: 3,
        status: 'lost',
        finishedOn: '2026-00-01',
        score: 0,
      }),
    });
    expect(state().history).toEqual([]);
    expect(state().game.status).toBe('playing');
    expect(computeStats(state().history, state().today()).streak).toBe(0);
  });

  it('keeps the good entries of a history that holds a bad one', () => {
    const good = { gridId: 2, date: '2026-11-02', status: 'won', found: 9, errors: 0, score: 400 };
    const bad = { ...good, gridId: 3, date: '2026-11-99' };
    const { state } = single({
      [HISTORY_KEY]: JSON.stringify({ version: 2, entries: [bad, good] }),
    });
    expect(state().history).toEqual([good]);
  });

  it('never overwrites what a NEWER version of the game saved: it plays in memory only', () => {
    const newerGame = JSON.stringify({ version: 3, anything: 'from the future' });
    const newerHistory = JSON.stringify({ version: 3, rows: ['from the future'] });
    const newerSettings = JSON.stringify({ version: 2, hideRules: true, theme: 'dark' });
    const { state, storage, play } = single({
      [gameKey(demoGrid.id)]: newerGame,
      [HISTORY_KEY]: newerHistory,
      [SETTINGS_KEY]: newerSettings,
    });
    state().closeRules(true);
    solution.forEach((id, cell) => play(cell, id));
    expect(state().game.status).toBe('won'); // the game itself works
    expect(state().history).toHaveLength(1); // and counts, in memory
    expect(storage.get(gameKey(demoGrid.id))).toBe(newerGame);
    expect(storage.get(HISTORY_KEY)).toBe(newerHistory);
    expect(storage.get(SETTINGS_KEY)).toBe(newerSettings);
  });
});

describe('the clock of the store', () => {
  it('gives the real Paris date, whatever grid is on screen (M5b)', () => {
    const { state } = single({}, () => new Date('2026-12-24T12:00:00Z'));
    expect(state().grid.date).toBe(demoGrid.date);
    expect(state().today()).toBe('2026-12-24');
  });
});
