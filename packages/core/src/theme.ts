import type { PokedexColor, PokemonType } from './pokedex';

/**
 * Visual identity without sprites (ROADMAP §2.5): types are shown through colours. The palette is the
 * usual community one. Every UI colour for a Pokémon or a category goes through this module.
 */
export const TYPE_COLORS: Readonly<Record<PokemonType, string>> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

export const TYPE_LABELS_FR: Readonly<Record<PokemonType, string>> = {
  normal: 'Normal',
  fire: 'Feu',
  water: 'Eau',
  electric: 'Électrik',
  grass: 'Plante',
  ice: 'Glace',
  fighting: 'Combat',
  poison: 'Poison',
  ground: 'Sol',
  flying: 'Vol',
  psychic: 'Psy',
  bug: 'Insecte',
  rock: 'Roche',
  ghost: 'Spectre',
  dragon: 'Dragon',
  dark: 'Ténèbres',
  steel: 'Acier',
  fairy: 'Fée',
};

/** Swatch next to a Pokédex-colour category ("Pokémon rouge"). Not the same shades as the types. */
export const POKEDEX_COLOR_SWATCHES: Readonly<Record<PokedexColor, string>> = {
  black: '#2B2B2B',
  blue: '#3B6FD4',
  brown: '#8B5A2B',
  gray: '#8E8E93',
  green: '#3FA34D',
  pink: '#F28CB1',
  purple: '#8A4FC7',
  red: '#D6342C',
  white: '#F2F2F2',
  yellow: '#F2C94C',
};

export const BLACK = '#000000';
export const WHITE = '#FFFFFF';

/** WCAG AA for normal text. */
export const WCAG_AA = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

function channels(hex: string): [number, number, number] {
  const match = HEX.exec(hex);
  if (!match?.[1]) throw new Error(`Expected a #RRGGBB colour, got "${hex}"`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Black or white text, whichever reads better on `background`. With several colours (a gradient),
 * the choice maximises the WORST contrast over all of them.
 * On a single colour the result always meets WCAG AA (4.5): the better of black and white never
 * drops below about 4.58.
 */
export function readableTextColor(background: string | readonly string[]): '#000000' | '#FFFFFF' {
  const colors = typeof background === 'string' ? [background] : background;
  const worst = (text: string) => Math.min(...colors.map((color) => contrastRatio(text, color)));
  return worst(BLACK) >= worst(WHITE) ? BLACK : WHITE;
}

/** Colours of a Pokémon's types, primary first. */
export function typeColors(types: readonly PokemonType[]): string[] {
  return types.map((type) => TYPE_COLORS[type]);
}

/**
 * Background of a filled cell: a flat colour for one type, a diagonal gradient for two.
 * (CSS value, to be used as `background`.)
 */
export function cellBackground(types: readonly PokemonType[]): string {
  const [first, second] = typeColors(types);
  if (first === undefined) throw new Error('A Pokémon has at least one type');
  return second === undefined ? first : `linear-gradient(135deg, ${first} 0%, ${second} 100%)`;
}

/** Colour of the text on `cellBackground(types)`. */
export function cellTextColor(types: readonly PokemonType[]): '#000000' | '#FFFFFF' {
  return readableTextColor(typeColors(types));
}

/**
 * Worst contrast of the text over the cell. Below `WCAG_AA` (possible for some two-type gradients,
 * e.g. a light and a dark colour) the UI must put the text on a plate instead of on the gradient.
 */
export function cellTextContrast(types: readonly PokemonType[]): number {
  const text = cellTextColor(types);
  return Math.min(...typeColors(types).map((color) => contrastRatio(text, color)));
}
