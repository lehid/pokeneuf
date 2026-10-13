import type { Category } from './categories';
import { findSolution, type Grid } from './grid';
import { computeMemberships, Memberships } from './memberships';
import { pokemon } from './test-fixtures';

/** A synthetic world of 2000 Pokémon where category "mN" holds the multiples of N. */
const dex = Array.from({ length: 2000 }, (_, i) => pokemon({ id: i + 1 }));
const category = (n: number, family: Category['family']): Category => ({
  id: `m${n}`,
  family,
  label: { fr: `m${n}`, en: `m${n}` },
  definition: { fr: `m${n}` },
  predicate: (p) => p.id % n === 0,
  exclusiveWith: [],
  bonus: false,
});

export const worldCategories: Category[] = [
  category(5, 'type'),
  category(7, 'generation'),
  category(11, 'evolution'),
  category(13, 'status'),
  category(17, 'color'),
  category(19, 'shape'),
];
export const worldMemberships = new Memberships(
  computeMemberships(dex, worldCategories),
  worldCategories,
);
export const worldGrid: Grid = {
  version: 1,
  id: 1,
  date: '2026-11-01',
  rows: ['m5', 'm7', 'm11'],
  cols: ['m13', 'm17', 'm19'],
  cellSizes: [30, 16, 10, 21, 16, 15, 13, 10, 9],
  difficulty: 0,
};

/** A full valid solution (9 different Pokémon, row-major). */
export const worldSolution: number[] = (() => {
  const solution = findSolution(worldGrid, worldMemberships);
  if (!solution) throw new Error('world grid has no solution');
  return solution;
})();
