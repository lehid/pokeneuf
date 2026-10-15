import type { Pokemon } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { buildPokedex, deepMerge } from './build';
import {
  buildOptions,
  emptyManual,
  fakeTables,
  type FakeEvolution,
  type FakeSpecies,
} from './test-fixtures';

function build(species: FakeSpecies[], evolutions: FakeEvolution[] = [], maxGen = 4) {
  return buildPokedex(fakeTables(species, evolutions), buildOptions({ maxGen }));
}

function entry(pokemon: Pokemon[], id: number): Pokemon {
  const found = pokemon.find((p) => p.id === id);
  if (!found) throw new Error(`no entry ${id}`);
  return found;
}

/** `from` → `into` by level 16, the plain case. */
const level = (into: number): FakeEvolution => ({ into, columns: { minimum_level: '16' } });

/** Methods of species 1 when it evolves into species 2 through the given row. */
function methodsFor(evolution: Omit<FakeEvolution, 'into'>): string[] {
  const { pokemon } = build([{ id: 1 }, { id: 2, from: 1 }], [{ into: 2, ...evolution }]);
  return entry(pokemon, 1).evolution.methods;
}

describe('scope (MAX_GEN)', () => {
  it('keeps only species of generation <= maxGen', () => {
    const { pokemon, meta } = build([
      { id: 1 },
      { id: 2, generation: 4 },
      { id: 3, generation: 5 },
    ]);
    expect(pokemon.map((p) => p.id)).toEqual([1, 2]);
    expect(meta.count).toBe(2);
  });

  it('ignores an evolution into a species outside the scope (the Colossinge case)', () => {
    // Species 2 evolves into species 3, which is Gen 5: out of the scope.
    const { pokemon } = build(
      [{ id: 1 }, { id: 2, from: 1 }, { id: 3, from: 2, generation: 5 }],
      [level(2), level(3)],
    );
    const middle = entry(pokemon, 2).evolution;
    expect(middle.isFinal).toBe(true);
    expect(middle.evolvesToIds).toEqual([]);
    expect(middle.methods).toEqual([]);
    expect(middle.branched).toBe(false);
    expect(middle.stage).toBe(2);
  });

  it('does not count an out-of-scope evolution as a branch', () => {
    // Like Sneasel: Weavile (in scope) and Sneasler (out of scope).
    const { pokemon } = build(
      [{ id: 1 }, { id: 2, from: 1, generation: 4 }, { id: 3, from: 1, generation: 8 }],
      [level(2), level(3)],
    );
    expect(entry(pokemon, 1).evolution.evolvesToIds).toEqual([2]);
    expect(entry(pokemon, 1).evolution.branched).toBe(false);
  });

  it('drops a pre-evolution outside the scope too (a lower maxGen is consistent)', () => {
    // Pichu (Gen 2) → Pikachu (Gen 1): with maxGen 1 Pikachu has no pre-evolution.
    const { pokemon } = build(
      [
        { id: 1, from: 2 },
        { id: 2, generation: 2 },
      ],
      [level(1)],
      1,
    );
    expect(pokemon.map((p) => p.id)).toEqual([1]);
    expect(entry(pokemon, 1).evolution).toMatchObject({
      stage: 1,
      evolvesFromId: null,
      evolutionAddedInGen: null,
    });
  });
});

