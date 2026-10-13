import {
  DEVICE_ID_KEY,
  gameKey,
  HISTORY_KEY,
  parseHistory,
  SETTINGS_KEY,
  solutionsFor,
  findSolution,
  scoreGame,
  checkGrid,
} from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { demoGrid, memberships, popularity } from './data';
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

function setup(initial: Record<string, string> = {}, now: () => Date = () => ON_THE_DAY) {
  const storage = memoryStorage(initial);
  const store = createGameStore({ grid: demoGrid, memberships, popularity, storage, now });
  const play = (cell: number, id: number) => {
    store.getState().selectCell(cell);
    store.getState().guess(id);
  };
  return { storage, store, play, state: () => store.getState() };
}

describe('game store', () => {
  it('plays a valid demo grid', () => {
    expect(checkGrid(demoGrid, memberships)).toEqual([]);
  });

  it('has a solution to play with', () => {
    expect(solution).toHaveLength(9);
  });

  it('opens the rules on first launch, unless told not to', () => {
    const { state, store } = setup();
    expect(state().dialog).toBe('rules');
    state().closeRules(true);
    expect(state().dialog).toBeNull();
    expect(store.getState().settings.hideRules).toBe(true);
  });

  it('remembers "ne plus afficher"', () => {
    const first = setup();
    first.state().closeRules(true);
    const second = setup(Object.fromEntries(first.storage.data));
    expect(second.state().dialog).toBeNull();
  });

  it('shows the rules again when "ne plus afficher" was not ticked', () => {
    const first = setup();
    first.state().closeRules(false);
    expect(first.storage.data.has(SETTINGS_KEY)).toBe(false);
    expect(setup(Object.fromEntries(first.storage.data)).state().dialog).toBe('rules');
  });

  it('wins a game, freezes its score and records it with its date', () => {
    const { state, play, storage } = setup();
    solution.forEach((id, cell) => play(cell, id));
    expect(state().game.status).toBe('won');
    expect(state().dialog).toBe('end');
    const score = scoreGame(state().game, demoGrid, memberships, popularity).total;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(900);
    const entries = parseHistory(storage.get(HISTORY_KEY));
    expect(entries).toEqual([
      { gridId: demoGrid.id, date: demoGrid.date, status: 'won', found: 9, errors: 0, score },
    ]);
    expect(state().history).toEqual(entries);
  });

  it('keeps one history entry per grid and feeds the streak and the stats', () => {
    const first = setup();
    first.state().askAbandon();
    first.state().confirmAbandon();
    expect(first.state().history).toHaveLength(1);
    expect(first.state().history[0]?.status).toBe('abandoned');
    // The history survives a refresh.
    const second = setup(Object.fromEntries(first.storage.data));
    expect(second.state().history).toEqual(first.state().history);
  });

  it('records the end date of a game with its frozen score, and a refresh keeps both', () => {
    const first = setup();
    first.state().askAbandon();
    first.state().confirmAbandon();
    expect(first.state().finishedOn).toBe(demoGrid.date);
    const raw = JSON.parse(first.storage.get(gameKey(demoGrid.id)) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(raw).toMatchObject({
      version: 2,
      status: 'abandoned',
      finishedOn: demoGrid.date,
      score: 0,
    });
    const second = setup(Object.fromEntries(first.storage.data));
    expect(second.state().finishedOn).toBe(demoGrid.date);
  });

  it('counts a game that ends after the day of its grid as an archive: no history, no streak', () => {
    let now = new Date(`${demoGrid.date}T22:30:00Z`); // 23:30 in Paris, still the day
    const { state, play, storage } = setup({}, () => now);
    play(0, solution[0] ?? 0);
    play(1, solution[1] ?? 0);
    now = new Date(`${demoGrid.date}T23:30:00Z`); // 00:30 in Paris: the day is over
    solution.slice(2).forEach((id, i) => play(i + 2, id));
    expect(state().game.status).toBe('won');
    expect(state().finishedOn).toBe('2026-11-02');
    expect(state().history).toEqual([]);
    expect(storage.get(HISTORY_KEY)).toBeNull();
    // …but the game itself is saved and frozen, as an archive.
    expect(JSON.parse(storage.get(gameKey(demoGrid.id)) ?? '{}')).toMatchObject({
      status: 'won',
      finishedOn: '2026-11-02',
    });
  });

  it('counts a past grid played from the archives as an archive too', () => {
    const { state, play, storage } = setup({}, () => new Date('2026-12-24T12:00:00Z'));
    solution.forEach((id, cell) => play(cell, id));
    expect(state().game.status).toBe('won');
    expect(state().history).toEqual([]);
    expect(storage.get(HISTORY_KEY)).toBeNull();
  });

  it('counts a game that ends on its own day as a daily game, even a few seconds before midnight', () => {
    const { state, play } = setup({}, () => new Date(`${demoGrid.date}T22:59:59Z`));
    solution.forEach((id, cell) => play(cell, id));
    expect(state().history).toHaveLength(1);
    expect(state().finishedOn).toBe(demoGrid.date);
  });

  it('resumes an unfinished game the day after, to finish it as an archive', () => {
    const first = setup();
    first.play(0, solution[0] ?? 0);
    const next = setup(
      Object.fromEntries(first.storage.data),
      () => new Date('2026-11-02T12:00:00Z'),
    );
    expect(next.state().game.cells[0]).toBe(solution[0]);
    expect(next.state().finishedOn).toBeNull();
    solution.slice(1).forEach((id, i) => next.play(i + 1, id));
    expect(next.state().finishedOn).toBe('2026-11-02');
    expect(next.state().history).toEqual([]);
  });

  it('shows and clears a toast', () => {
    const { state } = setup();
    state().showToast('Copié');
    expect(state().toast?.text).toBe('Copié');
    state().clearToast();
    expect(state().toast).toBeNull();
  });

  it('loses after three wrong answers and leaves the cell empty', () => {
    const { state, play } = setup();
    for (let i = 0; i < 3; i++) play(0, WRONG(0));
    expect(state().game.status).toBe('lost');
    expect(state().game.cells[0]).toBeNull();
    expect(state().lastGuess?.result).toBe('wrong');
    expect(state().dialog).toBe('end');
  });

  it('abandons after confirmation only', () => {
    const { state } = setup();
    state().askAbandon();
    expect(state().dialog).toBe('abandon');
    state().closeDialog();
    expect(state().game.status).toBe('playing');
    state().askAbandon();
    state().confirmAbandon();
    expect(state().game.status).toBe('abandoned');
    expect(state().dialog).toBe('end');
  });

  it('does not open a filled cell, but shows the solutions once the game is over', () => {
    const { state, play } = setup();
    play(0, solution[0] ?? 0);
    state().selectCell(0);
    expect(state().selectedCell).toBeNull();
    state().askAbandon();
    state().confirmAbandon();
    state().selectCell(4);
    expect(state().solutionsCell).toBe(4);
    expect(state().selectedCell).toBeNull();
  });

  it('resumes a game after a "refresh"', () => {
    const first = setup();
    first.play(0, solution[0] ?? 0);
    first.play(1, WRONG(1));
    const second = setup(Object.fromEntries(first.storage.data));
    expect(second.state().game).toEqual(first.state().game);
    expect(second.state().dialog).toBeNull(); // no rules popup mid-game
  });

  it('ignores a corrupt save and starts over', () => {
    const { state } = setup({ [gameKey(demoGrid.id)]: '{"version":1,"oops":true}' });
    expect(state().game.cells.every((c) => c === null)).toBe(true);
  });

  it('creates a device id once', () => {
    const first = setup();
    const id = first.storage.get(DEVICE_ID_KEY);
    expect(id).toBeTruthy();
    expect(setup(Object.fromEntries(first.storage.data)).storage.get(DEVICE_ID_KEY)).toBe(id);
  });
});
