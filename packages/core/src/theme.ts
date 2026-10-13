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

/**
 * Home-made type pictograms (ROADMAP §2.5: no official icons): one filled glyph per type, drawn on a
 * 24×24 grid, to be rendered with `fill-rule="evenodd"` in a single colour.
 */
export const TYPE_ICON_PATHS: Readonly<Record<PokemonType, string>> = {
  normal:
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z M6.8 12a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0Z',
  fire: 'M12 2c1 4.2 6.5 6.5 6.5 12.2a6.5 6.5 0 0 1-13 0c0-3.2 1.6-5 3.2-6.7.2 2.2 1 3.4 2.2 4C10.2 8.6 10.6 5 12 2Z',
  water: 'M12 2.5C9.5 6 5 10.5 5 14.8a7 7 0 0 0 14 0C19 10.5 14.5 6 12 2.5Z',
  electric: 'M13.8 2 5.5 13.4h5.6L9.6 22l9-11.8h-5.7L13.8 2Z',
  grass:
    'M20.5 3.5C10.5 3.5 4 8.5 4 15.2c0 1.7.5 3.2 1.4 4.3C6.4 14.4 10 11 15 9.4c-3.4 2.4-6 5.8-7.2 10.4.9.2 1.9.2 2.9.2 6.4 0 9.8-6.2 9.8-16.5Z',
  ice: 'M12 1.5 L14.4 7.84 L21.09 6.75 L16.8 12 L21.09 17.25 L14.4 16.16 L12 22.5 L9.6 16.16 L2.91 17.25 L7.2 12 L2.91 6.75 L9.6 7.84 Z M13.91 13.1 L12 14.2 L10.09 13.1 L10.09 10.9 L12 9.8 L13.91 10.9 Z',
  fighting:
    'M6.5 10.5V8a1.8 1.8 0 0 1 3.6-.4 1.8 1.8 0 0 1 3.4-.2 1.8 1.8 0 0 1 3.2.2 1.8 1.8 0 0 1 3.3.5v8.4a5 5 0 0 1-5 5h-3.5a5 5 0 0 1-5-5v-1.3L5 13.2a1.6 1.6 0 0 1 2.2-2.2l-.7-.5Z',
  poison:
    'M4.2 14.2a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0 -11.2 0Z M14 8.2a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0Z M5 5.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0Z',
  ground: 'M1.8 20.5 9.2 6.8l4 6.4 2.3-3.4 6.7 10.7Z',
  flying: 'M2 7.5c4.2-.3 7.6 1.9 10 7 2.4-5.1 5.8-7.3 10-7-.8 6.7-4 11.5-10 11.5S2.8 14.2 2 7.5Z',
  psychic:
    'M2 12C4.8 7.2 8.2 5.2 12 5.2S19.2 7.2 22 12c-2.8 4.8-6.2 6.8-10 6.8S4.8 16.8 2 12Z M7.8 12a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0Z M10.1 12a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0Z',
  bug: 'M12 7.2c3 0 5 2.6 5 6s-2 7-5 7-5-3.6-5-7 2-6 5-6Z M9.8 4.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0Z M10.6 3.2 7.6 1.2l-.7 1 3 2Z M13.4 3.2l3-2 .7 1-3 2Z M4 12l3.2.8-.3 1.2L3.7 13.200Z M20 12l-3.2.8.3 1.2 3.2-.8Z M4.3 17l3.1-1.3.5 1.1-3.1 1.300Z M19.7 17l-3.1-1.3-.5 1.1 3.1 1.300Z',
  rock: 'M8 3h8l5.2 6.2L12 21.5 2.8 9.200Z M8.6 9.2 12 17l3.4-7.800Z',
  ghost:
    'M12 2.5c-4.4 0-7.5 3.2-7.5 7.600V21.500l2.5-2.1 2.5 2.1 2.5-2.1 2.5 2.1 2.5-2.1 2.5 2.100V10.100c0-4.4-3.1-7.6-7.5-7.600Z M7.3 10.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0Z M13.3 10.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0Z',
  dragon:
    'M4 3C8 6 10 12 8.5 21C7 14 5.5 8.5 4 3Z M9 3C13 6 15 12 13.5 21C12 14 10.5 8.5 9 3Z M14 3C18 6 20 12 18.5 21C17 14 15.5 8.5 14 3Z',
  dark: 'M20.2 14.800A9 9 0 1 1 9.4 3.800a7.2 7.2 0 0 0 10.8 11Z',
  steel:
    'M18.81 10.37 L22.41 10.6 L22.41 13.4 L18.81 13.63 L17.97 15.66 L20.35 18.37 L18.37 20.35 L15.66 17.97 L13.63 18.81 L13.4 22.41 L10.6 22.41 L10.37 18.81 L8.34 17.97 L5.63 20.35 L3.65 18.37 L6.03 15.66 L5.19 13.63 L1.59 13.4 L1.59 10.6 L5.19 10.37 L6.03 8.34 L3.65 5.63 L5.63 3.65 L8.34 6.03 L10.37 5.19 L10.6 1.59 L13.4 1.59 L13.63 5.19 L15.66 6.03 L18.37 3.65 L20.35 5.63 L17.97 8.34 Z M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z',
  fairy:
    'M12 1.800c.9 5.6 4.6 9.3 10.2 10.2-5.6.9-9.3 4.6-10.2 10.2-.9-5.6-4.6-9.3-10.2-10.200C7.4 11.1 11.1 7.4 12 1.800Z',
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
