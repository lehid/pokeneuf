import { MAX_GEN } from './config';
import {
  POKEMON_TYPES,
  type PokedexColor,
  type PokedexShape,
  type Pokemon,
  type PokemonType,
} from './pokedex';
import { normalize } from './search';
import { POKEDEX_COLOR_SWATCHES, TYPE_COLORS, TYPE_LABELS_FR } from './theme';

/**
 * Families of categories. The generator mixes families (ROADMAP §3.4) and never crosses a category
 * with another one of a family listed in its `exclusiveWith`.
 * Finer than the ROADMAP table on purpose: colour, shape and size are separate families so that
 * "red × quadruped × 2 m" can exist while "red × blue" cannot.
 */
export const CATEGORY_FAMILIES = [
  'type',
  'generation',
  'evolution',
  'status',
  'form',
  'stats',
  'color',
  'shape',
  'size',
  'name',
] as const;
export type CategoryFamily = (typeof CATEGORY_FAMILIES)[number];

export interface Category {
  /** Stable, kebab-case, prefixed by its family (`type-fire`, `stat-speed-100`). Never reused. */
  id: string;
  family: CategoryFamily;
  label: { fr: string; en: string };
  /** Shown to the player on click: what exactly counts (ROADMAP §1.6, "interprétations"). */
  definition: { fr: string };
  predicate: (pokemon: Pokemon) => boolean;
  /** Families this category is never crossed with (often its own: two generations never meet). */
  exclusiveWith: readonly CategoryFamily[];
  /**
   * Rare by nature (fewer than ~20 members): exempt from the size floor, drawn with a low weight.
   */
  bonus: boolean;
  /** Type categories: drives the header colour (`TYPE_COLORS`). */
  type?: PokemonType;
  /** Pokédex colour categories: drives the swatch (`POKEDEX_COLOR_SWATCHES`). */
  color?: PokedexColor;
}

const IN_GAME = `parmi les Pokémon du jeu (Gén 1 à ${MAX_GEN})`;

export function statTotal(p: Pokemon): number {
  const s = p.baseStats;
  return s.hp + s.attack + s.defense + s.specialAttack + s.specialDefense + s.speed;
}

/** Letters only: "M. Mime" has 5, "Nidoran♀" has 7. */
export function letterCount(name: string): number {
  return (name.match(/\p{L}/gu) ?? []).length;
}

/** Lower case, accents removed, everything else (spaces, dashes, dots) kept: "Ho-Oh" → "ho-oh". */
function folded(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Only the letters of a name, folded: "M. Mime" → "mmime", "Nidoran♀" → "nidoran". */
function lettersOf(name: string): string {
  return folded(name).replace(/[^\p{L}]/gu, '');
}

const TYPE_EN: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Fire',
  water: 'Water',
  electric: 'Electric',
  grass: 'Grass',
  ice: 'Ice',
  fighting: 'Fighting',
  poison: 'Poison',
  ground: 'Ground',
  flying: 'Flying',
  psychic: 'Psychic',
  bug: 'Bug',
  rock: 'Rock',
  ghost: 'Ghost',
  dragon: 'Dragon',
  dark: 'Dark',
  steel: 'Steel',
  fairy: 'Fairy',
};

const typeCategories: Category[] = POKEMON_TYPES.map((type) => ({
  id: `type-${type}`,
  family: 'type',
  label: { fr: `Type ${TYPE_LABELS_FR[type]}`, en: `${TYPE_EN[type]} type` },
  definition: {
    fr: `Pokémon dont l'un des types est ${TYPE_LABELS_FR[type]}. Types actuels des jeux récents (type Fée inclus).`,
  },
  predicate: (p) => p.types.includes(type),
  exclusiveWith: [],
  bonus: false,
  type,
}));