describe('evolution graph', () => {
  const line: FakeSpecies[] = [{ id: 1 }, { id: 2, from: 1 }, { id: 3, from: 2 }];

  it('computes stage, isFinal and the links of a three-stage line', () => {
    const { pokemon } = build(line, [level(2), level(3)]);
    expect(entry(pokemon, 1).evolution).toMatchObject({
      stage: 1,
      isFinal: false,
      evolvesFromId: null,
      evolvesToIds: [2],
      branched: false,
    });
    expect(entry(pokemon, 2).evolution).toMatchObject({
      stage: 2,
      evolvesFromId: 1,
      evolvesToIds: [3],
    });
    expect(entry(pokemon, 3).evolution).toMatchObject({
      stage: 3,
      isFinal: true,
      evolvesToIds: [],
    });
  });

  it('gives a Pokémon without a line stage 1 and final', () => {
    const { pokemon } = build([{ id: 1 }]);
    expect(entry(pokemon, 1).evolution).toMatchObject({ stage: 1, isFinal: true, methods: [] });
  });

  it('flags a branched evolution and sorts the targets by id', () => {
    // The CSV lists the targets as 4, 2, 3: the output must not depend on that order.
    const { pokemon } = build(
      [{ id: 1 }, { id: 4, from: 1 }, { id: 2, from: 1 }, { id: 3, from: 1 }],
      [level(4), level(2), level(3)],
    );
    expect(entry(pokemon, 1).evolution).toMatchObject({ branched: true, evolvesToIds: [2, 3, 4] });
  });

  it('dates the evolution by the later generation of the pair', () => {
    const { pokemon } = build(
      [
        { id: 1, generation: 1 },
        { id: 2, generation: 4, from: 1 }, // Magneton → Magnezone
        { id: 3, generation: 1, from: 4 }, // Pikachu ← Pichu (a Gen 2 baby)
        { id: 4, generation: 2 },
      ],
      [level(2), level(3)],
    );
    expect(entry(pokemon, 2).evolution.evolutionAddedInGen).toBe(4);
    expect(entry(pokemon, 3).evolution.evolutionAddedInGen).toBe(2);
    expect(entry(pokemon, 1).evolution.evolutionAddedInGen).toBeNull();
  });

  it('refuses an evolution loop', () => {
    expect(() =>
      build(
        [
          { id: 1, from: 2 },
          { id: 2, from: 1 },
        ],
        [level(1), level(2)],
      ),
    ).toThrow(/loops or is too deep/);
  });
});

