import { mkdir, rename, writeFile } from 'node:fs/promises';
import { MAX_GEN, type Pokedex } from '@pokeneuf/core';
import { DIST_DIR, PINNED_SHA, POKEDEX_PATH } from './config';
import { buildPokedex } from './build';
import { loadRawTables, type DownloadOptions } from './download';
import { crossCheckForms } from './forms';
import { loadManual, loadOverrides } from './manual';
import { formatReport } from './report';

export interface PipelineResult {
  pokedex: Pokedex;
  /** Exactly what is written to `dist/pokedex.json`. */
  json: string;
  report: string;
  /** Manual lists that disagree with the source. Not fatal, but never silent. */
  warnings: string[];
}

export interface PipelineOptions {
  /** Write `dist/pokedex.json` (default true). */
  write?: boolean;
  download?: DownloadOptions;
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

  if (options.write !== false) {
    await mkdir(DIST_DIR, { recursive: true });
    // Write then rename so a concurrent reader never sees a half-written file.
    const tmp = `${POKEDEX_PATH}.${process.pid}.tmp`;
    await writeFile(tmp, json, 'utf8');
    await rename(tmp, POKEDEX_PATH);
  }

  return { pokedex, json, report: formatReport(pokedex, warnings), warnings };
}
