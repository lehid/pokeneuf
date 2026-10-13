import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRID_SIZE, GRID_VERSION, type Grid, type GridDate } from '@pokeneuf/core';
import { z } from 'zod';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const GRIDS_DIR = path.join(ROOT, 'apps/web/public/grids');
export const MEMBERSHIPS_PATH = path.join(ROOT, 'packages/data/dist/memberships.json');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const categoryId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const gridSchema = z.strictObject({
  version: z.literal(GRID_VERSION),
  id: z.number().int(),
  date,
  rows: z.tuple([categoryId, categoryId, categoryId]),
  cols: z.tuple([categoryId, categoryId, categoryId]),
  cellSizes: z.array(z.number().int().min(0)).length(GRID_SIZE * GRID_SIZE),
  difficulty: z.number().int().min(0).max(100),
});

// Compile-time guard: the file schema and the shared `Grid` type describe the same thing.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type SchemaMatchesGrid = Same<z.infer<typeof gridSchema>, Grid> extends true ? true : never;

export const indexSchema = z.strictObject({
  version: z.literal(GRID_VERSION),
  grids: z.array(z.strictObject({ id: z.number().int(), date })),
});
export type GridIndex = z.infer<typeof indexSchema>;

const GRID_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

export function gridPath(dir: string, gridDate: GridDate): string {
  return path.join(dir, `${gridDate}.json`);
}

/** Every `YYYY-MM-DD.json` of the folder, validated and sorted by date. Missing folder = no grids. */
export async function readGrids(dir: string = GRIDS_DIR): Promise<Grid[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const grids: Grid[] = [];
  for (const name of names.sort()) {
    const match = GRID_FILE.exec(name);
    if (!match?.[1]) continue;
    const file = path.join(dir, name);
    const parsed = gridSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
    if (!parsed.success) throw new Error(`${file}:\n${z.prettifyError(parsed.error)}`);
    if (parsed.data.date !== match[1])
      throw new Error(`${file}: the file name and its date differ`);
    grids.push(parsed.data);
  }
  return grids;
}

async function writeAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

export async function writeGrid(grid: Grid, dir: string = GRIDS_DIR): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeAtomic(gridPath(dir, grid.date), `${JSON.stringify(grid, null, 2)}\n`);
}

export function buildIndex(grids: readonly Grid[]): GridIndex {
  const sorted = [...grids].sort((a, b) => a.date.localeCompare(b.date));
  return { version: GRID_VERSION, grids: sorted.map((g) => ({ id: g.id, date: g.date })) };
}

export async function writeIndex(grids: readonly Grid[], dir: string = GRIDS_DIR): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeAtomic(
    path.join(dir, 'index.json'),
    `${JSON.stringify(buildIndex(grids), null, 2)}\n`,
  );
}

export async function readIndex(dir: string = GRIDS_DIR): Promise<GridIndex | null> {
  try {
    const parsed = indexSchema.safeParse(
      JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')),
    );
    if (!parsed.success) throw new Error(`index.json:\n${z.prettifyError(parsed.error)}`);
    return parsed.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
