import { mkdir, rename, writeFile } from 'node:fs/promises';
import {
  CATEGORIES,
  computeMemberships,
  MAX_GEN,
  Memberships,
  type MembershipsFile,
  type Pokedex,
} from '@pokeneuf/core';
import { DIST_DIR, MEMBERSHIPS_PATH, PINNED_SHA, POKEDEX_PATH } from './config';
import { buildPokedex } from './build';
import { loadRawTables, type DownloadOptions } from './download';
import { crossCheckForms } from './forms';
import { loadManual, loadOverrides } from './manual';
import { formatReport } from './report';

export interface PipelineResult {
  pokedex: Pokedex;
  /** Exactly what is written to `dist/pokedex.json`. */
  json: string;
  memberships: MembershipsFile;
  /** Exactly what is written to `dist/memberships.json`. */
  membershipsJson: string;
  report: string;
  /** Manual lists that disagree with the source. Not fatal, but never silent. */
  warnings: string[];
}

export interface PipelineOptions {
  /** Write `dist/pokedex.json` (default true). */
  write?: boolean;
  download?: DownloadOptions;
}

/** Write then rename so a concurrent reader never sees a half-written file. */
async function writeAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

function categorySizes(engine: Memberships): Map<string, number> {
  return new Map(CATEGORIES.map((category) => [category.id, engine.size(category)]));
}

/** Download (or read the cache) → build → validate → write `dist/pokedex.json`. */
export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const [tables, manual, overrides] = await Promise.all([
    loadRawTables(options.download),
    loadManual(),
    loadOverrides(),
  ]);

  const pokedex = buildPokedex(tables, {
    maxGen: MAX_GEN,
    sourceSha: PINNED_SHA,
    manual,
    overrides,
  });
  const warnings = crossCheckForms(tables, manual, MAX_GEN);
  // Compact on purpose: this file is shipped to the browser.
  const json = JSON.stringify(pokedex);

  const memberships = computeMemberships(pokedex.pokemon, CATEGORIES);
  const membershipsJson = JSON.stringify(memberships);
  const engine = new Memberships(memberships); // validates the file as the game will read it
  const empty = CATEGORIES.filter((category) => engine.size(category) === 0);
  if (empty.length > 0) {
    throw new Error(`Categories without any member: ${empty.map((c) => c.id).join(', ')}`);
  }

  if (options.write !== false) {
    await mkdir(DIST_DIR, { recursive: true });
    await writeAtomic(POKEDEX_PATH, json);
    await writeAtomic(MEMBERSHIPS_PATH, membershipsJson);
  }

  return {
    pokedex,
    json,
    memberships,
    membershipsJson,
    report: formatReport(pokedex, warnings, categorySizes(engine)),
    warnings,
  };
}
