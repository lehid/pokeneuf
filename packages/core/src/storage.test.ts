import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import { scoreGame } from './scoring';
import {
  DEFAULT_SETTINGS,
  gameKey,
  parseHistory,
  parseSettings,
  parseStoredGame,
  serializeGame,
  serializeHistory,
  readGameSummary,
  serializeSettings,
  type SavedGame,
} from './storage';
import { worldGrid as grid, worldMemberships as memberships, worldSolution } from './test-world';

const known = (id: number) => 1 / id;
const parse = (raw: string | null) => parseStoredGame(raw, grid, memberships, known);
const cellsOf = (n: number) => worldSolution.map((id, i) => (i < n ? id : null));
const saved = (state: GameState, finishedOn: string | null, score: number | null): SavedGame => ({
  state,
  finishedOn,
  score,
});
const expectedScore = (state: GameState) => scoreGame(state, grid, memberships, known).total;

describe('stored game', () => {
  it('round-trips a game in progress, a won game, a lost one and an abandoned one', () => {
    const games: SavedGame[] = [
      saved({ ...newGame(grid), cells: cellsOf(4), errors: 2 }, null, null),
      saved({ ...newGame(grid), cells: cellsOf(9), status: 'won' }, '2026-11-01', 612),
      saved({ ...newGame(grid), cells: cellsOf(2), errors: 3, status: 'lost' }, '2026-11-09', 80),
      saved({ ...newGame(grid), status: 'abandoned' }, '2026-11-01', 0),
    ];
    for (const game of games) expect(parse(serializeGame(game))).toEqual(game);
  });

  it('keys saves by grid number under the versioned prefix', () => {
    expect(gameKey(12)).toBe('pokeneuf:v1:game:12');
  });

  it('is versioned: a file from an unknown version is ignored', () => {
    const file = JSON.parse(serializeGame(saved(newGame(grid), null, null))) as Record<
      string,
      unknown
    >;
    expect(file.version).toBe(2);
    expect(parse(JSON.stringify({ ...file, version: 3 }))).toBeNull();
    expect(parse(JSON.stringify({ ...file, version: 0 }))).toBeNull();
  });

  it('migrates version 1: a game that had ended was a daily one, its score is computed now', () => {
    const state: GameState = { ...newGame(grid), cells: cellsOf(9), status: 'won' };
    const v1 = JSON.stringify({ version: 1, ...state });
    expect(parse(v1)).toEqual(saved(state, grid.date, expectedScore(state)));
    const playing: GameState = { ...newGame(grid), cells: cellsOf(3), errors: 1 };
    expect(parse(JSON.stringify({ version: 1, ...playing }))).toEqual(saved(playing, null, null));
  });

  it('wants an end date and a score exactly when the game is over', () => {
    const playing = { ...newGame(grid), cells: cellsOf(3) };
    const won = { ...newGame(grid), cells: cellsOf(9), status: 'won' as const };
    const file = (state: GameState, finishedOn: string | null, score: number | null) =>
      JSON.stringify({ version: 2, ...state, finishedOn, score });
    expect(parse(file(playing, '2026-11-01', null))).toBeNull();
    expect(parse(file(playing, null, 10))).toBeNull();
    expect(parse(file(won, null, 500))).toBeNull();
    expect(parse(file(won, '2026-11-01', null))).toBeNull();
    expect(parse(file(won, 'hier', 500))).toBeNull();
    expect(parse(file(won, '2026-11-01', 901))).toBeNull();
    expect(parse(file(won, '2026-11-01', 500))).not.toBeNull();
  });

  it('drops anything it cannot trust', () => {
    const good = { ...newGame(grid), cells: cellsOf(3) };
    const bad: unknown[] = [
      null,
      'not json',
      '{}',
      { ...good, version: 1, gridId: 2 }, // another grid
      { ...good, version: 1, cells: cellsOf(3).slice(0, 8) },
      { ...good, version: 1, errors: 4 },
      { ...good, version: 1, errors: -1 },
      { ...good, version: 1, status: 'won' }, // won with empty cells
      { ...good, version: 1, status: 'lost' }, // lost with 0 errors
      { ...good, version: 1, errors: 3 }, // still playing with 3 errors
      {
        ...good,
        version: 1,
        cells: [...cellsOf(3).slice(0, 2), worldSolution[0] ?? 0, ...cellsOf(0).slice(3)],
      }, // duplicate
      { ...good, version: 1, cells: [1, ...cellsOf(0).slice(1)] }, // does not fit the cell
      { ...good, version: 1, cells: [99999, ...cellsOf(0).slice(1)] },
    ];
    for (const value of bad) {
      expect(
        parse(typeof value === 'string' || value === null ? value : JSON.stringify(value)),
      ).toBeNull();
    }
  });
});

