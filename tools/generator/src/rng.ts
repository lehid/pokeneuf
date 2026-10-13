/** A source of numbers in [0, 1). */
export type Random = () => number;

/** FNV-1a, 32 bits: a stable hash of a string, used to derive a seed from a date. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast, well-distributed seeded generator. Same seed, same sequence. */
export function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index of an item drawn with probability proportional to its weight. Weights must be > 0. */
export function weightedIndex(weights: readonly number[], random: Random): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let target = random() * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i] as number;
    if (target < 0) return i;
  }
  return weights.length - 1; // rounding: the last one
}
