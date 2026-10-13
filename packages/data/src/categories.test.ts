import { readFile } from 'node:fs/promises';
import { CATEGORIES, getCategory, type Memberships, type Pokedex } from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { CATEGORY_FACTS, CELL_FACTS } from './category-facts';
import { MEMBERSHIPS_PATH } from './config';
import { runPipeline } from './pipeline';
import { loadArtifact, loadShippedMemberships } from './test-artifact';

let pokedex: Pokedex;
let engine: Memberships;

beforeAll(async () => {
  pokedex = await loadArtifact();
  ({ engine } = await loadShippedMemberships());
}, 120_000);

const name = (id: number) => pokedex.pokemon.find((p) => p.id === id)?.nameFr ?? `#${id}`;

describe('category facts (hand-written)', () => {
  it('cover every category, with at least 3 members and 3 non-members each', () => {
    expect(Object.keys(CATEGORY_FACTS).sort()).toEqual(CATEGORIES.map((c) => c.id).sort());
    for (const [id, fact] of Object.entries(CATEGORY_FACTS)) {
      expect(fact.in.length, `${id} members`).toBeGreaterThanOrEqual(3);
      expect(fact.out.length, `${id} non-members`).toBeGreaterThanOrEqual(3);
      expect(
        fact.in.filter((n) => fact.out.includes(n)),
        id,
      ).toEqual([]);
    }
  });

  describe.each(Object.entries(CATEGORY_FACTS))('%s', (id, fact) => {
    it.each(fact.in.map((n) => [n] as const))('#%i is a member', (n) => {
      expect(engine.has(id, n), `${name(n)} (#${n}) in ${id}`).toBe(true);
    });
    it.each(fact.out.map((n) => [n] as const))('#%i is not a member', (n) => {
      expect(engine.has(id, n), `${name(n)} (#${n}) in ${id}`).toBe(false);
    });
  });
});

describe('cells', () => {
  it.each(CELL_FACTS)('$row × $col has exactly the known answers', ({ row, col, answers }) => {
    const found = engine.answersFor(row, col);
    expect(found.map(name), `${row} × ${col}`).toEqual(answers.map(name));
    expect(found).toEqual(answers);
    for (const n of answers) expect(engine.isValid(n, row, col)).toBe(true);
  });

  it('accepts a Pokémon only if it satisfies both the row and the column', () => {
    expect(engine.isValid(25, 'type-electric', 'gen-1')).toBe(true);
    expect(engine.isValid(25, 'type-electric', 'gen-2')).toBe(false); // Pikachu is Gen 1
    expect(engine.isValid(172, 'type-electric', 'gen-2')).toBe(true); // Pichu is Gen 2
    expect(engine.isValid(25, 'type-fire', 'gen-1')).toBe(false);
    expect(engine.isValid(448, 'type-fighting', 'type-steel')).toBe(true);
    expect(engine.isValid(145, 'status-legendary', 'type-electric')).toBe(true);
    expect(engine.isValid(145, 'status-mythical', 'type-electric')).toBe(false);
  });
});

describe('shipped memberships.json', () => {
  it('agrees with the predicates on every Pokémon and every category', () => {
    for (const category of CATEGORIES) {
      for (const p of pokedex.pokemon) {
        expect(engine.has(category, p.id), `${category.id} #${p.id}`).toBe(category.predicate(p));
      }
    }
  });

  it('is reproducible and small', async () => {
    const fresh = await runPipeline({ write: false });
    const onDisk = await readFile(MEMBERSHIPS_PATH, 'utf8');
    expect(fresh.membershipsJson).toBe(onDisk);
    expect(Buffer.byteLength(onDisk)).toBeLessThan(20 * 1024);
  });

  it('covers exactly the categories of the registry', () => {
    expect(engine.count).toBe(493);
    expect(() => engine.has('nope', 1)).toThrow();
    expect(() => getCategory('nope')).toThrow();
  });
});

