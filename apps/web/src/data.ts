import {
  createSearch,
  Memberships,
  type Grid,
  type MembershipsFile,
  type Pokedex,
  type Popularity,
  type Pokemon,
} from '@pokeneuf/core';
import membershipsJson from '@data/memberships.json';
import pokedexJson from '@data/pokedex.json';
import demoGridJson from './demo/grid.json';

// Both files come from `pnpm data:build` and are validated there; this only checks they agree.
export const pokedex = pokedexJson as unknown as Pokedex;
export const memberships = new Memberships(membershipsJson as unknown as MembershipsFile);
if (memberships.count !== pokedex.meta.count) {
  throw new Error('pokedex.json and memberships.json do not describe the same Pokédex');
}

export const search = createSearch(pokedex.pokemon);

/** v1 rarity: the estimated popularity of the Pokédex. In v2, a live share takes its place here. */
export const popularity: Popularity = (id) => pokemonById(id).pop;

const byId = new Map<number, Pokemon>(pokedex.pokemon.map((p) => [p.id, p]));
export function pokemonById(id: number): Pokemon {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown Pokémon number: ${id}`);
  return found;
}

/** Phase 4 plays a fixed grid from a local file; phase 5 fetches the daily one. */
export const demoGrid = demoGridJson as unknown as Grid;