const typeCountCategories: Category[] = [
  {
    id: 'type-mono',
    family: 'type',
    label: { fr: 'Monotype', en: 'Single type' },
    definition: { fr: "Pokémon qui n'a qu'un seul type (types actuels, type Fée inclus)." },
    predicate: (p) => p.types.length === 1,
    exclusiveWith: [],
    bonus: false,
  },
  {
    id: 'type-dual',
    family: 'type',
    label: { fr: 'Double type', en: 'Dual type' },
    definition: { fr: 'Pokémon qui a deux types (types actuels, type Fée inclus).' },
    predicate: (p) => p.types.length === 2,
    exclusiveWith: [],
    bonus: false,
  },
];

const GENERATIONS: [number, string, string][] = [
  [1, 'Kanto', 'n° 1 à 151'],
  [2, 'Johto', 'n° 152 à 251'],
  [3, 'Hoenn', 'n° 252 à 386'],
  [4, 'Sinnoh', 'n° 387 à 493'],
];

const generationCategories: Category[] = GENERATIONS.map(([generation, region, range]) => ({
  id: `gen-${generation}`,
  family: 'generation',
  label: { fr: `Gén ${generation} (${region})`, en: `Gen ${generation} (${region})` },
  definition: {
    fr: `Pokémon introduit en génération ${generation} (${region}, ${range} du Pokédex national).`,
  },
  predicate: (p) => p.generation === generation,
  exclusiveWith: ['generation'],
  bonus: false,
}));

const evolutionCategories: Category[] = [
  {
    id: 'evo-base',
    family: 'evolution',
    label: { fr: 'Stade de base', en: 'Basic stage' },
    definition: {
      fr: `Premier stade d'une famille d'évolution de deux stades ou plus, ${IN_GAME}. Un bébé est un stade de base.`,
    },
    predicate: (p) => p.evolution.stage === 1 && !p.evolution.isFinal,
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-middle',
    family: 'evolution',
    label: { fr: 'Stade intermédiaire', en: 'Middle stage' },
    definition: {
      fr: `Pokémon qui a une pré-évolution et qui évolue encore, ${IN_GAME}.`,
    },
    predicate: (p) => p.evolution.stage >= 2 && !p.evolution.isFinal,
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-final',
    family: 'evolution',
    label: { fr: 'Stade final', en: 'Final stage' },
    definition: {
      fr: `Dernier stade d'une famille d'évolution de deux stades ou plus, ${IN_GAME}. Un Pokémon qui n'évolue en aucun Pokémon du jeu est au stade final, même s'il évolue dans un jeu plus récent (Colossinge). Les Pokémon sans évolution ne sont pas concernés : voir « N'évolue pas ».`,
    },
    predicate: (p) => p.evolution.stage >= 2 && p.evolution.isFinal,
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-none',
    family: 'evolution',
    label: { fr: "N'évolue pas", en: 'Does not evolve' },
    definition: {
      fr: `Pokémon sans pré-évolution ni évolution, ${IN_GAME} (Métamorph, Canarticho…).`,
    },
    predicate: (p) => p.evolution.stage === 1 && p.evolution.isFinal,
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-stage-3',
    family: 'evolution',
    label: { fr: 'Troisième stade', en: 'Third stage' },
    definition: {
      fr: `Pokémon qui est au troisième stade de sa famille d'évolution (Dracaufeu, Tortank, Raichu…), ${IN_GAME}. Un bébé compte pour un stade : Raichu est au troisième stade (Pichu, Pikachu, Raichu).`,
    },
    predicate: (p) => p.evolution.stage === 3,
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-stone',
    family: 'evolution',
    label: { fr: 'Évolue par pierre', en: 'Evolves with a stone' },
    definition: {
      fr: `Pokémon qui évolue grâce à une pierre d'évolution dans les jeux actuels, ${IN_GAME}.`,
    },
    predicate: (p) => p.evolution.methods.includes('stone'),
    exclusiveWith: ['evolution'],
    bonus: false,
  },
  {
    id: 'evo-trade',
    family: 'evolution',
    label: { fr: 'Évolue par échange', en: 'Evolves by trade' },
    definition: {
      fr: `Pokémon qui évolue lorsqu'il est échangé, avec ou sans objet tenu, ${IN_GAME}.`,
    },
    predicate: (p) => p.evolution.methods.includes('trade'),
    exclusiveWith: ['evolution'],
    bonus: true,
  },
  {
    id: 'evo-friendship',
    family: 'evolution',
    label: { fr: 'Évolue par amitié', en: 'Evolves with friendship' },
    definition: {
      fr: `Pokémon qui évolue en montant de niveau avec un fort niveau d'amitié, ${IN_GAME}.`,
    },
    predicate: (p) => p.evolution.methods.includes('friendship'),
    exclusiveWith: ['evolution'],
    bonus: true,
  },
  {
    id: 'evo-baby',
    family: 'evolution',
    label: { fr: 'Bébé', en: 'Baby' },
    definition: { fr: 'Pokémon bébé : Pichu, Togepi, Riolu, Ptiravi…' },
    predicate: (p) => p.isBaby,
    exclusiveWith: ['evolution'],
    bonus: true,
  },
  {
    id: 'evo-gen4',
    family: 'evolution',
    label: { fr: 'Évolution introduite en Gén 4', en: 'Evolution added in Gen 4' },
    definition: {
      fr: `Pokémon dont le lien d'évolution avec sa pré-évolution est apparu en génération 4 : Magnézone, Togekiss, Lucario… (${IN_GAME}). Compte aussi les Pokémon plus anciens qui ont reçu un bébé en Gén 4 (Ronflex avec Goinfrex).`,
    },
    predicate: (p) => p.evolution.evolutionAddedInGen === 4,
    exclusiveWith: ['evolution', 'generation'],
    bonus: false,
  },
];

