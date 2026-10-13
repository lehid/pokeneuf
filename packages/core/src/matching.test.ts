import { describe, expect, it } from 'vitest';
import { distinctRepresentatives, maximumMatching } from './matching';

const size = (m: number[]) => m.filter((v) => v !== -1).length;

describe('maximumMatching', () => {
  it('matches nothing in an empty graph', () => {
    expect(maximumMatching([])).toEqual([]);
    expect(maximumMatching([[], []])).toEqual([-1, -1]);
  });

  it('gives each left node its own right node', () => {
    expect(maximumMatching([[10], [20], [30]])).toEqual([10, 20, 30]);
  });

  it('augments through a chain: the greedy first choice must be undone', () => {
    // 0 can take A or B, 1 only A: greedy gives A to 0 and strands 1.
    const m = maximumMatching([[1, 2], [1]]);
    expect(m).toEqual([2, 1]);
  });

  it('finds the maximum when it is smaller than the left side', () => {
    // Three left nodes competing for two right nodes.
    const m = maximumMatching([
      [1, 2],
      [1, 2],
      [1, 2],
    ]);
    expect(size(m)).toBe(2);
    expect(new Set(m.filter((v) => v !== -1)).size).toBe(2);
  });

  it('handles a long augmenting path', () => {
    // i can take i or i+1; the last one only the last: a perfect matching needs every shift.
    const n = 200;
    const adjacency = Array.from({ length: n }, (_, i) => (i === n - 1 ? [i] : [i, i + 1]));
    // Reverse preference order to make greedy fail everywhere.
    const m = maximumMatching(adjacency.map((a) => [...a].reverse()));
    expect(size(m)).toBe(n);
    expect(new Set(m).size).toBe(n);
  });

  it('never uses a right node twice and only uses allowed edges', () => {
    let seed = 7;
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let round = 0; round < 200; round++) {
      const left = 1 + Math.floor(random() * 9);
      const adjacency = Array.from({ length: left }, () =>
        Array.from({ length: Math.floor(random() * 6) }, () => 1 + Math.floor(random() * 8)),
      );
      const m = maximumMatching(adjacency);
      const used = m.filter((v) => v !== -1);
      expect(new Set(used).size).toBe(used.length);
      m.forEach((v, u) => {
        if (v !== -1) expect(adjacency[u]).toContain(v);
      });
      // Maximum: compare with brute force.
      expect(size(m)).toBe(bruteForce(adjacency));
    }
  });
});

/** Size of a maximum matching by exhaustive search (tiny graphs only). */
function bruteForce(adjacency: readonly (readonly number[])[]): number {
  const go = (u: number, used: Set<number>): number => {
    if (u === adjacency.length) return 0;
    let best = go(u + 1, used); // leave u unmatched
    for (const v of new Set(adjacency[u])) {
      if (used.has(v)) continue;
      used.add(v);
      best = Math.max(best, 1 + go(u + 1, used));
      used.delete(v);
    }
    return best;
  };
  return go(0, new Set());
}

describe('distinctRepresentatives', () => {
  it('returns one distinct pick per slot when possible', () => {
    const picks = distinctRepresentatives([[1, 2], [1], [2, 3]]);
    expect(picks).toEqual([2, 1, 3]);
  });

  it('returns null when two slots can only share the same Pokémon', () => {
    expect(distinctRepresentatives([[5], [5], [1, 2, 3]])).toBeNull();
  });

  it('returns null when a slot has no candidate', () => {
    expect(distinctRepresentatives([[1], []])).toBeNull();
  });

  it('is trivially fine for no slot', () => {
    expect(distinctRepresentatives([])).toEqual([]);
  });

  it('detects the classic Hall violation: three slots, two Pokémon between them', () => {
    expect(distinctRepresentatives([[1, 2], [1, 2], [1, 2], [3]])).toBeNull();
  });
});
