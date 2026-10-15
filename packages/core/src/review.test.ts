import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { cellAnswers } from './grid';
import {
  flaggedCellCount,
  hasFlag,
  parsePreviewRoute,
  parseReviewed,
  previewHash,
  REVIEW,
  reviewCell,
  reviewGrid,
  reviewMarkdown,
  serializeReviewed,
  summarizeReviews,
  surpriseOf,
  type CellInput,
  type ReviewMarkdownLabels,
} from './review';
import { parseRoute } from './routes';
import { worldCategories, worldGrid, worldMemberships } from './test-world';

/** Popularity = how small the number is: #1 is the best known. */
const byNumber = (id: number) => 1 - id / 1000;

const cell = (answers: number[], rowSize = 100, colSize = 100): CellInput => ({
  answers,
  rowSize,
  colSize,
});

describe('reviewCell', () => {
  it('sorts the answers from best known to rarest, with their rarity tier', () => {
    const review = reviewCell(0, cell([40, 10, 30, 20, 50, 60, 70, 80]), byNumber);
    expect(review.answers.map((a) => a.id)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(review.answers.map((a) => a.tier)).toEqual([
      'common',
      'common',
      'uncommon',
      'uncommon',
      'rare',
      'rare',
      'veryRare',
      'veryRare',
    ]);
    expect(review.answers[0]?.rank).toBe(0);
    expect(review.answers.at(-1)?.rank).toBe(1);
    expect(review.size).toBe(8);
  });

  it(`flags a cell with ${REVIEW.fewAnswers} answers or fewer, and only those`, () => {
    const few = Array.from({ length: REVIEW.fewAnswers }, (_, i) => 100 + i);
    expect(reviewCell(0, cell(few), byNumber).flags).toContain('few');
    expect(reviewCell(0, cell([...few, 200]), byNumber).flags).not.toContain('few');
  });

  it('flags a cell where every answer has the same rarity tier', () => {
    // Nobody is better known than anybody else: everyone shares the middle rank.
    const flat = reviewCell(0, cell([1, 2, 3, 4, 5, 6]), () => 0.3);
    expect(flat.flags).toContain('uniformRarity');
    expect(new Set(flat.answers.map((a) => a.tier))).toEqual(new Set(['rare']));
    expect(reviewCell(0, cell([1, 2, 3, 4, 5, 6]), byNumber).flags).not.toContain('uniformRarity');
  });

  it('does not call a lone answer uniform', () => {
    expect(reviewCell(0, cell([7]), byNumber).flags).not.toContain('uniformRarity');
  });

  it('flags a small cell that a mascot hands over', () => {
    const mascot = (id: number) => (id === 25 ? 1 : 0.2);
    const small = Array.from({ length: REVIEW.obviousMaxAnswers }, (_, i) => 25 + i);
    expect(reviewCell(0, cell(small), mascot).flags).toContain('obvious');
    expect(reviewCell(0, cell([...small, 99]), mascot).flags).not.toContain('obvious');
    expect(reviewCell(0, cell([1, 2, 3, 4, 5, 6]), mascot).flags).not.toContain('obvious');
  });

  it('flags a cell where one category nearly implies the other', () => {
    const answers = Array.from({ length: 20 }, (_, i) => i + 1);
    // 20 of the 22 members of the smaller category (91 %).
    expect(reviewCell(0, cell(answers, 500, 22), byNumber).flags).toContain('redundant');
    // 20 of 100.
    expect(reviewCell(0, cell(answers, 500, 100), byNumber).flags).not.toContain('redundant');
    // Exactly at the limit counts.
    const limit = Math.round(answers.length / REVIEW.redundantShare);
    expect(reviewCell(0, cell(answers, 500, limit), byNumber).flags).toContain('redundant');
  });

  it('can raise several flags at once', () => {
    const review = reviewCell(0, cell([1, 2, 3], 3, 400), () => 0.5);
    expect(review.flags).toEqual(['few', 'uniformRarity', 'redundant']);
  });

  it('copes with an empty cell', () => {
    const review = reviewCell(4, cell([], 0, 0), byNumber);
    expect(review).toMatchObject({ index: 4, size: 0, answers: [], flags: ['few'] });
  });
});

describe('surpriseOf', () => {
  const byId = (id: string) => {
    const found = CATEGORIES.find((c) => c.id === id);
    if (!found) throw new Error(id);
    return found;
  };

  it('warns about spelling, Pokédex colour and shape, evolution scope and curated lists', () => {
    expect(surpriseOf(byId('name-has-k'))).toBe('language');
    expect(surpriseOf(byId('color-blue'))).toBe('pokedexColor');
    expect(surpriseOf(byId('shape-upright'))).toBe('pokedexShape');
    expect(surpriseOf(byId('evo-final'))).toBe('evolutionScope');
    expect(surpriseOf(byId('status-fossil'))).toBe('curatedList');
    expect(surpriseOf(byId('form-mega'))).toBe('curatedList');
  });

  it('leaves types and generations alone', () => {
    expect(surpriseOf(byId('type-fire'))).toBeNull();
    expect(surpriseOf(byId('gen-3'))).toBeNull();
  });

  it('flags a tiny category of a plain family', () => {
    const tiny = CATEGORIES.filter(
      (c) =>
        c.bonus && !['name', 'color', 'shape', 'evolution', 'status', 'form'].includes(c.family),
    );
    for (const category of tiny) expect(surpriseOf(category)).toBe('tiny');
  });
});

describe('reviewGrid', () => {
  const options = { categories: worldCategories, launchDate: null } as const;
  const review = reviewGrid(worldGrid, worldMemberships, byNumber, options);

  it('describes the nine cells, row-major, and the six lines', () => {
    expect(review.cells.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(review.cells.map((c) => c.size)).toEqual(
      cellAnswers(worldGrid, worldMemberships).map((answers) => answers.length),
    );
    expect(review.lines.map((l) => `${l.axis}${l.position}:${l.categoryId}`)).toEqual([
      'row0:m5',
      'row1:m7',
      'row2:m11',
      'col0:m13',
      'col1:m17',
      'col2:m19',
    ]);
    expect(review.lines[0]).toMatchObject({ members: 400, family: 'type', surprise: null });
    expect(review.date).toBe(worldGrid.date);
    expect(review.id).toBe(worldGrid.id);
  });

  it('counts the families, and the spelling categories among them', () => {
    expect(review.familyMix).toMatchObject({ type: 1, generation: 1, evolution: 1, color: 1 });
    expect(review.nameCount).toBe(0);
    expect(review.surpriseCount).toBeGreaterThan(0);
  });

  it('keeps the problems `checkGrid` reports (here the stored difficulty is wrong)', () => {
    expect(review.problems.join('\n')).toContain('difficulty should be');
    expect(hasFlag(review, 'problem')).toBe(true);
  });

  it('counts flagged cells once, whatever the number of flags', () => {
    const flagged = review.cells.filter((c) => c.flags.length > 0).length;
    expect(flaggedCellCount(review)).toBe(flagged);
    const perKind = review.cells.flatMap((c) => c.flags).length;
    expect(Object.values(review.flagCounts).reduce((a, b) => a + b, 0)).toBe(perKind);
  });

  it('rejects an unknown category', () => {
    expect(() =>
      reviewGrid({ ...worldGrid, rows: ['m5', 'm7', 'nope'] }, worldMemberships, byNumber, options),
    ).toThrow(/Unknown category: nope/);
  });
});

describe('hasFlag and summarizeReviews', () => {
  const options = { categories: worldCategories, launchDate: null } as const;
  const base = reviewGrid(worldGrid, worldMemberships, byNumber, options);
  const clean = {
    ...base,
    problems: [],
    flagCounts: { few: 0, uniformRarity: 0, obvious: 0, redundant: 0 },
    surpriseCount: 0,
  };
  const withFew = { ...clean, flagCounts: { ...clean.flagCounts, few: REVIEW.manyFewCells - 1 } };
  const withManyFew = { ...clean, flagCounts: { ...clean.flagCounts, few: REVIEW.manyFewCells } };
  const withObvious = { ...clean, flagCounts: { ...clean.flagCounts, obvious: 1 } };
  const withProblem = { ...clean, problems: ['grid 1: broken'] };
  const withName = {
    ...clean,
    surpriseCount: 1,
    nameCount: 1,
    familyMix: { name: 1, type: 5 },
    lines: clean.lines.map((l, i) => (i === 0 ? { ...l, family: 'name' as const } : l)),
  };

  it('tells whether a grid carries a kind of flag', () => {
    expect(hasFlag(withFew, 'few')).toBe(true);
    expect(hasFlag(withFew, 'obvious')).toBe(false);
    expect(hasFlag(withName, 'surprise')).toBe(true);
    expect(hasFlag(withProblem, 'problem')).toBe(true);
    expect(hasFlag(clean, 'few')).toBe(false);
  });

  it('asks for a close look only for what is not nearly everywhere', () => {
    expect(hasFlag(clean)).toBe(false);
    // A few small cells, or a spelling category, are the normal state of a grid…
    expect(hasFlag(withFew)).toBe(false);
    expect(hasFlag(withName)).toBe(false);
    // …a pile of small cells, a trivial or uniform cell, or a broken rule are not.
    expect(hasFlag(withManyFew)).toBe(true);
    expect(hasFlag(withObvious)).toBe(true);
    expect(hasFlag(withProblem)).toBe(true);
    expect(hasFlag({ ...clean, flagCounts: { ...clean.flagCounts, redundant: 1 } })).toBe(true);
    expect(hasFlag({ ...clean, flagCounts: { ...clean.flagCounts, uniformRarity: 1 } })).toBe(true);
  });

  it('sums up flags, families and the share of spelling categories', () => {
    const summary = summarizeReviews([clean, withFew, withManyFew, withName]);
    expect(summary.grids).toBe(4);
    expect(summary.flaggedGrids).toBe(1);
    expect(summary.gridsByFlag.few).toBe(2);
    expect(summary.gridsByFlag.surprise).toBe(1);
    expect(summary.cellsByFlag.few).toBe(REVIEW.manyFewCells * 2 - 1);
    expect(summary.lines).toBe(24);
    expect(summary.familyMix.name).toBe(1);
    expect(summary.nameShare).toBeCloseTo(1 / 24);
    expect(summary.gridsWithName).toBe(1);
    expect(summary.surprisingLines).toBe(1);
    expect(summary.cells).toBe(36);
    expect(summary.meanCellSize).toBeCloseTo(
      base.cells.reduce((total, c) => total + c.size, 0) / 9,
    );
  });

  it('handles no grid at all', () => {
    const summary = summarizeReviews([]);
    expect(summary).toMatchObject({ grids: 0, flaggedGrids: 0, nameShare: 0, meanCellSize: 0 });
  });
});

describe('reviewed marks', () => {
  it('round-trips, sorted and without duplicates', () => {
    const raw = serializeReviewed(['2026-11-03', '2026-11-01', '2026-11-03']);
    expect(JSON.parse(raw)).toEqual({ version: 1, dates: ['2026-11-01', '2026-11-03'] });
    expect([...parseReviewed(raw)]).toEqual(['2026-11-01', '2026-11-03']);
  });

  it('starts empty when nothing was saved or the save cannot be trusted', () => {
    expect(parseReviewed(null).size).toBe(0);
    expect(parseReviewed('not json').size).toBe(0);
    expect(parseReviewed('{"version":2,"dates":["2026-11-01"]}').size).toBe(0);
    expect(parseReviewed('{"version":1,"dates":["demain"]}').size).toBe(0);
    expect(parseReviewed('[]').size).toBe(0);
  });
});

describe('reviewMarkdown', () => {
  const labels: ReviewMarkdownLabels = {
    title: 'Review',
    reviewed: (n, total) => `Read (${n}/${total})`,
    pending: (n, total) => `To read (${n}/${total})`,
    entry: (e) => `${e.date} (#${e.id})`,
  };
  const entries = [
    { date: '2026-11-03', id: 3 },
    { date: '2026-11-01', id: 1 },
    { date: '2026-11-02', id: 2 },
  ];

  it('lists the read grids ticked and the others unticked, by date', () => {
    const md = reviewMarkdown(entries, new Set(['2026-11-02']), labels);
    expect(md).toBe(
      [
        '# Review',
        '',
        '## Read (1/3)',
        '',
        '- [x] 2026-11-02 (#2)',
        '',
        '## To read (2/3)',
        '',
        '- [ ] 2026-11-01 (#1)',
        '- [ ] 2026-11-03 (#3)',
        '',
      ].join('\n'),
    );
  });

  it('marks an empty list and ignores reviewed dates that are not in the list', () => {
    const md = reviewMarkdown(entries, new Set(['2030-01-01']), labels);
    expect(md).toContain('## Read (0/3)\n\n_—_');
    expect(md).not.toContain('2030');
  });
});

describe('the preview route', () => {
  it('is recognised with or without a date', () => {
    expect(parsePreviewRoute('#/preview')).toEqual({ date: null });
    expect(parsePreviewRoute('#/preview/2026-11-05')).toEqual({ date: '2026-11-05' });
  });

  it('rejects anything else', () => {
    for (const hash of [
      '',
      '#/',
      '#/previews',
      '#/preview/',
      '#/preview/demain',
      '#/preview/2026-11-05/x',
      '#/faq',
    ]) {
      expect(parsePreviewRoute(hash), hash).toBeNull();
    }
  });

  it('builds its hash', () => {
    expect(previewHash()).toBe('#/preview');
    expect(previewHash('2026-11-05')).toBe('#/preview/2026-11-05');
  });

  it('is an unknown route for the app router, which keeps showing the page of the day', () => {
    expect(parseRoute('#/preview')).toEqual({ kind: 'today' });
    expect(parseRoute('#/preview/2026-11-05')).toEqual({ kind: 'today' });
  });
});