const statusCategories: Category[] = [
  {
    id: 'status-legendary',
    family: 'status',
    label: { fr: 'Légendaire', en: 'Legendary' },
    definition: {
      fr: 'Pokémon légendaire : oiseaux, bêtes, Regis, Latias et Latios, Kyogre, Groudon, Rayquaza, Créhelf et ses deux frères, Dialga, Palkia, Heatran, Regigigas, Giratina, Cresselia, Mewtwo, Lugia, Ho-Oh. Les Pokémon fabuleux ont leur propre catégorie.',
    },
    predicate: (p) => p.isLegendary,
    exclusiveWith: ['status'],
    bonus: false,
  },
  {
    id: 'status-mythical',
    family: 'status',
    label: { fr: 'Fabuleux', en: 'Mythical' },
    definition: {
      fr: 'Pokémon fabuleux : Mew, Celebi, Jirachi, Deoxys, Phione, Manaphy, Darkrai, Shaymin, Arceus.',
    },
    predicate: (p) => p.isMythical,
    exclusiveWith: ['status'],
    bonus: true,
  },
  {
    id: 'status-starter',
    family: 'status',
    label: { fr: 'Starter', en: 'Starter' },
    definition: {
      fr: "Pokémon de départ de Kanto, Johto, Hoenn ou Sinnoh, et toute leur lignée d'évolution (Dracaufeu est un starter).",
    },
    predicate: (p) => p.isStarter,
    exclusiveWith: ['status'],
    bonus: false,
  },
  {
    id: 'status-fossil',
    family: 'status',
    label: { fr: 'Fossile', en: 'Fossil' },
    definition: {
      fr: "Pokémon ressuscité à partir d'un fossile, avec ses évolutions : Amonita, Kabuto, Ptéra, Lilia, Anorith, Kranidos, Dinoclier.",
    },
    predicate: (p) => p.isFossil,
    exclusiveWith: ['status'],
    bonus: true,
  },
  {
    id: 'status-pseudo',
    family: 'status',
    label: { fr: 'Pseudo-légendaire', en: 'Pseudo-legendary' },
    definition: {
      fr: 'Lignée de trois stades à 600 points de stats de base : Dracolosse, Tyranocif, Drattak, Métalosse, Carchacrok.',
    },
    predicate: (p) => p.isPseudoLegendary,
    exclusiveWith: ['status'],
    bonus: true,
  },
];

