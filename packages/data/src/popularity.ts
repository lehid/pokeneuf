import type { Pokemon } from '@pokeneuf/core';

/**
 * Estimated popularity `pop` ∈ (0, 1] (ROADMAP §3.5, v1): how likely a player is to think of a
 * Pokémon first. Not a measurement: a prior, from proxies. In v2 live picks replace it.
 *
 * Every number below is a weight in one sum; the sum is then scaled so the top entry is 1.
 */
export const POPULARITY_WEIGHTS = {
  /** Fame by generation: the older, the better known. */
  generation: { 1: 0.4, 2: 0.28, 3: 0.18, 4: 0.12 } as Readonly<Record<number, number>>,
  starter: 0.12,
  legendary: 0.15,
  mythical: 0.1,
  pseudoLegendary: 0.12,
  fossil: 0.03,
  baby: -0.03,
  /** Final stage of a line, the one people remember. */
  finalStage: 0.08,
  /** No evolution at all (Ditto, Farfetch'd…). */
  noEvolution: 0.02,
  /** Middle stages are the forgettable ones. */
  middleStage: -0.04,
  mega: 0.04,
  gmax: 0.04,
  /** On `popular.json`: a floor above everyone else, plus up to `popularSpread` by list position. */
  popularFloor: 0.5,
  popularSpread: 0.6,
} as const;

/** Weight of a Pokémon before scaling. `popularRank` is its 0-based place on `popular.json`. */
export function rawPopularity(
  p: Omit<Pokemon, 'pop'>,
  popularRank: number | null,
  popularCount: number,
): number {
  const w = POPULARITY_WEIGHTS;
  const evolution = p.evolution;
  let score = w.generation[p.generation] ?? 0;
  if (p.isStarter) score += w.starter;
  if (p.isLegendary) score += w.legendary;
  if (p.isMythical) score += w.mythical;
  if (p.isPseudoLegendary) score += w.pseudoLegendary;
  if (p.isFossil) score += w.fossil;
  if (p.isBaby) score += w.baby;
  if (evolution.stage >= 2 && evolution.isFinal) score += w.finalStage;
  else if (evolution.stage === 1 && evolution.isFinal) score += w.noEvolution;
  else if (evolution.stage >= 2) score += w.middleStage;
  if (p.hasMega) score += w.mega;
  if (p.hasGmax) score += w.gmax;
  if (popularRank !== null) {
    const spread = popularCount > 1 ? 1 - popularRank / (popularCount - 1) : 1;
    score += w.popularFloor + w.popularSpread * spread;
  }
  return score;
}

/**
 * `pop` for every Pokémon, in [0, 1], 4 decimals (the JSON stays stable and small). `popular` is
 * ordered, most famous first. The result keeps the order of `raw`: scaling never reorders.
 */
export function addPopularity(
  entries: readonly Omit<Pokemon, 'pop'>[],
  popular: readonly number[],
): Pokemon[] {
  const rank = new Map(popular.map((id, index) => [id, index]));
  const raws = entries.map((p) => rawPopularity(p, rank.get(p.id) ?? null, popular.length));
  const top = Math.max(...raws);
  return entries.map((p, i) => ({
    ...p,
    pop: Math.round(((raws[i] ?? 0) / top) * 10_000) / 10_000,
  }));
}
