import { Memberships } from '@pokeneuf/core';
import { runPipeline } from '@pokeneuf/data';

/** The real memberships (493 Pokémon, 58 categories), built the way `pnpm data:build` builds them. */
export async function realMemberships(): Promise<Memberships> {
  const { memberships } = await runPipeline();
  return new Memberships(memberships);
}