describe('evolution methods', () => {
  it.each([
    ['a level', { columns: { minimum_level: '16' } }, ['level']],
    [
      'a level with a gender and a time of day',
      { columns: { minimum_level: '20', gender_id: '1', time_of_day: 'night' } },
      ['level'],
    ],
    [
      'a level with a "false" flag',
      { columns: { minimum_level: '20', needs_overworld_rain: '0' } },
      ['level'],
    ],
    ['a stone', { trigger: 'use-item', columns: { trigger_item_id: '83' } }, ['stone']],
    ['Ice Stone', { trigger: 'use-item', columns: { trigger_item_id: '885' } }, ['stone']],
    ['Galarica Cuff', { trigger: 'use-item', columns: { trigger_item_id: '1633' } }, ['other']],
    ['a trade', { trigger: 'trade' }, ['trade']],
    ['a trade with a held item', { trigger: 'trade', columns: { held_item_id: '198' } }, ['trade']],
    ['friendship', { columns: { minimum_happiness: '220' } }, ['friendship']],
    [
      'friendship at a time of day',
      { columns: { minimum_happiness: '220', time_of_day: 'day' } },
      ['friendship'],
    ],
    ['a known move', { columns: { known_move_id: '246' } }, ['other']],
    ['a location', { columns: { location_id: '10' } }, ['other']],
    ['a held item at night', { columns: { held_item_id: '1', time_of_day: 'night' } }, ['other']],
    ['a party member', { columns: { party_species_id: '223' } }, ['other']],
    ['beauty', { columns: { minimum_beauty: '170' } }, ['other']],
    [
      'a level plus a known move',
      { columns: { minimum_level: '20', known_move_id: '1' } },
      ['other'],
    ],
    [
      'Attack = Defense (Tyrogue → Hitmontop)',
      { columns: { minimum_level: '20', relative_physical_stats: '0' } },
      ['level'],
    ],
    [
      'Attack > Defense (Tyrogue → Hitmonlee)',
      { columns: { minimum_level: '20', relative_physical_stats: '1' } },
      ['level'],
    ],
    ['a required flag', { columns: { minimum_level: '20', turn_upside_down: '1' } }, ['other']],
    ['shedding (Shedinja)', { trigger: 'shed' }, ['other']],
  ] satisfies [string, Omit<FakeEvolution, 'into'>, string[]][])(
    'classifies %s',
    (_name, evolution, expected) => {
      expect(methodsFor(evolution)).toEqual(expected);
    },
  );

  it('unions the methods of every in-scope evolution, in a fixed order', () => {
    // Like Eevee: stone, friendship and a location.
    const { pokemon } = build(
      [{ id: 1 }, { id: 2, from: 1 }, { id: 3, from: 1 }, { id: 4, from: 1 }],
      [
        { into: 2, columns: { minimum_happiness: '220' } },
        { into: 3, trigger: 'use-item' },
        { into: 4, columns: { location_id: '8' } },
      ],
    );
    expect(entry(pokemon, 1).evolution.methods).toEqual(['stone', 'friendship', 'other']);
  });

  it('merges the several rows of one evolution (Magneton: location and stone)', () => {
    const { pokemon } = build(
      [{ id: 1 }, { id: 2, from: 1 }],
      [
        { into: 2, columns: { location_id: '10' } },
        { into: 2, trigger: 'use-item' },
      ],
    );
    expect(entry(pokemon, 1).evolution.methods).toEqual(['stone', 'other']);
  });

  describe('regional variants', () => {
    it('ignores rows tied to a region (Alola, Galar, Hisui)', () => {
      const { pokemon } = build(
        [{ id: 1 }, { id: 2, from: 1 }],
        [level(2), { into: 2, trigger: 'use-item', columns: { region_id: '7' } }],
      );
      expect(entry(pokemon, 1).evolution.methods).toEqual(['level']);
    });

    // Like PokeAPI: a regional form is the DEFAULT form of its own `pokemon` (10102 = Alolan
    // Sandslash), so `pokemon_forms.is_default` alone cannot tell it from the real species.
    const addRegionalForm = (tables: ReturnType<typeof fakeTables>, speciesId: string) => {
      tables.pokemon.push({
        id: '10100',
        species_id: speciesId,
        height: '1',
        weight: '1',
        is_default: '0',
      });
      tables.pokemon_forms.push({
        id: '10100',
        pokemon_id: '10100',
        is_default: '1',
        is_mega: '0',
      });
    };

    it('ignores rows that evolve into a regional form, keeps those into the default one', () => {
      const tables = fakeTables(
        [{ id: 1 }, { id: 2, from: 1 }],
        [
          level(2),
          { into: 2, trigger: 'use-item', columns: { evolved_pokemon_form_id: '10100' } },
          { into: 2, trigger: 'trade', columns: { evolved_pokemon_form_id: '2' } },
        ],
      );
      addRegionalForm(tables, '2');
      const { pokemon } = buildPokedex(tables, buildOptions());
      expect(entry(pokemon, 1).evolution.methods).toEqual(['level', 'trade']);
    });

    it('also ignores rows that REQUIRE a regional form (Alolan Meowth → Alolan Persian)', () => {
      const tables = fakeTables(
        [{ id: 1 }, { id: 2, from: 1 }],
        [
          level(2),
          {
            into: 2,
            columns: { minimum_happiness: '160', required_pokemon_form_id: '10100' },
          },
        ],
      );
      addRegionalForm(tables, '1');
      const { pokemon } = buildPokedex(tables, buildOptions());
      expect(entry(pokemon, 1).evolution.methods).toEqual(['level']);
    });

    it('fails loudly when every row of an evolution is a variant', () => {
      expect(() =>
        build(
          [{ id: 1 }, { id: 2, from: 1 }],
          [{ into: 2, columns: { minimum_level: '16', region_id: '7' } }],
        ),
      ).toThrow(/species 2: .*no usable evolution row/);
    });
  });
});

