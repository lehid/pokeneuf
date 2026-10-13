import type { Pokedex } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { buildPokedex } from './build';
import { crossCheckShowdown, parseShowdownPokedex } from './crosscheck';
import { buildOptions, fakeTables } from './test-fixtures';

interface Sample {
  key: string;
  num: number;
  name: string;
  types?: string;
  stats?: string;
  heightm?: number;
  weightkg?: number;
  color?: string;
  extra?: string[];
}

/** One entry in the exact layout of Showdown's `data/pokedex.ts` (tabs, one property per line). */
function entry(s: Sample): string {
  const lines = [
    `num: ${s.num},`,
    `name: ${JSON.stringify(s.name)},`,
    `types: ${s.types ?? '["Normal"]'},`,
    `baseStats: ${s.stats ?? '{ hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 }'},`,
    `abilities: { 0: "Static" },`,
    `heightm: ${s.heightm ?? 1},`,
    `weightkg: ${s.weightkg ?? 10},`,
    `color: ${JSON.stringify(s.color ?? 'Black')},`,
    ...(s.extra ?? []),
  ];
  return `\t${s.key}: {\n${lines.map((l) => `\t\t${l}`).join('\n')}\n\t},`;
}

const file = (...entries: string[]) =>
  `export const Pokedex: import('../sim/dex-species').SpeciesDataTable = {\n${entries.join('\n')}\n};\n`;

const pokedex = (): Pokedex =>
  buildPokedex(
    fakeTables(
      [{ id: 1, nameFr: 'Un' }, { id: 2, from: 1 }, { id: 3 }],
      [{ into: 2, columns: { minimum_level: '16' } }],
    ),
    buildOptions({
      manual: {
        starters: [],
        fossils: [],
        pseudoLegendaries: [],
        mega: [3],
        gmax: [3],
        popular: [],
        aliases: {},
      },
    }),
  );

/** Showdown data that agrees with `pokedex()`. */
const agreeing = () =>
  file(
    entry({ key: 'one', num: 1, name: 'One', extra: ['evos: ["Two"],'] }),
    entry({ key: 'two', num: 2, name: 'Two', extra: ['prevo: "One",', 'evoLevel: 16,'] }),
    entry({ key: 'three', num: 3, name: 'Three', extra: ['canGigantamax: "G-Max Test",'] }),
    entry({
      key: 'threemega',
      num: 3,
      name: 'Three-Mega',
      extra: ['baseSpecies: "Three",', 'forme: "Mega",'],
    }),
  );

describe('parseShowdownPokedex', () => {
  it('reads the fields we need, including forms and escaped characters', () => {
    const parsed = parseShowdownPokedex(
      file(
        entry({ key: 'farfetchd', num: 83, name: 'Farfetch’d', types: '["Normal", "Flying"]' }),
        entry({
          key: 'farfetchdgalar',
          num: 83,
          name: 'Farfetch’d-Galar',
          extra: ['baseSpecies: "Farfetch’d",', 'forme: "Galar",'],
        }),
      ),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      num: 83,
      name: 'Farfetch’d',
      types: ['Normal', 'Flying'],
      baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
      heightm: 1,
      weightkg: 10,
      color: 'Black',
      baseSpecies: null,
      forme: null,
    });
    expect(parsed[1]).toMatchObject({ baseSpecies: 'Farfetch’d', forme: 'Galar' });
  });

  it('decodes \\u escapes the way Showdown writes them', () => {
    const source = file(entry({ key: 'x', num: 5, name: 'X' })).replace(
      '"X"',
      '"Farfetch\\u2019d"',
    );
    expect(parseShowdownPokedex(source)[0]?.name).toBe('Farfetch’d');
  });

  it('ignores a property whose value is not on one line instead of failing', () => {
    const source = file(entry({ key: 'x', num: 5, name: 'X', extra: ['evos: ['] }));
    expect(parseShowdownPokedex(source)[0]?.evos).toEqual([]);
  });

  it('reads the tags and the evolution type', () => {
    const [parsed] = parseShowdownPokedex(
      file(
        entry({
          key: 'x',
          num: 5,
          name: 'X',
          extra: ['tags: ["Sub-Legendary", "Mythical"],', 'evoType: "useItem",'],
        }),
      ),
    );
    expect(parsed).toMatchObject({ tags: ['Sub-Legendary', 'Mythical'], evoType: 'useItem' });
  });

  it('returns nothing for text that is not a Pokédex', () => {
    expect(parseShowdownPokedex('export const nope = {};')).toEqual([]);
  });
});

