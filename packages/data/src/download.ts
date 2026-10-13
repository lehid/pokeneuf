import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, CSV_BASE_URL, CSV_FILES, type CsvName } from './config';
import { parseCsv, type CsvRow } from './csv';

export type RawTables = Record<CsvName, CsvRow[]>;

export interface DownloadOptions {
  cacheDir?: string;
  baseUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Total attempts per file (network errors and 5xx only). */
  attempts?: number;
}

async function readCache(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** A 4xx will not fix itself (wrong SHA or file name): never retried. */
class PermanentDownloadError extends Error {}

async function fetchText(url: string, fetchImpl: typeof fetch, attempts: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url);
      if (response.ok) return await response.text();
      if (response.status < 500) {
        throw new PermanentDownloadError(`HTTP ${response.status} for ${url}`);
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      if (error instanceof PermanentDownloadError) throw error;
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error(`Could not download ${url} after ${attempts} attempts`, { cause: lastError });
}

/**
 * Text of a remote file: from the local cache when present, downloaded (then cached) otherwise.
 * The URL is pinned to a commit, so a cached copy never goes stale.
 */
export async function readCachedText(
  file: string,
  url: string,
  options: Pick<DownloadOptions, 'fetchImpl' | 'attempts'> = {},
): Promise<string> {
  const cached = await readCache(file);
  if (cached !== null) return cached;

  const text = await fetchText(url, options.fetchImpl ?? fetch, options.attempts ?? 3);
  if (text.trim() === '') throw new Error(`Downloaded an empty file: ${url}`);

  // Write then rename: an interrupted download can never leave a truncated file in the cache.
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
  return text;
}

/** Text of one PokeAPI CSV. */
export function readCsvText(name: CsvName, options: DownloadOptions = {}): Promise<string> {
  return readCachedText(
    path.join(options.cacheDir ?? CACHE_DIR, `${name}.csv`),
    `${options.baseUrl ?? CSV_BASE_URL}/${name}.csv`,
    options,
  );
}

export async function loadRawTables(options: DownloadOptions = {}): Promise<RawTables> {
  const entries = await Promise.all(
    CSV_FILES.map(async (name) => [name, parseCsv(await readCsvText(name, options))] as const),
  );
  return Object.fromEntries(entries) as RawTables;
}