describe('fields', () => {
  it('reads names, types, stats, abilities, size and flags from the default form', () => {
    const tables = fakeTables([
      { id: 1, slug: 'bulbasaur', types: ['grass', 'poison'], isBaby: true, isMythical: true },
    ]);
    tables.pokemon_abilities.push({ pokemon_id: '1', ability_id: '1', is_hidden: '1', slot: '3' });
    const { pokemon } = buildPokedex(tables, buildOptions());
    expect(pokemon[0]).toMatchObject({
      id: 1,
      slug: 'bulbasaur',
      nameFr: 'FR bulbasaur',
      nameEn: 'EN bulbasaur',
      generation: 1,
      types: ['grass', 'poison'],
      baseStats: {
        hp: 50,
        attack: 50,
        defense: 50,
        specialAttack: 50,
        specialDefense: 50,
        speed: 50,
      },
      abilities: [
        { slug: 'static', nameFr: 'Statik', isHidden: false },
        { slug: 'static', nameFr: 'Statik', isHidden: true },
      ],
      isBaby: true,
      isLegendary: false,
      isMythical: true,
      color: 'black',
      shape: 'ball',
      heightDm: 10,
      weightHg: 100,
    });
  });

  it('orders types by slot, whatever the row order', () => {
    const tables = fakeTables([{ id: 1, types: ['fire', 'flying'] }]);
    tables.pokemon_types.reverse();
    expect(buildPokedex(tables, buildOptions()).pokemon[0]?.types).toEqual(['fire', 'flying']);
  });

  it('only looks at the default form', () => {
    const tables = fakeTables([{ id: 1 }]);
    tables.pokemon.push({
      id: '10001',
      species_id: '1',
      height: '999',
      weight: '999',
      is_default: '0',
    });
    expect(buildPokedex(tables, buildOptions()).pokemon[0]?.heightDm).toBe(10);
  });
});

describe('data errors are loud', () => {
  it('rejects a species without a French name', () => {
    expect(() => build([{ id: 7, nameFr: null }])).toThrow(
      /species 7: missing French or English name/,
    );
  });

  it('rejects a type outside the 18 current ones', () => {
    expect(() => build([{ id: 7, types: ['shadow'] }])).toThrow(
      /species 7: type: "shadow" is not one of/,
    );
  });

  it('rejects a species with no default form', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.pokemon = [];
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/species 7: no default form/);
  });

  it('rejects a species with two default forms', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.pokemon.push({ id: '700', species_id: '7', height: '1', weight: '1', is_default: '1' });
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/two default forms/);
  });

  it('rejects an ability without a French name', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.ability_names = [];
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/ability 1 has no French name/);
  });

  it('rejects a missing base stat', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.pokemon_stats = tables.pokemon_stats.filter((r) => r['stat_id'] !== '6');
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/missing base stat "speed"/);
  });

  it('rejects an unknown colour', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.pokemon_colors = [{ id: '1', identifier: 'chartreuse' }];
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/color: "chartreuse"/);
  });

  it('checks the language ids against languages.csv', () => {
    const tables = fakeTables([{ id: 7 }]);
    tables.languages = [
      { id: '5', identifier: 'de' },
      { id: '9', identifier: 'en' },
    ];
    expect(() => buildPokedex(tables, buildOptions())).toThrow(/id 5 should be "fr"/);
  });
});

