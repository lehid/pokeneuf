// Same data as `data.ts`, read from disk: for the Node side of the Playwright tests.
import { readFileSync } from 'node:fs';
import { Memberships, type Grid, type MembershipsFile, type Pokedex } from '@pokeneuf/core';

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const pokedex = read('../../../packages/data/dist/pokedex.json') as Pokedex;
export const memberships = new Memberships(
  read('../../../packages/data/dist/memberships.json') as MembershipsFile,
);
export const demoGrid = read('./demo/grid.json') as Grid;

export function pokemonById(id: number) {
  const found = pokedex.pokemon.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown Pokémon number: ${id}`);
  return found;
}

/** The committed grid of a day (`public/grids/{date}.json`). */
export function gridOn(date: string): Grid {
  return read(`../public/grids/${date}.json`) as Grid;
}
