import { readFile } from 'node:fs/promises';
import { Memberships, type MembershipsFile, type Pokedex } from '@pokeneuf/core';
import { MEMBERSHIPS_PATH, POKEDEX_PATH } from './config';
import { runPipeline } from './pipeline';
import { parsePokedex } from './schema';

/**
 * The real artifact, as shipped: runs the pipeline (network only if `.cache/` is empty), then
 * reads `dist/pokedex.json` back from disk and validates it, so tests exercise the file itself.
 */
export async function loadArtifact(): Promise<Pokedex> {
  await runPipeline();
  return parsePokedex(JSON.parse(await readFile(POKEDEX_PATH, 'utf8')));
}

/** The shipped `dist/memberships.json`, loaded the way the game loads it. */
export async function loadShippedMemberships(): Promise<{
  file: MembershipsFile;
  engine: Memberships;
}> {
  await runPipeline();
  const file = JSON.parse(await readFile(MEMBERSHIPS_PATH, 'utf8')) as MembershipsFile;
  return { file, engine: new Memberships(file) };
}
