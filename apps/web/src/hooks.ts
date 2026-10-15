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

/**
 * Score and rarity of the current game. The cells and tiers follow the data, but the TOTAL of a
 * finished game is the one frozen when it ended: a data rebuild never changes a score already
 * shown, shared or written to the history.
 */
export function useScore(): GameScore {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const finalScore = useGame((s) => s.finalScore);
  return useMemo(() => {
    const computed = scoreGame(game, grid, memberships, popularity);
    return finalScore === null ? computed : { ...computed, total: finalScore };
  }, [game, grid, finalScore]);
}

/** The stats and the streak as of the real Paris date, even while an old grid is on screen. */
export function useStats(): Stats {
  const history = useGame((s) => s.history);
  const today = useGame((s) => s.today());
  return useMemo(() => computeStats(history, today), [history, today]);
}

/** How hard today's grid is: size of the cells, obscurity and mass of the answers. */
export function useDifficulty(): GridDifficulty {
  const grid = useGame((s) => s.grid);
  return useMemo(() => gridDifficulty(grid, memberships, popularity), [grid]);
}
