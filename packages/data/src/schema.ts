import {
  EVOLUTION_METHODS,
  POKEDEX_COLORS,
  POKEDEX_SHAPES,
  POKEMON_TYPES,
  type Pokedex,
} from '@pokeneuf/core';
import { z } from 'zod';

const positiveInt = z.number().int().positive();
const stat = z.number().int().min(1).max(255);

const evolutionSchema = z.strictObject({
  stage: positiveInt,
  isFinal: z.boolean(),
  evolvesFromId: positiveInt.nullable(),
  evolvesToIds: z.array(positiveInt),
  methods: z.array(z.enum(EVOLUTION_METHODS)),
  branched: z.boolean(),
  evolutionAddedInGen: positiveInt.nullable(),
});

const pokemonSchema = z.strictObject({
  id: positiveInt,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  nameFr: z.string().min(1),
  nameEn: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  generation: positiveInt,
  types: z.array(z.enum(POKEMON_TYPES)).min(1).max(2),
  baseStats: z.strictObject({
    hp: stat,
    attack: stat,
    defense: stat,
    specialAttack: stat,
    specialDefense: stat,
    speed: stat,
  }),
  abilities: z
    .array(
      z.strictObject({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        nameFr: z.string().min(1),
        isHidden: z.boolean(),
      }),
    )
    .min(1)
    .max(3),
  evolution: evolutionSchema,
  isBaby: z.boolean(),
  isLegendary: z.boolean(),
  isMythical: z.boolean(),
  isStarter: z.boolean(),
  isFossil: z.boolean(),
  isPseudoLegendary: z.boolean(),
  color: z.enum(POKEDEX_COLORS),
  shape: z.enum(POKEDEX_SHAPES),
  heightDm: positiveInt,
  weightHg: positiveInt,
  hasMega: z.boolean(),
  hasGmax: z.boolean(),
});

export const pokedexSchema = z.strictObject({
  meta: z.strictObject({
    schemaVersion: positiveInt,
    source: z.string().min(1),
    sourceSha: z.string().regex(/^[0-9a-f]{40}$/),
    maxGen: positiveInt,
    count: positiveInt,
  }),
  pokemon: z.array(pokemonSchema).min(1),
});

// Compile-time guard: the schema and the shared `Pokedex` type must describe exactly the same data.
type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type SchemaMatchesCoreTypes = Assert<Same<z.infer<typeof pokedexSchema>, Pokedex>>;

/** Cross-field rules that a per-field schema cannot express. Returns human-readable problems. */
export function checkInvariants(pokedex: Pokedex): string[] {
  const problems: string[] = [];
  const { maxGen, count } = pokedex.meta;
  const byId = new Map(pokedex.pokemon.map((p) => [p.id, p]));
  const slugs = new Set<string>();

  if (pokedex.pokemon.length !== count) {
    problems.push(`meta.count is ${count} but there are ${pokedex.pokemon.length} entries`);
  }
  if (byId.size !== pokedex.pokemon.length) problems.push('duplicate ids');

  pokedex.pokemon.forEach((p, index) => {
    const who = `#${p.id} ${p.slug}`;
    const evo = p.evolution;

    // National dex numbers of the in-scope generations are contiguous: 1..count.
    if (p.id !== index + 1) problems.push(`${who}: expected id ${index + 1} at position ${index}`);
    if (p.generation > maxGen) problems.push(`${who}: generation ${p.generation} > MAX_GEN`);
    if (slugs.has(p.slug)) problems.push(`${who}: duplicate slug`);
    slugs.add(p.slug);

    if (new Set(p.types).size !== p.types.length) problems.push(`${who}: duplicate type`);
    if (p.isLegendary && p.isMythical) problems.push(`${who}: both legendary and mythical`);
    if (p.aliases.some((a) => a === p.nameFr || a === p.nameEn)) {
      problems.push(`${who}: an alias repeats an official name`);
    }

    const hidden = p.abilities.filter((a) => a.isHidden).length;
    if (hidden > 1) problems.push(`${who}: ${hidden} hidden abilities`);

    if (evo.isFinal !== (evo.evolvesToIds.length === 0)) problems.push(`${who}: isFinal mismatch`);
    if (evo.branched !== evo.evolvesToIds.length > 1) problems.push(`${who}: branched mismatch`);
    if (evo.isFinal !== (evo.methods.length === 0)) problems.push(`${who}: methods vs isFinal`);
    if (p.isBaby && evo.stage !== 1) problems.push(`${who}: a baby must be stage 1`);
    if ((evo.evolvesFromId === null) !== (evo.evolutionAddedInGen === null)) {
      problems.push(`${who}: evolvesFromId / evolutionAddedInGen disagree`);
    }
    const sortedTo = [...evo.evolvesToIds].sort((a, b) => a - b);
    if (evo.evolvesToIds.some((id, i) => id !== sortedTo[i])) {
      problems.push(`${who}: evolvesToIds not sorted`);
    }

    const from = evo.evolvesFromId === null ? undefined : byId.get(evo.evolvesFromId);
    if (evo.evolvesFromId !== null) {
      if (!from) {
        problems.push(`${who}: evolvesFromId ${evo.evolvesFromId} is not in the Pokédex`);
      } else {
        if (!from.evolution.evolvesToIds.includes(p.id)) {
          problems.push(`${who}: ${from.slug} does not list it in evolvesToIds`);
        }
        if (evo.stage !== from.evolution.stage + 1) problems.push(`${who}: stage mismatch`);
        const added = Math.max(p.generation, from.generation);
        if (evo.evolutionAddedInGen !== added) {
          problems.push(`${who}: evolutionAddedInGen should be ${added}`);
        }
      }
    } else if (evo.stage !== 1) {
      problems.push(`${who}: no pre-evolution but stage ${evo.stage}`);
    }

    for (const toId of evo.evolvesToIds) {
      const to = byId.get(toId);
      if (!to) problems.push(`${who}: evolvesToIds ${toId} is not in the Pokédex`);
      else if (to.evolution.evolvesFromId !== p.id) {
        problems.push(`${who}: ${to.slug} does not point back to it`);
      }
    }
  });

  return problems;
}

/** Validates an unknown value: schema first, then cross-field invariants. Throws a readable error. */
export function parsePokedex(input: unknown): Pokedex {
  const result = pokedexSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`pokedex.json does not match the schema:\n${z.prettifyError(result.error)}`);
  }
  const problems = checkInvariants(result.data);
  if (problems.length > 0) {
    const shown = problems.slice(0, 20).map((p) => `  - ${p}`);
    const more = problems.length > 20 ? [`  … and ${problems.length - 20} more`] : [];
    throw new Error(
      `pokedex.json breaks ${problems.length} invariant(s):\n${[...shown, ...more].join('\n')}`,
    );
  }
  return result.data;
}