describe('readGameSummary', () => {
  it('reads the status, the cells found, the end date and the frozen score', () => {
    const won = saved({ ...newGame(grid), cells: cellsOf(9), status: 'won' }, '2026-11-03', 640);
    expect(readGameSummary(serializeGame(won), grid.date)).toEqual({
      status: 'won',
      found: 9,
      finishedOn: '2026-11-03',
      score: 640,
    });
    const playing = saved({ ...newGame(grid), cells: cellsOf(4) }, null, null);
    expect(readGameSummary(serializeGame(playing), grid.date)).toEqual({
      status: 'playing',
      found: 4,
      finishedOn: null,
      score: null,
    });
  });

  it('reads a version 1 game too: ended games were daily games, with no known score', () => {
    const lost = { ...newGame(grid), cells: cellsOf(2), errors: 3, status: 'lost' as const };
    expect(readGameSummary(JSON.stringify({ version: 1, ...lost }), '2026-11-05')).toEqual({
      status: 'lost',
      found: 2,
      finishedOn: '2026-11-05',
      score: null,
    });
  });

  it('is null for nothing, garbage or another version', () => {
    expect(readGameSummary(null, grid.date)).toBeNull();
    expect(readGameSummary('oops', grid.date)).toBeNull();
    expect(readGameSummary(JSON.stringify({ version: 9 }), grid.date)).toBeNull();
  });
});

describe('settings', () => {
  it('round-trips', () => {
    expect(parseSettings(serializeSettings({ hideRules: true }))).toEqual({ hideRules: true });
  });

  it('falls back to the defaults when missing, corrupt or from another version', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ version: 9, hideRules: true }))).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});

describe('history', () => {
  const entry = {
    gridId: 1,
    date: '2026-11-01',
    status: 'won',
    found: 9,
    errors: 1,
    score: 684,
  } as const;

  it('keeps one entry per grid', () => {
    const first = serializeHistory([], entry);
    expect(parseHistory(first)).toEqual([entry]);
    const replaced = serializeHistory(parseHistory(first), { ...entry, status: 'lost', found: 3 });
    expect(parseHistory(replaced)).toEqual([{ ...entry, status: 'lost', found: 3 }]);
    const other = serializeHistory(parseHistory(first), { ...entry, gridId: 2 });
    expect(parseHistory(other)).toHaveLength(2);
  });

  it('drops a version 1 history: no date, placeholder scores, written while only the demo existed', () => {
    const v1 = { gridId: 1, status: 'won', found: 9, errors: 1, score: 1015 };
    expect(parseHistory(JSON.stringify({ version: 1, entries: [v1] }))).toEqual([]);
  });

  it('refuses a score above the maximum, or a bad date', () => {
    expect(
      parseHistory(JSON.stringify({ version: 2, entries: [{ ...entry, score: 901 }] })),
    ).toEqual([]);
    expect(
      parseHistory(JSON.stringify({ version: 2, entries: [{ ...entry, date: 'demain' }] })),
    ).toEqual([]);
  });

  it('is empty when missing, corrupt or from another version', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('{')).toEqual([]);
    expect(parseHistory(JSON.stringify({ version: 3, entries: [entry] }))).toEqual([]);
  });
});
