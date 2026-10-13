import { readFile } from 'node:fs/promises';
import type { Pokedex } from '@pokeneuf/core';
import { POKEDEX_PATH } from './config';
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
