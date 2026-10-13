import type { BaseStats, Evolution, Pokemon } from './pokedex';

type Overrides = Partial<Omit<Pokemon, 'evolution' | 'baseStats'>> & {
  evolution?: Partial<Evolution>;
  baseStats?: Partial<BaseStats>;
};

/** A valid Pokémon with neutral defaults; override only what a test is about. */
export function pokemon(overrides: Overrides = {}): Pokemon {
  const { evolution, baseStats, ...rest } = overrides;
  return {
    id: 1,
    slug: 'test',
    nameFr: 'Test',
    nameEn: 'Test',
    aliases: [],
    generation: 1,
    types: ['normal'],
    baseStats: {
      hp: 50,
      attack: 50,
      defense: 50,
      specialAttack: 50,
      specialDefense: 50,
      speed: 50,
      ...baseStats,
    },
    abilities: [{ slug: 'static', nameFr: 'Statik', isHidden: false }],
    evolution: {
      stage: 1,
      isFinal: true,
      evolvesFromId: null,
      evolvesToIds: [],
      methods: [],
      branched: false,
      evolutionAddedInGen: null,
      ...evolution,
    },
    isBaby: false,
    isLegendary: false,
    isMythical: false,
    isStarter: false,
    isFossil: false,
    isPseudoLegendary: false,
    color: 'black',
    shape: 'ball',
    heightDm: 10,
    weightHg: 100,
    hasMega: false,
    hasGmax: false,
    ...rest,
  };
}
