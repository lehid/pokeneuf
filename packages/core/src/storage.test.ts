import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import { scoreGame } from './scoring';
import {
  DEFAULT_SETTINGS,
  GAME_STORAGE_VERSION,
  HISTORY_STORAGE_VERSION,
  SETTINGS_STORAGE_VERSION,
  gameKey,
  gameProgress,
  isFromNewerVersion,
  isGameDataKey,
  mergeHistoryEntry,
  parseHistory,
  shouldAdoptSaved,
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
    // Shaped like a date, not a day of the calendar: it would make the stats throw (M3).
    expect(parse(file(won, '2026-00-01', 500))).toBeNull();
    expect(parse(file(won, '2026-11-99', 500))).toBeNull();
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

describe('a finished game outlives the data it was played with', () => {
  const won = { ...newGame(grid), cells: cellsOf(9), status: 'won' as const };

  it('is kept, with its frozen score, even when its cells no longer fit the categories', () => {
    // Pokémon n° 1 does not fit cell 0 of this grid: as if a rebuilt Pokédex had changed.
    const moved = [1, ...worldSolution.slice(1)];
    const finished = { ...won, cells: moved };
    const file = serializeGame(saved(finished, '2026-11-01', 712));
    expect(parse(file)).toEqual(saved(finished, '2026-11-01', 712));
  });

  it('but a game in progress still has to fit, and so does a version 1 game', () => {
    const moved = [1, ...cellsOf(3).slice(1)];
    expect(parse(serializeGame(saved({ ...newGame(grid), cells: moved }, null, null)))).toBeNull();
    const v1 = JSON.stringify({ version: 1, ...won, cells: [1, ...worldSolution.slice(1)] });
    expect(parse(v1)).toBeNull();
  });

  it('still names Pokémon that exist and no Pokémon twice', () => {
    const unknown = { ...won, cells: [99999, ...worldSolution.slice(1)] };
    expect(parse(serializeGame(saved(unknown, '2026-11-01', 500)))).toBeNull();
    const twice = { ...won, cells: [worldSolution[1] ?? 0, ...worldSolution.slice(1)] };
    expect(parse(serializeGame(saved(twice, '2026-11-01', 500)))).toBeNull();
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

  it('keeps one entry per grid, and the first one wins: a finished game is never replaced', () => {
    const first = serializeHistory([], entry);
    expect(parseHistory(first)).toEqual([entry]);
    const lateLoss = { ...entry, status: 'lost', found: 3, score: 12 } as const;
    const again = serializeHistory(parseHistory(first), lateLoss);
    expect(parseHistory(again)).toEqual([entry]);
    // ...whichever order the two tabs finished in.
    const reverse = serializeHistory(parseHistory(serializeHistory([], lateLoss)), entry);
    expect(parseHistory(reverse)).toEqual([lateLoss]);
    const next = { ...entry, gridId: 2, date: '2026-11-02' };
    expect(parseHistory(serializeHistory(parseHistory(first), next))).toHaveLength(2);
  });

  it('merges without touching the entries it was given', () => {
    const entries = [entry];
    const merged = mergeHistoryEntry(entries, { ...entry, gridId: 2, date: '2026-11-02' });
    expect(merged).toHaveLength(2);
    expect(entries).toHaveLength(1);
    expect(mergeHistoryEntry(entries, { ...entry, status: 'lost' })).toEqual([entry]);
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

  it('is checked entry by entry: a bad one is dropped, the good ones stay', () => {
    const second = { ...entry, gridId: 2, date: '2026-11-02' };
    const third = { ...entry, gridId: 3, date: '2026-11-03' };
    const file = (entries: unknown[]) => JSON.stringify({ version: 2, entries });
    expect(
      parseHistory(
        file([
          entry,
          { ...second, date: '2026-00-01' }, // shaped like a date, is not one
          { ...second, score: 9999 },
          'garbage',
          null,
          third,
        ]),
      ),
    ).toEqual([entry, third]);
  });

  it('drops an entry whose grid number is not its date counted from the launch', () => {
    const file = (entries: unknown[]) => JSON.stringify({ version: 2, entries });
    const third = { ...entry, gridId: 3, date: '2026-11-03' };
    expect(parseHistory(file([{ ...entry, gridId: 7 }]))).toEqual([]);
    expect(parseHistory(file([{ ...entry, gridId: 2 }, third]))).toEqual([third]);
  });

  it('keeps one entry per grid and per date when the file holds several: the first one', () => {
    const file = JSON.stringify({
      version: 2,
      entries: [entry, { ...entry, status: 'lost', score: 5 }, { ...entry, gridId: 2 }],
    });
    expect(parseHistory(file)).toEqual([entry]);
  });

  it('is empty when missing, corrupt or from another version', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('{')).toEqual([]);
    expect(parseHistory(JSON.stringify({ version: 3, entries: [entry] }))).toEqual([]);
  });
});

describe('storage written by a newer version', () => {
  it('is recognised by its version, for every kind of save', () => {
    expect(isFromNewerVersion(JSON.stringify({ version: 3 }), HISTORY_STORAGE_VERSION)).toBe(true);
    expect(isFromNewerVersion(JSON.stringify({ version: 3 }), GAME_STORAGE_VERSION)).toBe(true);
    expect(isFromNewerVersion(JSON.stringify({ version: 2 }), SETTINGS_STORAGE_VERSION)).toBe(true);
  });

  it('is not confused with the current version, older ones, or garbage', () => {
    expect(isFromNewerVersion(JSON.stringify({ version: 2 }), 2)).toBe(false);
    expect(isFromNewerVersion(JSON.stringify({ version: 1 }), 2)).toBe(false);
    for (const raw of [null, '', '{', '[]', '3', 'null', '{"version":"9"}', '{"entries":[]}']) {
      expect(isFromNewerVersion(raw, 2), String(raw)).toBe(false);
    }
  });
});

describe('two tabs on the same grid', () => {
  const playing = (found: number, errors = 0): GameState => ({
    ...newGame(grid),
    cells: cellsOf(found),
    errors,
  });
  const over = (status: 'won' | 'lost' | 'abandoned'): GameState => ({
    ...newGame(grid),
    cells: cellsOf(status === 'won' ? 9 : 1),
    errors: status === 'lost' ? 3 : 0,
    status,
  });

  it('measures progress as answers found plus errors made', () => {
    expect(gameProgress(playing(0))).toBe(0);
    expect(gameProgress(playing(3, 1))).toBe(4);
  });

  it('adopts a saved game that went further, or that is over', () => {
    expect(shouldAdoptSaved(playing(1), playing(2))).toBe(true);
    expect(shouldAdoptSaved(playing(1), playing(1, 1))).toBe(true); // an error counts
    expect(shouldAdoptSaved(playing(5), over('lost'))).toBe(true);
    expect(shouldAdoptSaved(playing(0), over('abandoned'))).toBe(true);
  });

  it('keeps what is on screen when it is as far along, or further', () => {
    expect(shouldAdoptSaved(playing(2), playing(2))).toBe(false);
    expect(shouldAdoptSaved(playing(3), playing(1))).toBe(false);
  });

  it('never replaces a game that is over, even by another that is over', () => {
    expect(shouldAdoptSaved(over('lost'), over('won'))).toBe(false);
    expect(shouldAdoptSaved(over('abandoned'), playing(4))).toBe(false);
  });

  it('never adopts the save of another grid', () => {
    expect(shouldAdoptSaved(playing(1), { ...playing(5), gridId: 2 })).toBe(false);
  });
});

describe('isGameDataKey', () => {
  it('is every key under the versioned prefix, demo ones included, and only those', () => {
    expect(isGameDataKey(gameKey(3))).toBe(true);
    expect(isGameDataKey('pokeneuf:v1:history')).toBe(true);
    expect(isGameDataKey('pokeneuf:v1:demo:game:1')).toBe(true);
    expect(isGameDataKey('something-else')).toBe(false);
    expect(isGameDataKey('pokeneuf:v2:game:1')).toBe(false);
  });
});
