import { Memberships, type Popularity } from '@pokeneuf/core';
import { runPipeline } from '@pokeneuf/data';

/** The real data (493 Pokémon, all categories), built the way `pnpm data:build` builds it. */
export async function realWorld(): Promise<{ memberships: Memberships; popularity: Popularity }> {
  const { memberships, pokedex } = await runPipeline();
  const pop = new Map(pokedex.pokemon.map((p) => [p.id, p.pop]));
  return { memberships: new Memberships(memberships), popularity: (id) => pop.get(id) ?? 0 };
}

/** The real memberships alone. */
export async function realMemberships(): Promise<Memberships> {
  return (await realWorld()).memberships;
}