/** Categories outside the 20-200 range that are NOT `bonus`, and why. Anything else must fit. */
const SIZE_EXCEPTIONS: Record<string, string> = {
  'type-ghost': 'only 18 Ghost Pokémon in Gen 1-4; types are the heart of the game',
  'type-dragon': 'only 19 Dragon Pokémon in Gen 1-4; types are the heart of the game',
  'type-mono':
    'half of all Pokémon (ROADMAP §2.2 asks for it); crossed with a small category it is fine',
  'type-dual': 'the other half; same reasoning',
};

describe('sizes', () => {
  const sizes = () => Object.fromEntries(CATEGORIES.map((c) => [c.id, engine.size(c)]));

  it('are as expected (snapshot: a change here is a change of the game)', () => {
    expect(sizes()).toMatchInlineSnapshot(`
      {
        "color-blue": 95,
        "color-brown": 79,
        "color-green": 53,
        "color-purple": 52,
        "color-red": 46,
        "color-yellow": 48,
        "evo-baby": 18,
        "evo-base": 170,
        "evo-final": 187,
        "evo-friendship": 14,
        "evo-gen4": 62,
        "evo-middle": 59,
        "evo-none": 77,
        "evo-stage-3": 62,
        "evo-stone": 29,
        "evo-trade": 17,
        "form-gmax": 12,
        "form-mega": 57,
        "gen-1": 151,
        "gen-2": 100,
        "gen-3": 135,
        "gen-4": 107,
        "name-double-letter": 86,
        "name-ends-a": 45,
        "name-has-ch": 35,
        "name-has-k": 70,
        "name-has-ou": 42,
        "name-has-x": 24,
        "name-has-y": 51,
        "name-has-z": 19,
        "name-long": 66,
        "name-same-ends": 18,
        "name-short": 34,
        "name-starts-c": 57,
        "name-starts-vowel": 62,
        "shape-quadruped": 92,
        "shape-upright": 108,
        "shape-wings": 42,
        "size-height-2m": 48,
        "size-height-50cm": 108,
        "size-weight-100kg": 77,
        "stat-attack-100": 100,
        "stat-speed-100": 63,
        "stat-total-300": 93,
        "stat-total-500": 122,
        "status-fossil": 13,
        "status-legendary": 26,
        "status-mythical": 9,
        "status-pseudo": 5,
        "status-starter": 36,
        "type-bug": 45,
        "type-dark": 23,
        "type-dragon": 19,
        "type-dual": 235,
        "type-electric": 28,
        "type-fairy": 20,
        "type-fighting": 25,
        "type-fire": 33,
        "type-flying": 64,
        "type-ghost": 18,
        "type-grass": 55,
        "type-ground": 47,
        "type-ice": 22,
        "type-mono": 258,
        "type-normal": 72,
        "type-poison": 50,
        "type-psychic": 53,
        "type-rock": 37,
        "type-steel": 25,
        "type-water": 92,
      }
    `);
  });

  it('keep every regular category between 20 and 200 members, bar the documented exceptions', () => {
    for (const category of CATEGORIES.filter((c) => !c.bonus)) {
      const size = engine.size(category);
      const fits = size >= 20 && size <= 200;
      if (category.id in SIZE_EXCEPTIONS) {
        expect(
          fits,
          `${category.id} is listed as an exception but fits: remove it from the list`,
        ).toBe(false);
      } else {
        expect(fits, `${category.id} has ${size} members`).toBe(true);
      }
    }
  });

  it('only mark as bonus the categories that really are rare (under 20)', () => {
    const bonus = CATEGORIES.filter((c) => c.bonus);
    expect(bonus.map((c) => c.id).sort()).toEqual([
      'evo-baby',
      'evo-friendship',
      'evo-trade',
      'form-gmax',
      'name-has-z',
      'name-same-ends',
      'status-fossil',
      'status-mythical',
      'status-pseudo',
    ]);
    for (const category of bonus) expect(engine.size(category), category.id).toBeLessThan(20);
  });
});
