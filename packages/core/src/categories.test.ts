import { describe, expect, it } from 'vitest';
import {
  canCross,
  CATEGORIES,
  CATEGORY_FAMILIES,
  getCategory,
  letterCount,
  statTotal,
  type CategoryFamily,
} from './categories';
import { MAX_GEN } from './config';
import { POKEDEX_COLORS, POKEMON_TYPES } from './pokedex';
import { pokemon } from './test-fixtures';

const PREFIX: Record<CategoryFamily, string> = {
  type: 'type-',
  generation: 'gen-',
  evolution: 'evo-',
  status: 'status-',
  form: 'form-',
  stats: 'stat-',
  color: 'color-',
  shape: 'shape-',
  size: 'size-',
  ability: 'ability-',
  name: 'name-',
};

describe('registry', () => {
  it('has roughly 45-60 categories (ROADMAP §2.2: about 40-50)', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(40);
    expect(CATEGORIES.length).toBeLessThanOrEqual(65);
  });

  it('has unique, kebab-case ids, prefixed by their family', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES) {
      expect(c.id, c.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(c.id.startsWith(PREFIX[c.family]), c.id).toBe(true);
    }
  });

  it('covers every family', () => {
    for (const family of CATEGORY_FAMILIES) {
      expect(CATEGORIES.filter((c) => c.family === family).length, family).toBeGreaterThan(0);
    }
  });

  it('gives each category a French and an English label, and a French definition', () => {
    for (const c of CATEGORIES) {
      expect(c.label.fr.trim(), c.id).not.toBe('');
      expect(c.label.en.trim(), c.id).not.toBe('');
      expect(c.definition.fr.trim().length, c.id).toBeGreaterThan(20);
    }
    const labels = CATEGORIES.map((c) => c.label.fr);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('only excludes real families', () => {
    for (const c of CATEGORIES) {
      for (const family of c.exclusiveWith) expect(CATEGORY_FAMILIES, c.id).toContain(family);
    }
  });

  it('spells out the scope in the definition of every evolution category but "baby"', () => {
    const scope = `parmi les Pokémon du jeu (Gén 1 à ${MAX_GEN})`;
    for (const c of CATEGORIES.filter((c) => c.family === 'evolution' && c.id !== 'evo-baby')) {
      expect(c.definition.fr, c.id).toContain(scope);
    }
  });

  it('has one category per type, carrying that type', () => {
    const typed = CATEGORIES.filter((c) => c.type !== undefined);
    expect(typed.map((c) => c.type).sort()).toEqual([...POKEMON_TYPES].sort());
    for (const c of typed) expect(c.id).toBe(`type-${c.type}`);
  });

  it('ties colour categories to a Pokédex colour', () => {
    const colored = CATEGORIES.filter((c) => c.family === 'color');
    expect(colored.length).toBeGreaterThan(0);
    for (const c of colored) {
      expect(POKEDEX_COLORS).toContain(c.color);
      expect(c.id).toBe(`color-${c.color}`);
    }
  });

  it('keeps generation categories exclusive with each other', () => {
    const gens = CATEGORIES.filter((c) => c.family === 'generation');
    expect(gens.map((c) => c.id)).toEqual(['gen-1', 'gen-2', 'gen-3', 'gen-4']);
    for (const c of gens) expect(c.exclusiveWith).toContain('generation');
  });
});

describe('getCategory / canCross', () => {
  it('finds a category by id or by itself, and refuses unknown ones', () => {
    const fire = getCategory('type-fire');
    expect(fire.label.fr).toBe('Type Feu');
    expect(getCategory(fire)).toBe(fire);
    expect(() => getCategory('type-sound')).toThrow(/Unknown category: type-sound/);
  });

  it('never crosses two generations, nor a category with itself', () => {
    expect(canCross('gen-1', 'gen-2')).toBe(false);
    expect(canCross('type-fire', 'type-fire')).toBe(false);
  });

  it('crosses categories of different families, and types with each other', () => {
    expect(canCross('gen-1', 'type-fire')).toBe(true);
    expect(canCross('type-fire', 'type-flying')).toBe(true);
    expect(canCross('status-starter', 'color-red')).toBe(true);
  });

  it('keeps the exclusions symmetric', () => {
    for (const a of CATEGORIES)
      for (const b of CATEGORIES) expect(canCross(a, b)).toBe(canCross(b, a));
  });

  it('does not cross an evolution added in Gen 4 with a generation or another evolution category', () => {
    expect(canCross('evo-gen4', 'gen-4')).toBe(false);
    expect(canCross('evo-gen4', 'gen-1')).toBe(false);
    expect(canCross('evo-gen4', 'evo-stone')).toBe(false);
    expect(canCross('evo-gen4', 'type-steel')).toBe(true);
  });
});

