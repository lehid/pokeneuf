import { MAX_ERRORS } from './config';
import { CELLS, type Grid } from './grid';
import type { Memberships } from './memberships';

export type GameStatus = 'playing' | 'won' | 'lost' | 'abandoned';

/** Everything that defines a game in progress. Plain data: it is what gets saved. */
export interface GameState {
  gridId: number;
  /** National number placed in each cell (row-major), or `null` while empty. */
  cells: (number | null)[];
  errors: number;
  status: GameStatus;
}

export type GuessResult = 'correct' | 'wrong' | 'ignored';

export function newGame(grid: Pick<Grid, 'id'>): GameState {
  return {
    gridId: grid.id,
    cells: Array<number | null>(CELLS).fill(null),
    errors: 0,
    status: 'playing',
  };
}

export function usedPokemon(state: GameState): Set<number> {
  return new Set(state.cells.filter((id): id is number => id !== null));
}

export function foundCount(state: GameState): number {
  return state.cells.filter((id) => id !== null).length;
}

export function isOver(state: GameState): boolean {
  return state.status !== 'playing';
}

export function livesLeft(state: GameState): number {
  return Math.max(0, MAX_ERRORS - state.errors);
}

/** Row and column category ids of a cell. */
export function cellCategories(grid: Grid, cell: number): [string, string] {
  const row = grid.rows[Math.floor(cell / 3)];
  const col = grid.cols[cell % 3];
  if (row === undefined || col === undefined) throw new Error(`No such cell: ${cell}`);
  return [row, col];
}

/**
 * Plays a Pokémon in a cell. Never mutates. A guess that cannot count (game over, cell already
 * filled, Pokémon already placed elsewhere, unknown number) is `ignored` and costs nothing.
 */
export function applyGuess(
  state: GameState,
  grid: Grid,
  memberships: Memberships,
  cell: number,
  pokemonId: number,
): { state: GameState; result: GuessResult } {
  const ignored = { state, result: 'ignored' } as const;
  if (state.status !== 'playing') return ignored;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS || state.cells[cell] !== null) {
    return ignored;
  }
  if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > memberships.count) {
    return ignored;
  }
  if (usedPokemon(state).has(pokemonId)) return ignored;

  const [row, col] = cellCategories(grid, cell);
  if (memberships.isValid(pokemonId, row, col)) {
    const cells = state.cells.map((id, i) => (i === cell ? pokemonId : id));
    const won = cells.every((id) => id !== null);
    return { state: { ...state, cells, status: won ? 'won' : 'playing' }, result: 'correct' };
  }
  const errors = state.errors + 1;
  return {
    state: { ...state, errors, status: errors >= MAX_ERRORS ? 'lost' : 'playing' },
    result: 'wrong',
  };
}

export function abandon(state: GameState): GameState {
  return state.status === 'playing' ? { ...state, status: 'abandoned' } : state;
}

/** Every valid answer for a cell (what "Voir les solutions" shows). */
export function solutionsFor(grid: Grid, memberships: Memberships, cell: number): number[] {
  const [row, col] = cellCategories(grid, cell);
  return memberships.answersFor(row, col);
}