describe('manual lists', () => {
  const species: FakeSpecies[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('sets the flags and the aliases', () => {
    const { pokemon } = buildPokedex(
      fakeTables(species),
      buildOptions({
        manual: {
          starters: [1],
          fossils: [2],
          pseudoLegendaries: [3],
          mega: [1, 2],
          gmax: [3],
          popular: [],
          aliases: { 2: ['Deux', 'Two'] },
        },
      }),
    );
    expect(
      pokemon.map((p) => [p.isStarter, p.isFossil, p.isPseudoLegendary, p.hasMega, p.hasGmax]),
    ).toEqual([
      [true, false, false, true, false],
      [false, true, false, true, false],
      [false, false, true, false, true],
    ]);
    expect(pokemon.map((p) => p.aliases)).toEqual([[], ['Deux', 'Two'], []]);
  });

  it('rejects an id outside the scope instead of dropping it silently', () => {
    const manual = { ...emptyManual(), mega: [1, 99] };
    expect(() => buildPokedex(fakeTables(species), buildOptions({ manual }))).toThrow(
      /mega\.json lists ids outside Gen 1-4: 99/,
    );
  });

  it('rejects duplicate ids', () => {
    const manual = { ...emptyManual(), starters: [1, 1] };
    expect(() => buildPokedex(fakeTables(species), buildOptions({ manual }))).toThrow(
      /duplicate ids/,
    );
  });

  it('rejects an alias for an unknown id', () => {
    const manual = { ...emptyManual(), aliases: { 99: ['Nope'] } };
    expect(() => buildPokedex(fakeTables(species), buildOptions({ manual }))).toThrow(
      /aliases\.json/,
    );
  });

  it('rejects an alias that repeats an official name', () => {
    const manual = { ...emptyManual(), aliases: { 1: ['FR species-1'] } };
    expect(() => buildPokedex(fakeTables(species), buildOptions({ manual }))).toThrow(
      /alias repeats an official name/,
    );
  });
});

describe('overrides', () => {
  const species: FakeSpecies[] = [{ id: 1 }, { id: 2, from: 1 }];
  const tables = () => fakeTables(species, [level(2)]);

  it('replaces scalars and arrays, merges nested objects', () => {
    const { pokemon } = buildPokedex(
      tables(),
      buildOptions({
        overrides: [
          {
            id: 1,
            reason: 'test: fix the types and one stat',
            set: { types: ['fire'], baseStats: { hp: 99 }, nameFr: 'Corrigé' },
          },
        ],
      }),
    );
    expect(pokemon[0]).toMatchObject({
      nameFr: 'Corrigé',
      types: ['fire'],
      baseStats: { hp: 99, attack: 50 },
    });
    expect(pokemon[1]?.nameFr).toBe('FR species-2');
  });

  it('applies several overrides to the same Pokémon in order', () => {
    const { pokemon } = buildPokedex(
      tables(),
      buildOptions({
        overrides: [
          { id: 1, reason: 'test: first override', set: { heightDm: 5 } },
          { id: 1, reason: 'test: second override', set: { heightDm: 6, weightHg: 7 } },
        ],
      }),
    );
    expect(pokemon[0]).toMatchObject({ heightDm: 6, weightHg: 7 });
  });

  it('rejects an override for an unknown Pokémon', () => {
    expect(() =>
      buildPokedex(
        tables(),
        buildOptions({ overrides: [{ id: 99, reason: 'test: unknown id', set: {} }] }),
      ),
    ).toThrow(/no Pokémon with id 99/);
  });

  it('cannot smuggle invalid data past the schema', () => {
    const attempt = (set: Record<string, unknown>) =>
      buildPokedex(
        tables(),
        buildOptions({ overrides: [{ id: 1, reason: 'test: invalid value', set }] }),
      );
    expect(() => attempt({ types: ['nope'] })).toThrow(/does not match the schema/);
    expect(() => attempt({ unknownField: 1 })).toThrow(/does not match the schema/);
    expect(() => attempt({ evolution: { isFinal: true } })).toThrow(/invariant/);
  });
});

describe('determinism', () => {
  it('produces identical output from identical input, whatever the row order', () => {
    const species: FakeSpecies[] = [{ id: 1 }, { id: 2, from: 1 }, { id: 3, from: 1 }];
    const evolutions = [level(2), level(3)];
    const a = JSON.stringify(build(species, evolutions));
    const b = JSON.stringify(build([...species].reverse(), [...evolutions].reverse()));
    expect(b).toBe(a);
  });
});

describe('deepMerge', () => {
  it('merges plain objects recursively and replaces everything else', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, d: [1, 2] }, { a: { b: 9 }, d: [3] })).toEqual({
      a: { b: 9, c: 2 },
      d: [3],
    });
    expect(deepMerge({ a: 1 }, null)).toBeNull();
    expect(deepMerge([1], { a: 1 })).toEqual({ a: 1 });
  });
});
