import { describe, expect, it } from 'vitest';
import {
  abandon,
  applyGuess,
  foundCount,
  livesLeft,
  newGame,
  solutionsFor,
  usedPokemon,
  type GameState,
} from './game';
import { worldGrid as grid, worldMemberships as memberships, worldSolution } from './test-world';

const play = (state: GameState, cell: number, id: number) =>
  applyGuess(state, grid, memberships, cell, id);
const WRONG = 1; // 1 is a multiple of nothing: never valid
const solved = (n: number): GameState => ({
  ...newGame(grid),
  cells: worldSolution.map((id, i) => (i < n ? id : null)),
});

describe('applyGuess', () => {
  it('places a valid Pokémon', () => {
    const answer = worldSolution[0] ?? 0;
    const { state, result } = play(newGame(grid), 0, answer);
    expect(result).toBe('correct');
    expect(state.cells[0]).toBe(answer);
    expect(foundCount(state)).toBe(1);
    expect(state.errors).toBe(0);
  });

  it('counts a wrong guess as an error and leaves the cell empty', () => {
    const { state, result } = play(newGame(grid), 0, WRONG);
    expect(result).toBe('wrong');
    expect(state.errors).toBe(1);
    expect(state.cells[0]).toBeNull();
    expect(livesLeft(state)).toBe(2);
  });

  it('loses on the third error and then ignores everything', () => {
    let state = newGame(grid);
    for (let i = 0; i < 3; i++) state = play(state, 0, WRONG).state;
    expect(state.status).toBe('lost');
    expect(play(state, 0, worldSolution[0] ?? 0).result).toBe('ignored');
  });

  it('wins when the ninth cell is filled', () => {
    const { state, result } = play(solved(8), 8, worldSolution[8] ?? 0);
    expect(result).toBe('correct');
    expect(state.status).toBe('won');
  });

  it('does not mutate the previous state', () => {
    const before = newGame(grid);
    const snapshot = JSON.stringify(before);
    play(before, 0, WRONG);
    play(before, 0, worldSolution[0] ?? 0);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('ignores a filled cell, a reused Pokémon and unknown cells or numbers, at no cost', () => {
    const state = solved(1);
    const used = worldSolution[0] ?? 0;
    for (const attempt of [
      play(state, 0, WRONG), // filled cell
      play(state, 1, used), // already placed elsewhere (even though it would be valid)
      play(newGame(grid), 0, 99999), // unknown number
      play(newGame(grid), 9, 1), // unknown cell
      play(newGame(grid), 0, 1.5),
    ]) {
      expect(attempt.result).toBe('ignored');
    }
    expect(play(state, 0, WRONG).state).toBe(state);
  });

  it('knows which Pokémon are used', () => {
    expect(usedPokemon(solved(3))).toEqual(new Set(worldSolution.slice(0, 3)));
  });
});

describe('abandon', () => {
  it('abandons only a game in progress', () => {
    expect(abandon(newGame(grid)).status).toBe('abandoned');
    expect(abandon({ ...solved(9), status: 'won' }).status).toBe('won');
  });
});

describe('solutionsFor', () => {
  it('lists every valid answer of a cell', () => {
    const answers = solutionsFor(grid, memberships, 0);
    expect(answers).toHaveLength(grid.cellSizes[0] ?? -1);
    expect(answers.every((id) => id % 5 === 0 && id % 13 === 0)).toBe(true);
  });
});
