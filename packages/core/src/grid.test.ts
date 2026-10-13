import { describe, expect, it } from 'vitest';
import type { Category, CategoryFamily } from './categories';
import {
  cellIndex,
  checkGrid,
  difficultyOf,
  familyLimit,
  findSolution,
  GRID_RULES,
  GRID_VERSION,
  hasFamilyDiversity,
  parseGrid,
  type Grid,
} from './grid';
import { computeMemberships, Memberships } from './memberships';
import { pokemon } from './test-fixtures';

// A synthetic world of 2000 Pokémon where category "mN" holds the multiples of N.
// Rows (5, 7, 11) × columns (13, 17, 19) give cells of 9 to 30 answers: all valid.
const N = 2000;
const dex = Array.from({ length: N }, (_, i) => pokemon({ id: i + 1 }));

function category(
  id: string,
  family: CategoryFamily,
  predicate: (id: number) => boolean,
  exclusiveWith: CategoryFamily[] = [],
): Category {
  return {
    id,
    family,
    label: { fr: id, en: id },
    definition: { fr: id },
    predicate: (p) => predicate(p.id),
    exclusiveWith,
    bonus: false,
  };
}
const multiples = (n: number) => (id: number) => id % n === 0;

const registry: Category[] = [
  category('r5', 'type', multiples(5)),
  category('r7', 'generation', multiples(7)),
  category('r11', 'evolution', multiples(11)),
  category('c13', 'status', multiples(13)),
  category('c17', 'color', multiples(17)),
  category('c19', 'shape', multiples(19)),
  // for the broken cases
  category('tiny', 'form', (id) => id <= 2), // 2 answers per cell at most
  category('huge2', 'stats', multiples(2)),
  category('huge3', 'size', multiples(3)),
  category('r5b', 'type', multiples(5)),
  category('r7b', 'type', multiples(7)),
  category('no-type', 'name', multiples(23), ['type']),
  category('name-a', 'name', multiples(29)),
  category('only-a', 'type', (id) => id <= 3),
  category('only-b', 'generation', (id) => id <= 3),
  category('only-c', 'evolution', (id) => id <= 3),
  category('only-d', 'status', (id) => id <= 3),
  category('only-e', 'color', (id) => id <= 3),
  category('only-f', 'shape', (id) => id <= 3),
];
const memberships = new Memberships(computeMemberships(dex, registry), registry);
const options = { categories: registry, launchDate: null } as const;

function grid(overrides: Partial<Grid> = {}): Grid {
  const rows: [string, string, string] = ['r5', 'r7', 'r11'];
  const cols: [string, string, string] = ['c13', 'c17', 'c19'];
  const cellSizes = rows.flatMap((r) => cols.map((c) => memberships.answersFor(r, c).length));
  return {
    version: GRID_VERSION,
    id: 1,
    date: '2026-11-01',
    rows,
    cols,
    cellSizes,
    difficulty: difficultyOf(cellSizes),
    ...overrides,
  };
}

/** A grid with these categories, its sizes and difficulty computed honestly. */
function honest(rows: [string, string, string], cols: [string, string, string]): Grid {
  const cellSizes = rows.flatMap((r) => cols.map((c) => memberships.answersFor(r, c).length));
  return grid({ rows, cols, cellSizes, difficulty: difficultyOf(cellSizes) });
}

