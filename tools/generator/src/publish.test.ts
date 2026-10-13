import { readdir } from 'node:fs/promises';
import { GRID_VERSION, type Grid } from '@pokeneuf/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GRIDS_DIR, readGrids, readIndex, writeGrid, writeIndex } from './files';
import { frozenDates, publishGrids } from './publish';
import { scratchDir } from './test-dir';

const grid = (n: number): Grid => ({
  version: GRID_VERSION,
  id: n,
  date: `2026-11-${String(n).padStart(2, '0')}`,
  rows: ['gen-1', 'type-fire', 'evo-base'],
  cols: ['color-red', 'stat-total-500', 'size-height-2m'],
  cellSizes: Array(9).fill(5),
  difficulty: 50,
});

let dir: string;
let remove: () => Promise<void>;
beforeEach(async () => {
  ({ dir, remove } = await scratchDir());
  const grids = [1, 2, 3, 4, 5].map(grid);
  for (const g of grids) await writeGrid(g, dir);
  await writeIndex(grids, dir);
});
afterEach(() => remove());

describe('publishGrids', () => {
  it('keeps the grids up to today, today included', async () => {
    const result = await publishGrids(dir, '2026-11-03');
    expect(result.kept).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(result.removed).toEqual(['2026-11-04', '2026-11-05']);
    expect((await readGrids(dir)).map((g) => g.date)).toEqual(result.kept);
  });

  it('rewrites the index so that it lists what is there, and nothing else', async () => {
    await publishGrids(dir, '2026-11-02');
    const index = await readIndex(dir);
    expect(index?.grids).toEqual([
      { id: 1, date: '2026-11-01' },
      { id: 2, date: '2026-11-02' },
    ]);
    expect((await readdir(dir)).sort()).toEqual([
      '2026-11-01.json',
      '2026-11-02.json',
      'index.json',
    ]);
  });

  it('leaves tomorrow out, even by one day, and keeps all of them once they are past', async () => {
    expect((await publishGrids(dir, '2026-11-01')).kept).toEqual(['2026-11-01']);
    const [all] = await Promise.all([publishGrids(dir, '2027-01-01')]);
    expect(all.removed).toEqual([]);
  });

  it('can be empty: before the launch nothing is public', async () => {
    const result = await publishGrids(dir, '2026-10-13');
    expect(result.kept).toEqual([]);
    expect(result.removed).toHaveLength(5);
    expect((await readIndex(dir))?.grids).toEqual([]);
  });

  it('fails on a folder that does not exist, instead of publishing nothing quietly', async () => {
    await expect(publishGrids(`${dir}/nope`, '2026-11-03')).rejects.toThrow(/does not exist/);
    expect((await readdir(dir)).length).toBeGreaterThan(0); // and creates nothing
    await expect(readdir(`${dir}/nope`)).rejects.toThrow();
  });

  it('refuses the source folder of the repository', async () => {
    await expect(publishGrids(GRIDS_DIR, '2026-11-03')).rejects.toThrow(/Refusing to prune/);
  });
});

describe('frozenDates', () => {
  it('are the days that began: today and before', () => {
    const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
    expect(frozenDates(dates, '2026-11-02')).toEqual(['2026-11-01', '2026-11-02']);
    expect(frozenDates(dates, '2026-10-31')).toEqual([]);
    expect(frozenDates(dates, '2026-11-03')).toEqual(dates);
  });
});
