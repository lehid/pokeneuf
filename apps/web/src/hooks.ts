import {
  computeStats,
  gridDifficulty,
  scoreGame,
  type GameScore,
  type GridDifficulty,
  type Stats,
} from '@pokeneuf/core';
import { useMemo } from 'react';
import { memberships, popularity } from './data';
import { useGame } from './GameContext';

/** Score and rarity of the current game, recomputed when it changes. */
export function useScore(): GameScore {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  return useMemo(() => scoreGame(game, grid, memberships, popularity), [game, grid]);
}

export function useStats(): Stats {
  const grid = useGame((s) => s.grid);
  const history = useGame((s) => s.history);
  return useMemo(() => computeStats(history, grid.date), [history, grid.date]);
}

/** How hard today's grid is: size of the cells, obscurity and mass of the answers. */
export function useDifficulty(): GridDifficulty {
  const grid = useGame((s) => s.grid);
  return useMemo(() => gridDifficulty(grid, memberships, popularity), [grid]);
}