describe('difficultyOf', () => {
  it('is 100 when every cell is as tight as allowed, 0 when as loose', () => {
    expect(difficultyOf(Array(9).fill(GRID_RULES.minAnswers))).toBe(100);
    expect(difficultyOf(Array(9).fill(GRID_RULES.maxAnswers))).toBe(0);
  });

  it('falls as cells get bigger', () => {
    const at = (size: number) => difficultyOf(Array(9).fill(size));
    const scores = [3, 5, 10, 20, 40, 80].map(at);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(scores).size).toBe(scores.length);
  });

  it('weighs small cells more than big ones (log scale)', () => {
    expect(difficultyOf(Array(9).fill(3)) - difficultyOf(Array(9).fill(6))).toBeGreaterThan(
      difficultyOf(Array(9).fill(60)) - difficultyOf(Array(9).fill(63)),
    );
  });

  it('is the mean of the cells', () => {
    const easy = difficultyOf(Array(9).fill(80));
    const hard = difficultyOf(Array(9).fill(3));
    expect(difficultyOf([...Array(4).fill(3), ...Array(5).fill(80)])).toBe(
      Math.round(((4 * hard) / 100 + (5 * easy) / 100) * (100 / 9)),
    );
  });

  it('clamps sizes outside the allowed range', () => {
    expect(difficultyOf(Array(9).fill(1))).toBe(100);
    expect(difficultyOf(Array(9).fill(500))).toBe(0);
  });
});

describe('hasFamilyDiversity', () => {
  const get = (...ids: string[]) => ids.map((id) => registry.find((c) => c.id === id) as Category);

  it('accepts six categories from six families', () => {
    expect(hasFamilyDiversity(get('r5', 'r7', 'r11'), get('c13', 'c17', 'c19'))).toBe(true);
  });

  it('refuses three categories of one family', () => {
    expect(hasFamilyDiversity(get('r5', 'r5b', 'r7b'), get('c13', 'c17', 'c19'))).toBe(false);
  });

  it('allows two of a family, as long as there are four families in all', () => {
    expect(hasFamilyDiversity(get('r5', 'r5b', 'r11'), get('c13', 'c17', 'r7'))).toBe(true);
    expect(hasFamilyDiversity(get('r5', 'r5b', 'r7'), get('r7b', 'c13', 'r7'))).toBe(false);
  });

  it('allows at most one name category per grid (spelling questions stay a seasoning)', () => {
    expect(hasFamilyDiversity(get('r5', 'r7', 'name-a'), get('c13', 'c17', 'c19'))).toBe(true);
    expect(hasFamilyDiversity(get('r5', 'r7', 'name-a'), get('c13', 'c17', 'no-type'))).toBe(false);
    expect(familyLimit('name')).toBe(1);
    expect(familyLimit('type')).toBe(2);
  });

  it('wants every line to mix at least two families', () => {
    expect(hasFamilyDiversity(get('r5', 'r5b', 'r5b'), get('c13', 'c17', 'c19'))).toBe(false);
    expect(hasFamilyDiversity(get('r5', 'r7', 'r11'), get('c13', 'c13', 'c13'))).toBe(false);
  });
});