const formCategories: Category[] = [
  {
    id: 'form-mega',
    family: 'form',
    label: { fr: 'A une Méga-évolution', en: 'Has a Mega Evolution' },
    definition: {
      fr: 'Pokémon qui possède au moins une Méga-évolution dans les jeux actuels, y compris celles de Légendes Pokémon : Z-A. Les Méga-évolutions ne sont pas des entrées à part.',
    },
    predicate: (p) => p.hasMega,
    exclusiveWith: ['form'],
    bonus: false,
  },
  {
    id: 'form-gmax',
    family: 'form',
    label: { fr: 'A une forme Gigamax', en: 'Has a Gigantamax form' },
    definition: {
      fr: 'Pokémon qui possède une forme Gigamax (Épée et Bouclier) : Florizarre, Dracaufeu, Tortank, Papilusion, Pikachu, Miaouss, Mackogneur, Ectoplasma, Krabboss, Lokhlass, Évoli, Ronflex.',
    },
    predicate: (p) => p.hasGmax,
    exclusiveWith: ['form'],
    bonus: true,
  },
];

interface StatSpec {
  id: string;
  fr: string;
  en: string;
  definition: string;
  predicate: (p: Pokemon) => boolean;
}

const STATS: StatSpec[] = [
  {
    id: 'stat-total-500',
    fr: 'Total de stats ≥ 500',
    en: 'Base stat total ≥ 500',
    definition:
      'Somme des six stats de base (PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse) supérieure ou égale à 500.',
    predicate: (p) => statTotal(p) >= 500,
  },
  {
    id: 'stat-total-300',
    fr: 'Total de stats ≤ 300',
    en: 'Base stat total ≤ 300',
    definition:
      'Somme des six stats de base (PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse) inférieure ou égale à 300.',
    predicate: (p) => statTotal(p) <= 300,
  },
  {
    id: 'stat-attack-100',
    fr: 'Attaque ≥ 100',
    en: 'Attack ≥ 100',
    definition: 'Stat de base Attaque supérieure ou égale à 100.',
    predicate: (p) => p.baseStats.attack >= 100,
  },
  {
    id: 'stat-speed-100',
    fr: 'Vitesse ≥ 100',
    en: 'Speed ≥ 100',
    definition: 'Stat de base Vitesse supérieure ou égale à 100.',
    predicate: (p) => p.baseStats.speed >= 100,
  },
];

const statCategories: Category[] = STATS.map((stat) => ({
  id: stat.id,
  family: 'stats',
  label: { fr: stat.fr, en: stat.en },
  definition: { fr: stat.definition },
  predicate: stat.predicate,
  exclusiveWith: [],
  bonus: false,
}));

const COLORS: [PokedexColor, string, string][] = [
  ['red', 'rouge', 'red'],
  ['blue', 'bleu', 'blue'],
  ['green', 'vert', 'green'],
  ['yellow', 'jaune', 'yellow'],
  ['purple', 'violet', 'purple'],
  ['brown', 'marron', 'brown'],
];

const colorCategories: Category[] = COLORS.map(([color, fr, en]) => ({
  id: `color-${color}`,
  family: 'color',
  label: { fr: `Pokémon ${fr}`, en: `${en[0]?.toUpperCase() ?? ''}${en.slice(1)} Pokémon` },
  definition: { fr: `Pokémon dont la couleur dans le Pokédex est « ${fr} ».` },
  predicate: (p) => p.color === color,
  exclusiveWith: ['color'],
  bonus: false,
  color,
}));

const SHAPES: [PokedexShape, string, string, string][] = [
  ['quadruped', 'quadrupède', 'Quadruped', 'sur quatre pattes'],
  ['wings', 'ailée', 'Winged', 'avec des ailes'],
  ['upright', 'bipède', 'Upright', 'debout sur deux pattes'],
];

const shapeCategories: Category[] = SHAPES.map(([shape, fr, en, detail]) => ({
  id: `shape-${shape}`,
  family: 'shape',
  label: { fr: `Forme ${fr}`, en: `${en} shape` },
  definition: {
    fr: `Pokémon dont la silhouette dans le Pokédex est « ${fr} » (${detail}).`,
  },
  predicate: (p) => p.shape === shape,
  exclusiveWith: ['shape'],
  bonus: false,
}));

