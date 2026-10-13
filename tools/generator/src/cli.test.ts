import { execFile } from 'node:child_process';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { scratchDir } from './test-dir';
import { realMemberships } from './test-world';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Runs a CLI the way `pnpm grids:*` does (tsx), without failing on a non-zero exit. */
async function cli(script: 'generate-cli' | 'report-cli', args: string[]) {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      ['--import', 'tsx', path.join('src', `${script}.ts`), ...args],
      { cwd: ROOT, timeout: 120_000 },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string };
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr };
  }
}

let dir: string;
let remove: () => Promise<void>;
beforeAll(async () => {
  await realMemberships(); // makes sure packages/data/dist/memberships.json exists
}, 120_000);
beforeEach(async () => {
  ({ dir, remove } = await scratchDir());
});
afterEach(() => remove());

const files = async () => (await readdir(dir)).sort();

describe('pnpm grids:generate', () => {
  it('writes one file per day and an index, then reports cleanly', async () => {
    const out = await cli('generate-cli', ['--from', '2026-11-01', '--days', '5', '--out', dir]);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('5 generated, 0 kept');
    expect(await files()).toEqual([
      '2026-11-01.json',
      '2026-11-02.json',
      '2026-11-03.json',
      '2026-11-04.json',
      '2026-11-05.json',
      'index.json',
    ]);
    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
    expect(index.grids.map((g: { id: number }) => g.id)).toEqual([1, 2, 3, 4, 5]);

    const report = await cli('report-cli', ['--dir', dir]);
    expect(report.code).toBe(0);
    expect(report.stdout).toContain('No problem found.');
  }, 180_000);

  it('is deterministic and incremental: extending the range keeps the existing grids', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '4', '--out', dir]);
    const before = await readFile(path.join(dir, '2026-11-03.json'), 'utf8');
    const out = await cli('generate-cli', ['--from', '2026-11-01', '--days', '6', '--out', dir]);
    expect(out.stdout).toContain('2 generated, 4 kept');
    expect(await readFile(path.join(dir, '2026-11-03.json'), 'utf8')).toBe(before);
    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
    expect(index.grids).toHaveLength(6);
  }, 180_000);

  it('gives the same files as a single run over the whole range', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '7', '--out', dir]);
    const incremental = await Promise.all(
      (await files()).map((f) => readFile(path.join(dir, f), 'utf8')),
    );
    const { dir: other, remove: removeOther } = await scratchDir();
    try {
      await cli('generate-cli', ['--from', '2026-11-01', '--days', '7', '--out', other]);
      const whole = await Promise.all(
        (await readdir(other)).sort().map((f) => readFile(path.join(other, f), 'utf8')),
      );
      expect(incremental).toEqual(whole);
    } finally {
      await removeOther();
    }
  }, 180_000);

  it('regenerates the same grids with --force', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    const before = await readFile(path.join(dir, '2026-11-02.json'), 'utf8');
    const out = await cli('generate-cli', [
      '--from',
      '2026-11-01',
      '--days',
      '3',
      '--force',
      '--out',
      dir,
    ]);
    expect(out.stdout).toContain('3 generated, 0 kept');
    expect(await readFile(path.join(dir, '2026-11-02.json'), 'utf8')).toBe(before);
  }, 180_000);

  it.each([
    [[], /--from is required/],
    [['--from', '2026-11-01'], /--days must be an integer/],
    [['--from', '2026-11-01', '--days', '0'], /--days must be an integer/],
    [['--from', '2026-11-01', '--days', '400'], /--days must be an integer/],
    [['--from', 'tomorrow', '--days', '3'], /--from is required/],
    [['--from', '2026-10-01', '--days', '3'], /before the launch date/],
  ])(
    'refuses bad arguments %j',
    async (args, message) => {
      const out = await cli('generate-cli', [...args, '--out', dir]);
      expect(out.code).toBe(2);
      expect(out.stderr).toMatch(message);
      expect(out.stderr).toContain('Usage: pnpm grids:generate');
      expect(await files()).toEqual([]);
    },
    60_000,
  );

  it('explains how to build the memberships when they are missing', async () => {
    const out = await cli('generate-cli', [
      '--from',
      '2026-11-01',
      '--days',
      '1',
      '--out',
      dir,
      '--memberships',
      path.join(dir, 'nope.json'),
    ]);
    expect(out.code).not.toBe(0);
    expect(out.stderr).toMatch(/pnpm data:build/);
  }, 60_000);
});

describe('pnpm grids:report', () => {
  it('fails, and says why, when a grid file was edited into something invalid', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    const file = path.join(dir, '2026-11-02.json');
    const grid = JSON.parse(await readFile(file, 'utf8'));
    grid.rows[0] = grid.cols[0]; // a category twice
    await writeFile(file, JSON.stringify(grid));
    const out = await cli('report-cli', ['--dir', dir]);
    expect(out.code).toBe(1);
    expect(out.stdout).toMatch(/appears twice/);
  }, 180_000);

  it('fails when a day is missing', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '4', '--out', dir]);
    await rm(path.join(dir, '2026-11-03.json'));
    const out = await cli('report-cli', ['--dir', dir]);
    expect(out.code).toBe(1);
    expect(out.stdout).toMatch(/missing days: 2026-11-02 → 2026-11-04/);
  }, 180_000);
});
