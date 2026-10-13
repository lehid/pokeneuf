import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { MANUAL_DIR, OVERRIDES_PATH } from './config';

const idListFile = z.strictObject({
  description: z.string().min(1),
  ids: z.array(z.number().int().positive()),
});

const aliasesFile = z.strictObject({
  description: z.string().min(1),
  aliases: z.record(z.string().regex(/^\d+$/), z.array(z.string().min(1)).min(1)),
});

const overrideSchema = z.strictObject({
  id: z.number().int().positive(),
  reason: z.string().min(10),
  set: z.record(z.string(), z.unknown()),
});
const overridesFile = z.strictObject({
  description: z.string().min(1),
  overrides: z.array(overrideSchema),
});

export type Override = z.infer<typeof overrideSchema>;

export interface ManualLists {
  starters: number[];
  fossils: number[];
  pseudoLegendaries: number[];
  mega: number[];
  gmax: number[];
  /** Most famous first: the order is the ranking inside the list (see `popularity.ts`). */
  popular: number[];
  /** National Pokédex id → extra search spellings. */
  aliases: Record<number, string[]>;
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Cannot read ${file}`, { cause: error });
  }
}

async function readIds(name: string, dir: string): Promise<number[]> {
  const file = path.join(dir, `${name}.json`);
  const parsed = idListFile.safeParse(await readJson(file));
  if (!parsed.success) throw new Error(`${file}:\n${z.prettifyError(parsed.error)}`);
  return parsed.data.ids;
}

export async function loadManual(dir: string = MANUAL_DIR): Promise<ManualLists> {
  const aliasFile = path.join(dir, 'aliases.json');
  const aliases = aliasesFile.safeParse(await readJson(aliasFile));
  if (!aliases.success) throw new Error(`${aliasFile}:\n${z.prettifyError(aliases.error)}`);

  return {
    starters: await readIds('starters', dir),
    fossils: await readIds('fossils', dir),
    pseudoLegendaries: await readIds('pseudoLegendaries', dir),
    mega: await readIds('mega', dir),
    gmax: await readIds('gmax', dir),
    popular: await readIds('popular', dir),
    aliases: Object.fromEntries(
      Object.entries(aliases.data.aliases).map(([id, names]) => [Number(id), names]),
    ),
  };
}

export async function loadOverrides(file: string = OVERRIDES_PATH): Promise<Override[]> {
  const parsed = overridesFile.safeParse(await readJson(file));
  if (!parsed.success) throw new Error(`${file}:\n${z.prettifyError(parsed.error)}`);
  return parsed.data.overrides;
}