const sizeCategories: Category[] = [
  {
    id: 'size-height-2m',
    family: 'size',
    label: { fr: 'Taille ≥ 2 m', en: 'Height ≥ 2 m' },
    definition: { fr: 'Pokémon mesurant 2 mètres ou plus.' },
    predicate: (p) => p.heightDm >= 20,
    exclusiveWith: ['size'],
    bonus: false,
  },
  {
    id: 'size-height-50cm',
    family: 'size',
    label: { fr: 'Petit (50 cm ou moins)', en: 'Small (50 cm or less)' },
    definition: { fr: 'Pokémon mesurant 50 centimètres ou moins.' },
    predicate: (p) => p.heightDm <= 5,
    exclusiveWith: ['size'],
    bonus: false,
  },
];

const FR_ONLY = 'Dépend de la langue : nom français uniquement.';

interface NameSpec {
  id: string;
  fr: string;
  en: string;
  definition: string;
  predicate: (name: string) => boolean;
  bonus?: boolean;
}

const VOWELS = /^[aeiou]/;
const containsLetter = (letter: string) => (name: string) => lettersOf(name).includes(letter);

const NAME_SPECS: NameSpec[] = [
  {
    id: 'name-starts-vowel',
    fr: 'Nom commençant par une voyelle',
    en: 'Name starts with a vowel',
    definition: `Pokémon dont le nom français commence par A, E, I, O ou U (accents ignorés ; le Y ne compte pas comme une voyelle). ${FR_ONLY}`,
    predicate: (name) => VOWELS.test(lettersOf(name)),
  },
  {
    id: 'name-ends-a',
    fr: 'Nom finissant par A',
    en: 'Name ends with A',
    definition: `Pokémon dont le nom français finit par la lettre A (Rattata, Otaria, Rayquaza…). ${FR_ONLY}`,
    predicate: (name) => lettersOf(name).endsWith('a'),
  },
  {
    id: 'name-long',
    fr: 'Nom de 10 lettres ou plus',
    en: 'Name of 10 letters or more',
    definition: `Pokémon dont le nom français compte 10 lettres ou plus (on ne compte que les lettres, pas les espaces, points ou tirets). ${FR_ONLY}`,
    predicate: (name) => letterCount(name) >= 10,
  },
  {
    id: 'name-has-k',
    fr: 'Nom contenant un K',
    en: 'Name contains a K',
    definition: `Pokémon dont le nom français contient la lettre K. ${FR_ONLY}`,
    predicate: containsLetter('k'),
  },
  {
    id: 'name-has-y',
    fr: 'Nom contenant un Y',
    en: 'Name contains a Y',
    definition: `Pokémon dont le nom français contient la lettre Y. ${FR_ONLY}`,
    predicate: containsLetter('y'),
  },
  {
    id: 'name-has-x',
    fr: 'Nom contenant un X',
    en: 'Name contains an X',
    definition: `Pokémon dont le nom français contient la lettre X. ${FR_ONLY}`,
    predicate: containsLetter('x'),
  },
  {
    id: 'name-has-z',
    fr: 'Nom contenant un Z',
    en: 'Name contains a Z',
    definition: `Pokémon dont le nom français contient la lettre Z. ${FR_ONLY}`,
    predicate: containsLetter('z'),
    bonus: true,
  },
  {
    id: 'name-has-ou',
    fr: 'Nom contenant « OU »',
    en: 'Name contains "OU"',
    definition: `Pokémon dont le nom français contient les deux lettres O et U l'une après l'autre (il s'agit des lettres écrites, pas du son). ${FR_ONLY}`,
    predicate: (name) => folded(name).includes('ou'),
  },
  {
    id: 'name-has-ch',
    fr: 'Nom contenant « CH »',
    en: 'Name contains "CH"',
    definition: `Pokémon dont le nom français contient les deux lettres C et H l'une après l'autre (il s'agit des lettres écrites, pas du son). ${FR_ONLY}`,
    predicate: (name) => folded(name).includes('ch'),
  },
  {
    id: 'name-double-letter',
    fr: 'Nom avec une lettre double',
    en: 'Name with a double letter',
    definition: `Pokémon dont le nom français contient deux fois la même lettre de suite, comme dans Bulbizarre ou Tentacool. Un espace, un point ou un tiret les sépare : « Ho-Oh » n'en a pas. ${FR_ONLY}`,
    predicate: (name) => /(\p{L})\1/u.test(folded(name)),
  },
  {
    id: 'name-same-ends',
    fr: 'Nom commençant et finissant par la même lettre',
    en: 'Name starts and ends with the same letter',
    definition: `Pokémon dont le nom français commence et finit par la même lettre (accents ignorés), comme Abra, Staross ou Nidoran. ${FR_ONLY}`,
    predicate: (name) => {
      const letters = lettersOf(name);
      return letters.length > 1 && letters[0] === letters.at(-1);
    },
    bonus: true,
  },
];

