import { readFile } from 'node:fs/promises';
import { Memberships, type MembershipsFile, type Pokedex, type Popularity } from '@pokeneuf/core';
import { MEMBERSHIPS_PATH, POKEDEX_PATH } from './files';

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

/** The estimated popularity (`pop`) of every Pokémon, from the shipped `pokedex.json`. */
export async function loadPopularity(path: string = POKEDEX_PATH): Promise<Popularity> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${path} does not exist: run "pnpm data:build" first.`);
    }
    throw error;
  }
  const pop = new Map((JSON.parse(text) as Pokedex).pokemon.map((p) => [p.id, p.pop]));
  return (id) => pop.get(id) ?? 0;
}
