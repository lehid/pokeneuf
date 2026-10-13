import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import {
  DEFAULT_SETTINGS,
  gameKey,
  parseHistory,
  parseSettings,
  parseStoredGame,
  serializeGame,
  serializeHistory,
  serializeSettings,
} from './storage';
import { worldGrid as grid, worldMemberships as memberships, worldSolution } from './test-world';

const parse = (raw: string | null) => parseStoredGame(raw, grid, memberships);
const cellsOf = (n: number) => worldSolution.map((id, i) => (i < n ? id : null));

describe('stored game', () => {
  it('round-trips a game in progress, a won game and a lost one', () => {
    const states: GameState[] = [
      { ...newGame(grid), cells: cellsOf(4), errors: 2 },
      { ...newGame(grid), cells: cellsOf(9), status: 'won' },
      { ...newGame(grid), cells: cellsOf(2), errors: 3, status: 'lost' },
      { ...newGame(grid), status: 'abandoned' },
    ];
    for (const state of states) expect(parse(serializeGame(state))).toEqual(state);
  });

  it('keys saves by grid number under the versioned prefix', () => {
    expect(gameKey(12)).toBe('pokeneuf:v1:game:12');
  });

  it('is versioned: a file from an unknown version is ignored', () => {
    const saved = JSON.parse(serializeGame(newGame(grid))) as Record<string, unknown>;
    expect(parse(JSON.stringify({ ...saved, version: 2 }))).toBeNull();
    expect(parse(JSON.stringify({ ...saved, version: 0 }))).toBeNull();
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
  const entry = { gridId: 1, status: 'won', found: 9, errors: 1, score: 1015 } as const;

  it('keeps one entry per grid', () => {
    const first = serializeHistory([], entry);
    expect(parseHistory(first)).toEqual([entry]);
    const replaced = serializeHistory(parseHistory(first), { ...entry, status: 'lost', found: 3 });
    expect(parseHistory(replaced)).toEqual([{ ...entry, status: 'lost', found: 3 }]);
    const other = serializeHistory(parseHistory(first), { ...entry, gridId: 2 });
    expect(parseHistory(other)).toHaveLength(2);
  });

  it('is empty when missing, corrupt or from another version', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('{')).toEqual([]);
    expect(parseHistory(JSON.stringify({ version: 2, entries: [entry] }))).toEqual([]);
  });
});
