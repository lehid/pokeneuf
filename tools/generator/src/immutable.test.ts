import { execFile } from 'node:child_process';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { frozenChanges, GRIDS_REPO_PATH, parseNameStatus } from './immutable';
import { scratchDir } from './test-dir';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const grid = (date: string) => `${GRIDS_REPO_PATH}/${date}.json`;

describe('parseNameStatus', () => {
  it('reads added, modified, deleted, renamed and copied files (NUL separated)', () => {
    const output = [
      'A',
      'a.json',
      'M',
      'b.json',
      'D',
      'c.json',
      'R087',
      'old.json',
      'new.json',
      'C100',
      'x',
      'y',
      'T',
      't',
    ]
      .join('\0')
      .concat('\0');
    expect(parseNameStatus(output)).toEqual([
      { kind: 'added', path: 'a.json' },
      { kind: 'modified', path: 'b.json' },
      { kind: 'deleted', path: 'c.json' },
      { kind: 'renamed', path: 'new.json', from: 'old.json' },
      { kind: 'added', path: 'y' },
      { kind: 'other', path: 't' },
    ]);
    expect(parseNameStatus('')).toEqual([]);
  });
});

describe('frozenChanges', () => {
  it('flags modified, deleted, renamed (either side) and retyped grids dated today or before', () => {
    const found = frozenChanges(
      [
        { kind: 'modified', path: grid('2026-11-01') },
        { kind: 'deleted', path: grid('2026-11-02') },
        { kind: 'renamed', path: grid('2026-11-20'), from: grid('2026-11-03') },
        { kind: 'other', path: grid('2026-11-04') },
      ],
      '2026-11-04',
    );
    expect(found.map((c) => [c.kind, c.date])).toEqual([
      ['modified', '2026-11-01'],
      ['deleted', '2026-11-02'],
      ['renamed', '2026-11-03'],
      ['other', '2026-11-04'],
    ]);
    expect(found[0]?.reason).toContain('already public');
  });

  it('lets the future be edited, new grids be added, and other files change', () => {
    expect(
      frozenChanges(
        [
          { kind: 'modified', path: grid('2026-11-05') }, // tomorrow: still a draft
          { kind: 'added', path: grid('2026-11-01') },
          { kind: 'modified', path: `${GRIDS_REPO_PATH}/index.json` },
          { kind: 'modified', path: 'apps/web/src/App.tsx' },
          { kind: 'modified', path: `elsewhere/grids/2026-11-01.json` },
        ],
        '2026-11-04',
      ),
    ).toEqual([]);
  });
});

describe('pnpm grids:immutable on a temporary git repository', () => {
  let repo: string;
  let remove: () => Promise<void>;

  const git = (...args: string[]) =>
    run(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.com',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd: repo },
    );
  const write = async (name: string, content: string) => {
    await mkdir(path.dirname(path.join(repo, name)), { recursive: true });
    await writeFile(path.join(repo, name), content);
  };
  const commit = async (message: string) => {
    await git('add', '-A');
    await git('commit', '-m', message);
  };
  const immutable = async (today: string, extra: string[] = []) => {
    try {
      const { stdout, stderr } = await run(
        process.execPath,
        [
          '--import',
          'tsx',
          path.join('src', 'immutable-cli.ts'),
          '--repo',
          repo,
          '--base',
          'main',
          '--today',
          today,
          ...extra,
        ],
        { cwd: ROOT, timeout: 60_000 },
      );
      return { code: 0, stdout, stderr };
    } catch (error) {
      const failed = error as { code: number; stdout: string; stderr: string };
      return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr };
    }
  };

  beforeEach(async () => {
    let dir: string;
    ({ dir, remove } = await scratchDir());
    repo = dir;
    await git('init', '-q', '-b', 'main');
    for (const day of ['01', '02', '03']) await write(grid(`2026-11-${day}`), `{"day":"${day}"}\n`);
    await write(`${GRIDS_REPO_PATH}/index.json`, '{}\n');
    await commit('initial grids');
    await git('checkout', '-q', '-b', 'change');
  }, 60_000);
  afterEach(() => remove());

  it('passes when nothing changed, and when only new or future grids change', async () => {
    expect((await immutable('2026-11-02')).code).toBe(0);
    await write(grid('2026-11-03'), '{"day":"03","edited":true}\n'); // after today: a draft
    await write(grid('2026-11-04'), '{}\n'); // new
    await write(`${GRIDS_REPO_PATH}/index.json`, '{"more":1}\n');
    await commit('new grids');
    const out = await immutable('2026-11-02');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('No published grid');
  }, 60_000);

  it('fails when a published grid is modified', async () => {
    await write(grid('2026-11-02'), '{"day":"02","edited":true}\n');
    await commit('edit');
    const out = await immutable('2026-11-02');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain(`${grid('2026-11-02')} was modified`);
    expect((await immutable('2026-11-01')).code).toBe(0); // the 2nd was not public yet
  }, 60_000);

  it('fails when a published grid is deleted or renamed', async () => {
    await rm(path.join(repo, grid('2026-11-01')));
    await rename(path.join(repo, grid('2026-11-02')), path.join(repo, grid('2026-12-25')));
    await commit('delete and move');
    const out = await immutable('2026-11-03');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('2026-11-01.json was deleted');
    expect(out.stderr).toContain('2026-11-02.json was renamed');
  }, 60_000);

  it('also sees changes that are not committed yet', async () => {
    await write(grid('2026-11-01'), '{"day":"01","edited":true}\n');
    expect((await immutable('2026-11-03')).code).toBe(1);
  }, 60_000);

  it('compares with the point where the branch left the base, not with the base tip', async () => {
    await git('checkout', '-q', 'main');
    await write(grid('2026-11-01'), '{"day":"01","fixed on main":true}\n'); // main moved on
    await commit('main moves');
    await git('checkout', '-q', 'change');
    await write('README.md', 'hello\n');
    await commit('unrelated');
    expect((await immutable('2026-11-03')).code).toBe(0);
  }, 60_000);

  it('says what is wrong with an unknown base, and does not pass silently', async () => {
    const out = await immutable('2026-11-03', ['--base', 'origin/nope']);
    expect(out.code).toBe(2);
    expect(out.stderr).toContain('Cannot compare with');
  }, 60_000);
});
