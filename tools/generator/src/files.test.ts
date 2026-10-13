import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GRID_VERSION, type Grid } from '@pokeneuf/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndex, gridSchema, readGrids, readIndex, writeGrid, writeIndex } from './files';
import { scratchDir } from './test-dir';

const grid = (id: number, date: string): Grid => ({
  version: GRID_VERSION,
  id,
  date,
  rows: ['gen-1', 'type-fire', 'evo-base'],
  cols: ['color-red', 'stat-total-500', 'size-height-2m'],
  cellSizes: [5, 6, 7, 8, 9, 10, 11, 12, 13],
  difficulty: 60,
});

let dir: string;
let remove: () => Promise<void>;
beforeEach(async () => {
  ({ dir, remove } = await scratchDir());
});
afterEach(() => remove());

describe('grid files', () => {
  it('round-trip, sorted by date whatever the write order', async () => {
    await writeGrid(grid(3, '2026-11-03'), dir);
    await writeGrid(grid(1, '2026-11-01'), dir);
    await writeGrid(grid(2, '2026-11-02'), dir);
    expect((await readGrids(dir)).map((g) => g.id)).toEqual([1, 2, 3]);
    expect((await readGrids(dir))[0]).toEqual(grid(1, '2026-11-01'));
  });

  it('are named after their date and end with a newline', async () => {
    await writeGrid(grid(1, '2026-11-01'), dir);
    expect(await readdir(dir)).toEqual(['2026-11-01.json']);
    expect((await readFile(path.join(dir, '2026-11-01.json'), 'utf8')).endsWith('}\n')).toBe(true);
  });

  it('leave no temporary file behind', async () => {
    await writeGrid(grid(1, '2026-11-01'), dir);
    await writeIndex([grid(1, '2026-11-01')], dir);
    expect((await readdir(dir)).sort()).toEqual(['2026-11-01.json', 'index.json']);
  });

  it('read as nothing when the folder does not exist', async () => {
    expect(await readGrids(path.join(dir, 'nope'))).toEqual([]);
    expect(await readIndex(path.join(dir, 'nope'))).toBeNull();
  });

  it('ignore files that are not grids', async () => {
    await writeGrid(grid(1, '2026-11-01'), dir);
    await writeFile(path.join(dir, 'index.json'), '{}');
    await writeFile(path.join(dir, 'notes.txt'), 'hello');
    await mkdir(path.join(dir, '2026-11-09.json.d'));
    expect((await readGrids(dir)).map((g) => g.date)).toEqual(['2026-11-01']);
  });

  it('refuse a malformed grid, naming the file', async () => {
    await writeFile(
      path.join(dir, '2026-11-01.json'),
      JSON.stringify({ ...grid(1, '2026-11-01'), difficulty: 500 }),
    );
    await expect(readGrids(dir)).rejects.toThrow(/2026-11-01\.json/);
  });

  it('refuse a file whose name and date disagree', async () => {
    await writeFile(path.join(dir, '2026-11-05.json'), JSON.stringify(grid(1, '2026-11-01')));
    await expect(readGrids(dir)).rejects.toThrow(/name and its date differ/);
  });
});

describe('gridSchema', () => {
  it('accepts a good grid and rejects each kind of mistake', () => {
    const good = grid(1, '2026-11-01');
    expect(gridSchema.safeParse(good).success).toBe(true);
    const bad = (patch: object) => gridSchema.safeParse({ ...good, ...patch }).success;
    expect(bad({ version: 2 })).toBe(false);
    expect(bad({ date: '1 Nov' })).toBe(false);
    expect(bad({ rows: ['gen-1', 'type-fire'] })).toBe(false);
    expect(bad({ cols: ['Gen 1', 'a', 'b'] })).toBe(false);
    expect(bad({ cellSizes: [1, 2, 3] })).toBe(false);
    expect(bad({ difficulty: -1 })).toBe(false);
    expect(bad({ extra: true })).toBe(false);
  });
});

describe('index.json', () => {
  it('lists number and date, sorted', () => {
    expect(buildIndex([grid(2, '2026-11-02'), grid(1, '2026-11-01')])).toEqual({
      version: GRID_VERSION,
      grids: [
        { id: 1, date: '2026-11-01' },
        { id: 2, date: '2026-11-02' },
      ],
    });
  });

  it('round-trips and is rejected when malformed', async () => {
    await writeIndex([grid(1, '2026-11-01')], dir);
    expect(await readIndex(dir)).toEqual(buildIndex([grid(1, '2026-11-01')]));
    await writeFile(path.join(dir, 'index.json'), '{"grids": 3}');
    await expect(readIndex(dir)).rejects.toThrow(/index\.json/);
  });
});
