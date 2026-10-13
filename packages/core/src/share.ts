import type { GameState } from './game';
import type { RarityTier } from './scoring';

/** What a cell looks like in the shared text. */
export type ShareCell = RarityTier | 'missed' | 'empty';

const SQUARES: Record<ShareCell, string> = {
  common: '🟩',
  uncommon: '🟨',
  rare: '🟧',
  veryRare: '🟪',
  /** Not found: the game was lost. */
  missed: '❌',
  /** Nothing there: the game was abandoned (or is not over). */
  empty: '⬛',
};

/** Share squares of a finished game: a rarity colour per found cell, ❌ when a lost game missed it. */
export function shareCells(state: GameState, tiers: readonly (RarityTier | null)[]): ShareCell[] {
  return state.cells.map((id, cell) => {
    const tier = tiers[cell] ?? null;
    if (id !== null && tier !== null) return tier;
    return state.status === 'lost' ? 'missed' : 'empty';
  });
}

export interface ShareInput {
  appName: string;
  gridId: number;
  score: number;
  maxScore: number;
  /** Consecutive days played; shown only from 1. */
  streak: number;
  cells: readonly ShareCell[];
  /** Where to play, shown on the last line (the page the player is on). */
  url: string;
}

/**
 * The text a player shares (ROADMAP §3.8). Spoiler-free by construction: it is built from tiers and
 * numbers only, the input does not even contain a Pokémon name.
 *
 *   PokéNeuf #42 — 684/900 🔥 12
 *   🟩🟨🟩
 *   🟪🟩❌
 *   🟩🟩🟨
 *   https://…
 */
export function shareText(input: ShareInput): string {
  const rows = [0, 1, 2].map((row) =>
    input.cells
      .slice(row * 3, row * 3 + 3)
      .map((cell) => SQUARES[cell])
      .join(''),
  );
  const streak = input.streak >= 1 ? ` 🔥 ${input.streak}` : '';
  const title = `${input.appName} #${input.gridId} — ${input.score}/${input.maxScore}${streak}`;
  return [title, ...rows, input.url].join('\n');
}
