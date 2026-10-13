/**
 * Shape of a Pokédex entry (`packages/data/dist/pokedex.json`). Built by `packages/data`, consumed by
 * the category engine, the generator and the web app. Pure types: no runtime dependency.
 */

/** The 18 current types (Fairy included). Identifiers are PokeAPI slugs, not display labels. */
export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

/** Pokédex colours (PokeAPI `pokemon_colors`). */
export const POKEDEX_COLORS = [
  'black',
  'blue',
  'brown',
  'gray',
  'green',
  'pink',
  'purple',
  'red',
  'white',
  'yellow',
] as const;
export type PokedexColor = (typeof POKEDEX_COLORS)[number];

/** Pokédex body shapes (PokeAPI `pokemon_shapes`). */
export const POKEDEX_SHAPES = [
  'ball',
  'squiggle',
  'fish',
  'arms',
  'blob',
  'upright',
  'legs',
  'quadruped',
  'wings',
  'tentacles',
  'heads',
  'humanoid',
  'bug-wings',
  'armor',
] as const;
export type PokedexShape = (typeof POKEDEX_SHAPES)[number];

/**
 * How a Pokémon evolves:
 * - `level`: reaches a level, possibly gated by something intrinsic (gender, time of day,
 *   personality, Attack vs Defense for Tyrogue);
 * - `stone`: an evolution stone is used on it;
 * - `trade`: it is traded (with or without a held item);
 * - `friendship`: it levels up with high friendship;
 * - `other`: any condition external to the Pokémon (known move, location, held item, party member,
 *   beauty, shed…).
 */
export const EVOLUTION_METHODS = ['level', 'stone', 'trade', 'friendship', 'other'] as const;
export type EvolutionMethod = (typeof EVOLUTION_METHODS)[number];

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonAbility {
  /** PokeAPI slug, e.g. `lightning-rod`. */
  slug: string;
  nameFr: string;
  /** Hidden ability (introduced in Gen 5, current for every Pokémon). */
  isHidden: boolean;
}

/**
 * Evolution data, always RELATIVE TO THE SCOPE (`MAX_GEN`): evolutions to or from a species outside
 * the scope are ignored, so `stage`, `isFinal` and `branched` are computed after that filter.
 */
export interface Evolution {
  /** 1-based position in the in-scope line (a baby is stage 1). Pokémon that do not evolve: 1. */
  stage: number;
  /** Does not evolve into any in-scope Pokémon. A Pokémon without a line is both stage 1 and final. */
  isFinal: boolean;
  evolvesFromId: number | null;
  /** Sorted by id. */
  evolvesToIds: number[];
  /**
   * How THIS Pokémon evolves (union over its in-scope evolutions, sorted, empty when final).
   * Regional-form-only evolutions (Alola, Galar, Hisui…) are not counted. Current games are the
   * reference, so e.g. Magneton lists both `other` (location) and `stone` (Thunder Stone).
   */
  methods: EvolutionMethod[];
  /** Evolves into more than one in-scope Pokémon (Eevee, Tyrogue, Wurmple…). */
  branched: boolean;
  /**
   * Generation in which the evolution INTO this Pokémon was introduced, i.e. the later generation
   * of the pair (this, evolvesFrom): Magnezone → 4, Pikachu → 2 (Pichu). `null` without pre-evolution.
   */
  evolutionAddedInGen: number | null;
}

export interface Pokemon {
  /** National Pokédex number. */
  id: number;
  /** PokeAPI identifier, URL-safe and unique. */
  slug: string;
  nameFr: string;
  nameEn: string;
  /** Extra spellings accepted by the search (from `data/manual/aliases.json`). */
  aliases: string[];
  generation: number;
  /** Current types, slot order (primary first). One or two entries. */
  types: PokemonType[];
  baseStats: BaseStats;
  /** Regular abilities first (by slot), then the hidden one. */
  abilities: PokemonAbility[];
  evolution: Evolution;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  /** Any member of a Gen 1–4 starter line (manual list). */
  isStarter: boolean;
  isFossil: boolean;
  isPseudoLegendary: boolean;
  color: PokedexColor;
  shape: PokedexShape;
  /** Height in decimetres. */
  heightDm: number;
  /** Weight in hectograms. */
  weightHg: number;
  /**
   * Estimated popularity in [0, 1] (ROADMAP §3.5): how likely a player is to think of this Pokémon
   * first. A prior built by the data pipeline from generation, status and `popular.json`; the
   * rarity of an answer is its rank by `pop` inside a cell.
   */
  pop: number;
  hasMega: boolean;
  hasGmax: boolean;
}

export interface PokedexMeta {
  /** Bump when the shape of the file changes. */
  schemaVersion: number;
  source: string;
  sourceSha: string;
  maxGen: number;
  count: number;
}

/** Content of `dist/pokedex.json`. */
export interface Pokedex {
  meta: PokedexMeta;
  pokemon: Pokemon[];
}