describe('predicates', () => {
  const holds = (id: string, p = pokemon()) => getCategory(id).predicate(p);

  it('splits the Pokémon into exactly one of base / middle / final / no-evolution', () => {
    const ids = ['evo-base', 'evo-middle', 'evo-final', 'evo-none'];
    for (const stage of [1, 2, 3]) {
      for (const isFinal of [true, false]) {
        if (stage === 3 && !isFinal) continue; // impossible in Gen 1-4
        const p = pokemon({ evolution: { stage, isFinal } });
        expect(
          ids.filter((id) => holds(id, p)),
          `stage ${stage} final ${isFinal}`,
        ).toHaveLength(1);
      }
    }
  });

  it('places each stage where the definitions say', () => {
    expect(holds('evo-base', pokemon({ evolution: { stage: 1, isFinal: false } }))).toBe(true);
    expect(holds('evo-middle', pokemon({ evolution: { stage: 2, isFinal: false } }))).toBe(true);
    expect(holds('evo-final', pokemon({ evolution: { stage: 3, isFinal: true } }))).toBe(true);
    expect(holds('evo-final', pokemon({ evolution: { stage: 2, isFinal: true } }))).toBe(true);
    expect(holds('evo-none', pokemon({ evolution: { stage: 1, isFinal: true } }))).toBe(true);
    expect(holds('evo-final', pokemon({ evolution: { stage: 1, isFinal: true } }))).toBe(false);
  });

  it('reads the evolution methods', () => {
    const p = pokemon({ evolution: { isFinal: false, methods: ['stone', 'other'] } });
    expect(holds('evo-stone', p)).toBe(true);
    expect(holds('evo-trade', p)).toBe(false);
    expect(holds('evo-friendship', p)).toBe(false);
  });

  it('dates an evolution by the generation it was added in', () => {
    expect(holds('evo-gen4', pokemon({ evolution: { evolutionAddedInGen: 4 } }))).toBe(true);
    expect(holds('evo-gen4', pokemon({ evolution: { evolutionAddedInGen: 2 } }))).toBe(false);
    expect(holds('evo-gen4', pokemon())).toBe(false);
  });

  it('counts one or two types', () => {
    expect(holds('type-mono', pokemon({ types: ['fire'] }))).toBe(true);
    expect(holds('type-dual', pokemon({ types: ['fire'] }))).toBe(false);
    expect(holds('type-mono', pokemon({ types: ['fire', 'flying'] }))).toBe(false);
    expect(holds('type-dual', pokemon({ types: ['fire', 'flying'] }))).toBe(true);
    expect(holds('type-flying', pokemon({ types: ['fire', 'flying'] }))).toBe(true);
    expect(holds('type-water', pokemon({ types: ['fire', 'flying'] }))).toBe(false);
  });

  it('applies the stat thresholds inclusively', () => {
    const total = (t: number) => pokemon({ baseStats: { hp: t - 250 } }); // 5 other stats at 50
    expect(statTotal(total(500))).toBe(500);
    expect(holds('stat-total-500', total(500))).toBe(true);
    expect(holds('stat-total-500', total(499))).toBe(false);
    expect(holds('stat-total-300', total(300))).toBe(true);
    expect(holds('stat-total-300', total(301))).toBe(false);
    expect(holds('stat-hp-50', pokemon({ baseStats: { hp: 50 } }))).toBe(true);
    expect(holds('stat-hp-50', pokemon({ baseStats: { hp: 51 } }))).toBe(false);
    expect(holds('stat-attack-100', pokemon({ baseStats: { attack: 100 } }))).toBe(true);
    expect(holds('stat-attack-100', pokemon({ baseStats: { attack: 99 } }))).toBe(false);
    expect(holds('stat-speed-100', pokemon({ baseStats: { speed: 100 } }))).toBe(true);
    expect(holds('stat-speed-100', pokemon({ baseStats: { speed: 99 } }))).toBe(false);
  });

  it('applies the size thresholds inclusively (decimetres and hectograms)', () => {
    expect(holds('size-height-2m', pokemon({ heightDm: 20 }))).toBe(true);
    expect(holds('size-height-2m', pokemon({ heightDm: 19 }))).toBe(false);
    expect(holds('size-weight-100kg', pokemon({ weightHg: 1000 }))).toBe(true);
    expect(holds('size-weight-100kg', pokemon({ weightHg: 999 }))).toBe(false);
  });

  it('counts hidden abilities too', () => {
    const hidden = pokemon({
      abilities: [{ slug: 'levitate', nameFr: 'Lévitation', isHidden: true }],
    });
    expect(holds('ability-levitate', hidden)).toBe(true);
    expect(holds('ability-intimidate', hidden)).toBe(false);
  });

  it('ignores accents in the first letter of the name', () => {
    expect(holds('name-starts-c', pokemon({ nameFr: 'Carapuce' }))).toBe(true);
    expect(holds('name-starts-c', pokemon({ nameFr: 'Çedille' }))).toBe(true);
    expect(holds('name-starts-c', pokemon({ nameFr: 'Évoli' }))).toBe(false);
    expect(holds('name-starts-c', pokemon({ nameFr: 'Sulfura' }))).toBe(false);
  });

  it('counts letters only in the length of a name', () => {
    expect(letterCount('M. Mime')).toBe(5);
    expect(letterCount('Ho-Oh')).toBe(4);
    expect(letterCount('Nidoran♀')).toBe(7);
    expect(holds('name-short', pokemon({ nameFr: 'M. Mime' }))).toBe(true);
    expect(holds('name-short', pokemon({ nameFr: 'Mew' }))).toBe(true);
    expect(holds('name-short', pokemon({ nameFr: 'Pikachu' }))).toBe(false);
    expect(holds('name-short', pokemon({ nameFr: 'Nidoran♀' }))).toBe(false);
  });

  it('reads the flags, the colour and the shape', () => {
    expect(holds('status-legendary', pokemon({ isLegendary: true }))).toBe(true);
    expect(holds('status-mythical', pokemon({ isLegendary: true }))).toBe(false);
    expect(holds('form-mega', pokemon({ hasMega: true }))).toBe(true);
    expect(holds('form-gmax', pokemon({ hasMega: true }))).toBe(false);
    expect(holds('color-red', pokemon({ color: 'red' }))).toBe(true);
    expect(holds('color-blue', pokemon({ color: 'red' }))).toBe(false);
    expect(holds('shape-wings', pokemon({ shape: 'wings' }))).toBe(true);
    expect(holds('gen-3', pokemon({ generation: 3 }))).toBe(true);
    expect(holds('gen-2', pokemon({ generation: 3 }))).toBe(false);
  });
});
