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
async function cli(
  script: 'generate-cli' | 'report-cli' | 'publish-cli',
  args: string[],
  env: Record<string, string> = {},
) {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      ['--import', 'tsx', path.join('src', `${script}.ts`), ...args],
      { cwd: ROOT, timeout: 120_000, env: { ...process.env, ...env } },
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
      '--today',
      '2026-10-01', // before these days: nothing is published yet
      '--out',
      dir,
    ]);
    expect(out.stdout).toContain('3 generated, 0 kept');
    expect(await readFile(path.join(dir, '2026-11-02.json'), 'utf8')).toBe(before);
  }, 180_000);

  it('never rewrites a published grid: --force refuses today and the days before', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '4', '--out', dir]);
    const before = await Promise.all(
      (await files()).map((f) => readFile(path.join(dir, f), 'utf8')),
    );
    const force = (today: string) =>
      cli('generate-cli', [
        '--from',
        '2026-11-01',
        '--days',
        '4',
        '--force',
        '--today',
        today,
        '--out',
        dir,
      ]);

    const refused = await force('2026-11-02'); // the 1st and the 2nd are published
    expect(refused.code).toBe(2);
    expect(refused.stderr).toMatch(
      /--force would rewrite published grids \(2026-11-01, 2026-11-02\)/,
    );
    expect(refused.stderr).toContain('history');
    const sameDay = await force('2026-11-01'); // today's grid is public too
    expect(sameDay.code).toBe(2);
    expect(
      await Promise.all((await files()).map((f) => readFile(path.join(dir, f), 'utf8'))),
    ).toEqual(before);

    expect((await force('2026-10-31')).code).toBe(0); // nothing published yet: allowed
  }, 180_000);

  it('can still add missing days after published ones, without touching them', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '2', '--out', dir]);
    const first = await readFile(path.join(dir, '2026-11-01.json'), 'utf8');
    const out = await cli('generate-cli', [
      '--from',
      '2026-11-01',
      '--days',
      '4',
      '--today',
      '2026-11-03',
      '--out',
      dir,
    ]);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('2 generated, 2 kept');
    expect(await readFile(path.join(dir, '2026-11-01.json'), 'utf8')).toBe(first);
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

describe('pnpm grids:publish', () => {
  it('keeps today and the past in the built site, and drops the grids of the days to come', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '6', '--out', dir]);
    const out = await cli('publish-cli', ['--dir', dir, '--today', '2026-11-03']);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('Published 3 grid(s) up to 2026-11-03 (2026-11-01 to 2026-11-03)');
    expect(out.stdout).toContain('3 grid(s) of the days to come');
    expect(await files()).toEqual([
      '2026-11-01.json',
      '2026-11-02.json',
      '2026-11-03.json',
      'index.json',
    ]);
    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
    expect(index.grids.map((g: { date: string }) => g.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);

    // The published folder is still a valid, complete one.
    const report = await cli('report-cli', ['--dir', dir]);
    expect(report.code).toBe(0);
  }, 180_000);

  it('publishes nothing before the launch, and says so', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    const out = await cli('publish-cli', ['--dir', dir, '--today', '2026-10-13']);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('Published 0 grid(s) up to 2026-10-13');
    expect(await files()).toEqual(['index.json']);
    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
    expect(index.grids).toEqual([]);
  }, 180_000);

  it('keeps every grid when they are all past, and can be run twice', async () => {
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    await cli('publish-cli', ['--dir', dir, '--today', '2026-12-01']);
    const once = await Promise.all((await files()).map((f) => readFile(path.join(dir, f), 'utf8')));
    expect((await cli('publish-cli', ['--dir', dir, '--today', '2026-12-01'])).code).toBe(0);
    const twice = await Promise.all(
      (await files()).map((f) => readFile(path.join(dir, f), 'utf8')),
    );
    expect(twice).toEqual(once);
    expect(await files()).toHaveLength(4);
  }, 180_000);

  it('refuses to prune the source grids of the repository', async () => {
    const out = await cli('publish-cli', ['--dir', path.join(ROOT, '../../apps/web/public/grids')]);
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('Refusing to prune');
    expect(out.stderr).toContain('source grids');
  }, 60_000);

  it('reads a relative folder from where the command was typed, as `pnpm` from the root needs', async () => {
    // pnpm runs the script in tools/generator but names the real place in INIT_CWD.
    await cli('generate-cli', ['--from', '2026-11-01', '--days', '3', '--out', dir]);
    const out = await cli('publish-cli', ['--dir', path.basename(dir), '--today', '2026-11-02'], {
      INIT_CWD: path.dirname(dir),
    });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('Published 2 grid(s)');
    expect(await files()).toEqual(['2026-11-01.json', '2026-11-02.json', 'index.json']);
  }, 180_000);

  it('fails, and creates nothing, when the folder is wrong', async () => {
    const out = await cli('publish-cli', ['--dir', 'no/such/place', '--today', '2026-11-02'], {
      INIT_CWD: dir,
    });
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('does not exist');
    expect(await files()).toEqual([]);
  }, 60_000);

  it('wants a folder and a valid date', async () => {
    const noDir = await cli('publish-cli', []);
    expect(noDir.code).toBe(2);
    expect(noDir.stderr).toContain('--dir is required');
    const badDate = await cli('publish-cli', ['--dir', dir, '--today', 'demain']);
    expect(badDate.code).toBe(2);
    expect(badDate.stderr).toContain('--today must be YYYY-MM-DD');
  }, 60_000);
});
