/**
 * Hopcroft–Karp maximum matching in a bipartite graph.
 * `adjacency[i]` lists the right-hand nodes (any integers) that left node `i` can take.
 * Returns, for each left node, the right node it is matched to, or -1.
 */
export function maximumMatching(adjacency: readonly (readonly number[])[]): number[] {
  const left = adjacency.length;
  const matchLeft: number[] = Array.from({ length: left }, () => -1);
  const matchRight = new Map<number, number>();
  const distance: number[] = Array.from({ length: left }, () => 0);

  /** Layers the graph from the free left nodes; true when an augmenting path exists. */
  function layer(): boolean {
    const queue: number[] = [];
    for (let u = 0; u < left; u++) {
      distance[u] = matchLeft[u] === -1 ? 0 : Infinity;
      if (matchLeft[u] === -1) queue.push(u);
    }
    let found = false;
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head] as number;
      for (const v of adjacency[u] ?? []) {
        const w = matchRight.get(v);
        if (w === undefined) found = true;
        else if (distance[w] === Infinity) {
          distance[w] = (distance[u] as number) + 1;
          queue.push(w);
        }
      }
    }
    return found;
  }

  function augment(u: number): boolean {
    for (const v of adjacency[u] ?? []) {
      const w = matchRight.get(v);
      if (w === undefined || (distance[w] === (distance[u] as number) + 1 && augment(w))) {
        matchLeft[u] = v;
        matchRight.set(v, u);
        return true;
      }
    }
    distance[u] = Infinity;
    return false;
  }

  while (layer()) {
    for (let u = 0; u < left; u++) if (matchLeft[u] === -1) augment(u);
  }
  return matchLeft;
}

/**
 * Picks one candidate per slot so that all picks are different, or `null` when impossible
 * (a "system of distinct representatives"). Used to prove a grid can be completed.
 */
export function distinctRepresentatives(
  candidates: readonly (readonly number[])[],
): number[] | null {
  const matching = maximumMatching(candidates);
  return matching.every((v) => v !== -1) ? matching : null;
}
