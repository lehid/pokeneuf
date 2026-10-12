import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACKAGE_ROOT } from './config';
import { readCsvText } from './download';

const CSV = 'id,identifier\n1,bulbasaur\n';

let cacheDir: string;

beforeEach(async () => {
  // Under the git-ignored .cache/ so a crashed run never litters the repo.
  const root = path.join(PACKAGE_ROOT, '.cache');
  await mkdir(root, { recursive: true });
  cacheDir = await mkdtemp(path.join(root, 'test-'));
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

const ok = (body: string) => new Response(body, { status: 200 });

describe('readCsvText', () => {
  it('downloads a missing file once, then serves it from the cache', async () => {
    const fetchImpl = vi.fn(async () => ok(CSV));
    const options = { cacheDir, baseUrl: 'https://example.test/csv', fetchImpl };

    expect(await readCsvText('languages', options)).toBe(CSV);
    expect(await readCsvText('languages', options)).toBe(CSV);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test/csv/languages.csv');
    expect(await readFile(path.join(cacheDir, 'languages.csv'), 'utf8')).toBe(CSV);
  });

  it('never fetches when the file is already cached', async () => {
    await writeFile(path.join(cacheDir, 'stats.csv'), 'id\n1\n');
    const fetchImpl = vi.fn(async () => ok('should not be used'));
    expect(await readCsvText('stats', { cacheDir, fetchImpl })).toBe('id\n1\n');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('leaves no temporary file behind', async () => {
    await readCsvText('types', { cacheDir, fetchImpl: async () => ok(CSV) });
    expect(await readdir(cacheDir)).toEqual(['types.csv']);
  });

  it('retries a server error, then succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(ok(CSV));
    expect(await readCsvText('types', { cacheDir, fetchImpl, attempts: 2 })).toBe(CSV);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404 (wrong SHA or file name) and caches nothing', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    await expect(readCsvText('types', { cacheDir, fetchImpl })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('gives up after the configured number of attempts', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(readCsvText('types', { cacheDir, fetchImpl, attempts: 2 })).rejects.toThrow(
      /after 2 attempts/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses an empty download rather than caching it', async () => {
    await expect(
      readCsvText('types', { cacheDir, fetchImpl: async () => ok('  \n') }),
    ).rejects.toThrow(/empty file/);
    expect(await readdir(cacheDir)).toEqual([]);
  });
});