describe('crossCheckShowdown', () => {
  it('is silent when both sources agree', () => {
    expect(crossCheckShowdown(pokedex(), agreeing())).toEqual([]);
  });

  it.each([
    [
      'types',
      (s: string) => s.replace('["Normal"]', '["Fire"]'),
      /#1 .*types \["normal"\] \(PokeAPI\) vs \["fire"\]/,
    ],
    [
      'a base stat',
      (s: string) => s.replace('hp: 50', 'hp: 51'),
      /#1 .*baseStats\.hp 50 \(PokeAPI\) vs 51/,
    ],
    [
      'the height',
      (s: string) => s.replace('heightm: 1,', 'heightm: 1.2,'),
      /#1 .*heightDm 10 \(PokeAPI\) vs 12/,
    ],
    [
      'the weight',
      (s: string) => s.replace('weightkg: 10,', 'weightkg: 9.5,'),
      /#1 .*weightHg 100 \(PokeAPI\) vs 95/,
    ],
    [
      'the colour',
      (s: string) => s.replace('"Black"', '"Blue"'),
      /#1 .*color "black" \(PokeAPI\) vs "blue"/,
    ],
    [
      'the evolution targets',
      (s: string) => s.replace('evos: ["Two"],', 'evos: [],'),
      /#1 .*evolvesToIds \[2\] \(PokeAPI\) vs \[\]/,
    ],
    [
      'the pre-evolution',
      (s: string) => s.replace('prevo: "One",', ''),
      /#2 .*evolvesFromId \[1\] \(PokeAPI\) vs \[\]/,
    ],
    [
      'a legendary flag',
      (s: string) => s.replace('evos: ["Two"],', 'evos: ["Two"],\n\t\ttags: ["Sub-Legendary"],'),
      /#1 .*isLegendary false \(PokeAPI\) vs true/,
    ],
    [
      'a mythical flag',
      (s: string) => s.replace('evos: ["Two"],', 'evos: ["Two"],\n\t\ttags: ["Mythical"],'),
      /#1 .*isMythical false \(PokeAPI\) vs true/,
    ],
    [
      'how the evolution happens',
      (s: string) => s.replace('evoLevel: 16,', 'evoType: "useItem",'),
      /#2 .*by "stone" but PokeAPI lists \["level"\] for #1/,
    ],
    [
      'a missing Mega',
      (s: string) => s.replace('forme: "Mega",', 'forme: "Primal",'),
      /#3 .*hasMega true \(PokeAPI\) vs false/,
    ],
    [
      'a missing Gigantamax',
      (s: string) => s.replace('canGigantamax: "G-Max Test",', ''),
      /#3 .*hasGmax true \(PokeAPI\) vs false/,
    ],
  ])('flags a difference in %s', (_name, mutate, expected) => {
    const problems = crossCheckShowdown(pokedex(), mutate(agreeing()));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(expected);
  });

  it('accepts extra methods on our side: Showdown lists only one way to evolve', () => {
    const richer = buildPokedex(
      fakeTables(
        [{ id: 1 }, { id: 2, from: 1 }, { id: 3 }],
        [
          { into: 2, columns: { minimum_level: '16' } },
          { into: 2, trigger: 'use-item' },
        ],
      ),
      buildOptions({
        manual: {
          starters: [],
          fossils: [],
          pseudoLegendaries: [],
          mega: [3],
          gmax: [3],
          popular: [],
          aliases: {},
        },
      }),
    );
    expect(richer.pokemon[0]?.evolution.methods).toEqual(['level', 'stone']);
    expect(crossCheckShowdown(richer, agreeing())).toEqual([]);
  });

  it('counts Restricted Legendary as legendary too', () => {
    const source = agreeing().replace(
      'evos: ["Two"],',
      'evos: ["Two"],\n\t\ttags: ["Restricted Legendary"],',
    );
    expect(crossCheckShowdown(pokedex(), source)).toEqual([
      expect.stringMatching(/#1 .*isLegendary false \(PokeAPI\) vs true/),
    ]);
  });

  it('flags a Pokémon Showdown does not know', () => {
    const source = file(entry({ key: 'one', num: 1, name: 'One', extra: ['evos: ["Two"],'] }));
    expect(crossCheckShowdown(pokedex(), source)).toContain('#2 species-2: not found in Showdown');
  });

  it('folds regional forms into their base species and ignores out-of-scope targets', () => {
    const source =
      agreeing().replace('evos: ["Two"],', 'evos: ["Two", "Two-Alola", "Beyond"],') +
      entry({
        key: 'twoalola',
        num: 2,
        name: 'Two-Alola',
        extra: ['baseSpecies: "Two",', 'forme: "Alola",'],
      }) +
      entry({ key: 'beyond', num: 900, name: 'Beyond' });
    expect(crossCheckShowdown(pokedex(), source)).toEqual([]);
  });
});