const nameCategories: Category[] = [
  {
    id: 'name-starts-c',
    family: 'name',
    label: { fr: 'Nom commençant par C', en: 'Name starts with C' },
    definition: {
      fr: `Pokémon dont le nom français commence par la lettre C (les accents sont ignorés). ${FR_ONLY}`,
    },
    predicate: (p) => normalize(p.nameFr).startsWith('c'),
    exclusiveWith: ['name'],
    bonus: false,
  },
  {
    id: 'name-short',
    family: 'name',
    label: { fr: 'Nom de 5 lettres ou moins', en: 'Name of 5 letters or fewer' },
    definition: {
      fr: `Pokémon dont le nom français compte 5 lettres ou moins (on ne compte que les lettres : « M. Mime » en a 5). ${FR_ONLY}`,
    },
    predicate: (p) => letterCount(p.nameFr) <= 5,
    exclusiveWith: ['name'],
    bonus: false,
  },
  ...NAME_SPECS.map((spec): Category => ({
    id: spec.id,
    family: 'name',
    label: { fr: spec.fr, en: spec.en },
    definition: { fr: spec.definition },
    predicate: (p) => spec.predicate(p.nameFr),
    exclusiveWith: ['name'],
    bonus: spec.bonus ?? false,
  })),
];

export const CATEGORIES: readonly Category[] = [
  ...typeCategories,
  ...typeCountCategories,
  ...generationCategories,
  ...evolutionCategories,
  ...statusCategories,
  ...formCategories,
  ...statCategories,
  ...colorCategories,
  ...shapeCategories,
  ...sizeCategories,
  ...nameCategories,
];

const BY_ID: ReadonlyMap<string, Category> = new Map(CATEGORIES.map((c) => [c.id, c]));

/** A category, or its id. */
export type CategoryRef = Category | string;

export function getCategory(ref: CategoryRef): Category {
  const category = typeof ref === 'string' ? BY_ID.get(ref) : BY_ID.get(ref.id);
  if (!category) throw new Error(`Unknown category: ${typeof ref === 'string' ? ref : ref.id}`);
  return category;
}

/** Can these two categories be the row and the column of the same cell? */
export function canCrossCategories(a: Category, b: Category): boolean {
  return (
    a.id !== b.id && !a.exclusiveWith.includes(b.family) && !b.exclusiveWith.includes(a.family)
  );
}

/** Same, by registry id. */
export function canCross(a: CategoryRef, b: CategoryRef): boolean {
  return canCrossCategories(getCategory(a), getCategory(b));
}

/**
 * Accent colour of a category header: the type colour, or the swatch of a Pokédex colour;
 * `null` for every other family (they get their own picto instead).
 */
export function categoryAccent(category: Category): string | null {
  if (category.type !== undefined) return TYPE_COLORS[category.type];
  if (category.color !== undefined) return POKEDEX_COLOR_SWATCHES[category.color];
  return null;
}
