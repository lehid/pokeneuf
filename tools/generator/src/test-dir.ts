import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** A scratch folder under the git-ignored `.cache/`, removed by the returned function. */
export async function scratchDir(): Promise<{ dir: string; remove: () => Promise<void> }> {
  const parent = path.join(ROOT, '.cache');
  await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(path.join(parent, 'test-'));
  return { dir, remove: () => rm(dir, { recursive: true, force: true }) };
}
