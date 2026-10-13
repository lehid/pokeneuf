import { readFile } from 'node:fs/promises';
import { Memberships, type MembershipsFile } from '@pokeneuf/core';
import { MEMBERSHIPS_PATH } from './files';

/** The shipped memberships, with a hint when `pnpm data:build` has not been run. */
export async function loadMemberships(path: string = MEMBERSHIPS_PATH): Promise<Memberships> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${path} does not exist: run "pnpm data:build" first.`);
    }
    throw error;
  }
  return new Memberships(JSON.parse(text) as MembershipsFile);
}