describe('checkGrid', () => {
  it('accepts a good grid', () => {
    expect(checkGrid(grid(), memberships, options)).toEqual([]);
  });

  it('computes cell sizes row-major', () => {
    const g = grid();
    // r5 × c13 = multiples of 65 up to 2000 = 30
    expect(g.cellSizes[cellIndex(0, 0)]).toBe(30);
    // r11 × c19 = multiples of 209 up to 2000 = 9
    expect(g.cellSizes[cellIndex(2, 2)]).toBe(9);
  });

  it.each([
    ['an unknown category', grid({ rows: ['r5', 'r7', 'nope'] }), /unknown category "nope"/],
    ['a category used twice', grid({ cols: ['c13', 'c13', 'c19'] }), /appears twice/],
    ['a wrong version', grid({ version: 99 }), /version 99/],
    [
      'the wrong number of rows',
      grid({ rows: ['r5', 'r7'] as unknown as Grid['rows'] }),
      /needs 3 rows/,
    ],
    ['the wrong number of cell sizes', grid({ cellSizes: [1, 2, 3] }), /needs 9 cell sizes/],
    [
      'a wrong cell size',
      grid({ cellSizes: [31, ...grid().cellSizes.slice(1)] }),
      /has 30 answers, not 31/,
    ],
    ['a wrong difficulty', grid({ difficulty: 1 }), /difficulty should be/],
  ])('rejects %s', (_name, bad, message) => {
    expect(checkGrid(bad, memberships, options).join('\n')).toMatch(message);
  });

  it('rejects a cell with fewer than 3 answers', () => {
    const bad = honest(['r5', 'r7', 'tiny'], ['c13', 'c17', 'c19']);
    expect(checkGrid(bad, memberships, options).join('\n')).toMatch(/tiny × c13 has 0 answers/);
  });

  it('rejects a cell with more than 80 answers', () => {
    const bad = honest(['huge2', 'r7', 'r11'], ['huge3', 'c17', 'c19']);
    expect(checkGrid(bad, memberships, options).join('\n')).toMatch(
      /huge2 × huge3 has 333 answers/,
    );
  });

  it('rejects two categories that must never cross', () => {
    const bad = honest(['r5', 'r7', 'r11'], ['no-type', 'c17', 'c19']);
    expect(checkGrid(bad, memberships, options).join('\n')).toMatch(
      /r5 × no-type must never cross/,
    );
  });

  it('rejects a grid without enough variety of families', () => {
    const bad = honest(['r5', 'r5b', 'r7b'], ['c13', 'c17', 'c19']);
    expect(checkGrid(bad, memberships, options).join('\n')).toMatch(/variety of families/);
  });

  it('rejects a grid where no 9 different Pokémon fit (Hall violation)', () => {
    // Every cell has the same three answers: 9 cells, 3 Pokémon.
    const bad = honest(['only-a', 'only-b', 'only-c'], ['only-d', 'only-e', 'only-f']);
    expect(bad.cellSizes).toEqual(Array(9).fill(3));
    const problems = checkGrid(bad, memberships, options);
    expect(problems).toEqual([expect.stringMatching(/no set of 9 different Pokémon/)]);
  });

  it('checks the grid number against the launch date', () => {
    const launched = { categories: registry, launchDate: '2026-11-01' } as const;
    expect(checkGrid(grid({ id: 1, date: '2026-11-01' }), memberships, launched)).toEqual([]);
    expect(checkGrid(grid({ id: 3, date: '2026-11-03' }), memberships, launched)).toEqual([]);
    expect(checkGrid(grid({ id: 2, date: '2026-11-01' }), memberships, launched).join()).toMatch(
      /id should be 1/,
    );
  });

  it('reports every problem, not just the first', () => {
    const bad = grid({ difficulty: 1, version: 7 });
    expect(checkGrid(bad, memberships, options)).toHaveLength(2);
  });
});

describe('findSolution', () => {
  it('fills every cell with a Pokémon that fits it, all different', () => {
    const g = grid();
    const solution = findSolution(g, memberships);
    expect(solution).toHaveLength(9);
    expect(new Set(solution).size).toBe(9);
    solution?.forEach((id, i) => {
      const row = g.rows[Math.floor(i / 3)] as string;
      const col = g.cols[i % 3] as string;
      expect(memberships.isValid(id, row, col)).toBe(true);
    });
  });

  it('is null when the grid cannot be filled', () => {
    const bad = honest(['only-a', 'only-b', 'only-c'], ['only-d', 'only-e', 'only-f']);
    expect(findSolution(bad, memberships)).toBeNull();
  });
});

describe('parseGrid', () => {
  const good = grid();

  it('reads a grid file', () => {
    expect(parseGrid(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('refuses anything that is not a grid of this version', () => {
    for (const bad of [
      null,
      'grid',
      {},
      { ...good, version: GRID_VERSION + 1 },
      { ...good, rows: ['r5', 'r7'] },
      { ...good, cellSizes: [1, 2, 3] },
      { ...good, date: '5 novembre' },
      { ...good, difficulty: 120 },
      { ...good, extra: true },
    ]) {
      expect(parseGrid(bad)).toBeNull();
    }
  });
});
