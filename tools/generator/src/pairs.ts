import type { Category, Memberships } from '@pokeneuf/core';

/** Number of answers for every pair of categories, computed once: the generator reads it a lot. */
export class PairTable {
  private readonly index = new Map<string, number>();
  private readonly sizes: Uint16Array;

  constructor(memberships: Memberships, categories: readonly Category[]) {
    const n = categories.length;
    categories.forEach((c, i) => this.index.set(c.id, i));
    this.sizes = new Uint16Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const size = memberships.answersFor(
          categories[i] as Category,
          categories[j] as Category,
        ).length;
        this.sizes[i * n + j] = size;
        this.sizes[j * n + i] = size;
      }
    }
  }

  size(a: string, b: string): number {
    const i = this.index.get(a);
    const j = this.index.get(b);
    if (i === undefined || j === undefined)
      throw new Error(`Unknown category: ${i === undefined ? a : b}`);
    return this.sizes[i * this.index.size + j] as number;
  }
}
