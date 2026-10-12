import type { Pokedex } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { buildPokedex } from './build';
import { checkInvariants, parsePokedex } from './schema';
import { buildOptions, fakeTables, type FakeEvolution, type FakeSpecies } from './test-fixtures';

const species: FakeSpecies[] = [
  { id: 1 },
  { id: 2, from: 1 },
  { id: 3, from: 2 },
  { id: 4, isBaby: true },
];
const evolutions: FakeEvolution[] = [
  { into: 2, columns: { minimum_level: '16' } },
  { into: 3, columns: { minimum_level: '32' } },
];

function valid(): Pokedex {
  return buildPokedex(fakeTables(species, evolutions), buildOptions());
}

/** A copy of the valid Pokédex with `mutate` applied, run through the full validation. */
function parseBroken(mutate: (pokedex: Pokedex) => void): () => unknown {
  const copy = structuredClone(valid());
  mutate(copy);
  return () => parsePokedex(copy);
}

function entry(pokedex: Pokedex, id: number) {
  const found = pokedex.pokemon.find((p) => p.id === id);
  if (!found) throw new Error(`no entry ${id}`);
  return found;
}

describe('parsePokedex', () => {
  it('accepts a coherent Pokédex and returns it unchanged', () => {
    expect(parsePokedex(structuredClone(valid()))).toEqual(valid());
    expect(checkInvariants(valid())).toEqual([]);
  });

  it('rejects data that is not a Pokédex at all', () => {
    expect(() => parsePokedex(null)).toThrow(/does not match the schema/);
    expect(() => parsePokedex({ meta: {}, pokemon: [] })).toThrow(/does not match the schema/);
  });

  it.each([
    ['an unknown key', (p: Pokedex) => Object.assign(entry(p, 1), { sprite: 'x.png' })],
    ['a stat of 0', (p: Pokedex) => void (entry(p, 1).baseStats.hp = 0)],
    ['a 256 stat', (p: Pokedex) => void (entry(p, 1).baseStats.speed = 256)],
    ['three types', (p: Pokedex) => void (entry(p, 1).types = ['fire', 'water', 'ice'])],
    ['no type', (p: Pokedex) => void (entry(p, 1).types = [])],
    ['a made-up type', (p: Pokedex) => void ((entry(p, 1).types as string[])[0] = 'sound')],
    ['an empty French name', (p: Pokedex) => void (entry(p, 1).nameFr = '')],
    ['an upper-case slug', (p: Pokedex) => void (entry(p, 1).slug = 'Bulbasaur')],
    ['a negative height', (p: Pokedex) => void (entry(p, 1).heightDm = -1)],
    ['a short SHA', (p: Pokedex) => void (p.meta.sourceSha = 'abc123')],
  ])('rejects %s', (_name, mutate) => {
    expect(parseBroken(mutate)).toThrow(/does not match the schema/);
  });

  it.each([
    ['a wrong count', (p: Pokedex) => void (p.meta.count = 99), /meta\.count/],
    ['a gap in the numbering', (p: Pokedex) => void (entry(p, 4).id = 9), /expected id 4/],
    [
      'a Pokémon beyond MAX_GEN',
      (p: Pokedex) => void (entry(p, 1).generation = 5),
      /generation 5 > MAX_GEN/,
    ],
    [
      'a duplicate slug',
      (p: Pokedex) => void (entry(p, 2).slug = entry(p, 1).slug),
      /duplicate slug/,
    ],
    [
      'a repeated type',
      (p: Pokedex) => void (entry(p, 1).types = ['fire', 'fire']),
      /duplicate type/,
    ],
    [
      'legendary and mythical at once',
      (p: Pokedex) => {
        entry(p, 1).isLegendary = true;
        entry(p, 1).isMythical = true;
      },
      /both legendary and mythical/,
    ],
    [
      'two hidden abilities',
      (p: Pokedex) =>
        void (entry(p, 1).abilities = [
          { slug: 'a', nameFr: 'A', isHidden: true },
          { slug: 'b', nameFr: 'B', isHidden: true },
        ]),
      /2 hidden abilities/,
    ],
    [
      'isFinal contradicting the targets',
      (p: Pokedex) => void (entry(p, 1).evolution.isFinal = true),
      /isFinal mismatch/,
    ],
    [
      'branched contradicting the targets',
      (p: Pokedex) => void (entry(p, 1).evolution.branched = true),
      /branched mismatch/,
    ],
    [
      'methods on a final Pokémon',
      (p: Pokedex) => void (entry(p, 3).evolution.methods = ['level']),
      /methods vs isFinal/,
    ],
    [
      'a baby that is not stage 1',
      (p: Pokedex) => void (entry(p, 4).evolution.stage = 2),
      /baby must be stage 1/,
    ],
    ['a wrong stage', (p: Pokedex) => void (entry(p, 3).evolution.stage = 2), /stage mismatch/],
    [
      'a link that is not reciprocal',
      (p: Pokedex) => void (entry(p, 1).evolution.evolvesToIds = []),
      /does not list it/,
    ],
    [
      'a dangling pre-evolution',
      (p: Pokedex) => void (entry(p, 2).evolution.evolvesFromId = 99),
      /not in the Pokédex/,
    ],
    [
      'a wrong evolutionAddedInGen',
      (p: Pokedex) => void (entry(p, 2).evolution.evolutionAddedInGen = 3),
      /evolutionAddedInGen should be 1/,
    ],
    [
      'an alias repeating a name',
      (p: Pokedex) => void (entry(p, 1).aliases = [entry(p, 1).nameEn]),
      /alias repeats an official name/,
    ],
  ] satisfies [string, (p: Pokedex) => void, RegExp][])('rejects %s', (_name, mutate, message) => {
    expect(parseBroken(mutate)).toThrow(message);
  });

  it('reports every problem it finds, not just the first', () => {
    const run = parseBroken((p) => {
      entry(p, 1).generation = 9;
      entry(p, 4).generation = 9;
    });
    expect(run).toThrow(/#1 .*generation 9 > MAX_GEN[\s\S]*#4 .*generation 9 > MAX_GEN/);
  });
});
