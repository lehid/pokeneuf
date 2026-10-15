import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GridDate } from '@pokeneuf/core';

const git = promisify(execFile);

/** Where the committed grids live, relative to the repository root (forward slashes, as git prints them). */
export const GRIDS_REPO_PATH = 'apps/web/public/grids';

export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'other';

export interface FileChange {
  kind: ChangeKind;
  /** The path after the change (for a rename, the new one). */
  path: string;
  /** For a rename, the path before. */
  from?: string;
}

export interface FrozenChange {
  kind: ChangeKind;
  date: GridDate;
  path: string;
  /** Why it is refused, in one line. */
  reason: string;
}

/** `git diff --name-status -z` output, parsed. A rename carries two paths, a copy adds the new one. */
export function parseNameStatus(output: string): FileChange[] {
  const parts = output.split('\0');
  const changes: FileChange[] = [];
  for (let i = 0; i < parts.length;) {
    const status = parts[i++];
    if (!status) continue;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const from = parts[i++] ?? '';
      const path = parts[i++] ?? '';
      changes.push(letter === 'R' ? { kind: 'renamed', path, from } : { kind: 'added', path });
      continue;
    }
    const path = parts[i++] ?? '';
    const kind: ChangeKind =
      letter === 'A' ? 'added' : letter === 'M' ? 'modified' : letter === 'D' ? 'deleted' : 'other';
    changes.push({ kind, path });
  }
  return changes;
}

const gridFile = (dir: string) =>
  new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d{4}-\\d{2}-\\d{2})\\.json$`);

/**
 * Among the changes, the ones that touch a grid file dated today or earlier: those grids are public
 * and are history. Adding a past grid is not a rewrite (the generator already refuses it without
 * `--allow-past`), but modifying, deleting, renaming or changing the type of one is refused.
 * `index.json` is not a grid: it changes whenever a grid is added.
 */
export function frozenChanges(
  changes: readonly FileChange[],
  today: GridDate,
  dir: string = GRIDS_REPO_PATH,
): FrozenChange[] {
  const pattern = gridFile(dir);
  const found: FrozenChange[] = [];
  for (const change of changes) {
    if (change.kind === 'added') continue;
    for (const path of [change.path, change.from]) {
      const date = path === undefined ? undefined : pattern.exec(path)?.[1];
      if (path === undefined || date === undefined || date > today) continue;
      const what = change.kind === 'other' ? 'changed' : change.kind;
      found.push({
        kind: change.kind,
        date,
        path,
        reason: `${path} was ${what}, but the grid of ${date} is already public`,
      });
    }
  }
  return found;
}

/** What changed in the working tree compared with the point where it left `base`. */
export async function changesSince(base: string, repoDir: string): Promise<FileChange[]> {
  const run = async (args: string[]) =>
    (await git('git', args, { cwd: repoDir, maxBuffer: 64 * 1024 * 1024 })).stdout;
  let mergeBase: string;
  try {
    mergeBase = (await run(['merge-base', base, 'HEAD'])).trim();
  } catch {
    throw new Error(
      `Cannot compare with "${base}": no such ref, or no common history. ` +
        `In CI, check out with fetch-depth: 0 so that the base branch is available.`,
    );
  }
  return parseNameStatus(await run(['diff', '--name-status', '-z', '--find-renames', mergeBase]));
}
