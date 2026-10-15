import type { Pokemon } from './pokedex';

/**
 * Canonical form used to compare names and queries: no accents, lower case, `♀`/`♂` as `f`/`m`,
 * apostrophes removed (straight or typographic), dashes and dots as spaces, spaces collapsed.
 *
 *   "Électhor" → "electhor"   "Farfetch’d" → "farfetchd"   "Nidoran♀" → "nidoranf"
 *   "M. Mime" → "m mime"      "Ho-Oh" → "ho oh"
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/['’‘`´ʼ]/g, '')
    .replace(/[-‐‑–—_.·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A national number as players write it, on the normalized query (where `no.` has become `no `):
 * `25`, `025`, `0025`, `#025`, `n°25`, `nº 25`, `no 25`, `n25`.
 */
const NATIONAL_NUMBER = /^(?:#|n[°º]?|no)?\s*0*(\d{1,3})$/;

export interface SearchOptions {
  /**
   * Language shown to the player. Both languages are always searched; on equal match quality the
   * Pokémon matched through the preferred language comes first. Default `fr`.
   */
  lang?: 'fr' | 'en';
  /** Maximum number of results. Default: all. */
  limit?: number;
}

export type Searcher = (query: string, options?: SearchOptions) => Pokemon[];

interface IndexedName {
  lang: 'fr' | 'en' | 'alias';
  /** `normalize(name)`. */
  text: string;
  /** Same without spaces: "ho oh" and "hooh" both match "Ho-Oh". */
  compact: string;
}

interface IndexedPokemon {
  pokemon: Pokemon;
  names: IndexedName[];
}

/** Match quality, best first. */
const EXACT = 0;
const PREFIX = 1;
const SUBSTRING = 2;

interface Match {
  rank: number;
  foreign: number;
  length: number;
}

/** Lexicographic: better rank, then preferred language, then shorter name. */
function isBetter(a: Match, b: Match): boolean {
  return (a.rank - b.rank || a.foreign - b.foreign || a.length - b.length) < 0;
}

function rankName(name: IndexedName, query: string, compactQuery: string): number | null {
  if (name.text === query || name.compact === compactQuery) return EXACT;
  if (name.text.startsWith(query) || name.compact.startsWith(compactQuery)) return PREFIX;
  if (name.text.includes(query) || name.compact.includes(compactQuery)) return SUBSTRING;
  return null;
}

/**
 * Builds a search over French names, English names, aliases and national numbers.
 * Order: exact, then prefix, then substring; then the preferred language; then shorter names
 * (closer to what was typed); then national number. An all-digit query ("145", "#025") is a number.
 */
export function createSearch(pokemon: readonly Pokemon[]): Searcher {
  const index: IndexedPokemon[] = pokemon.map((p) => {
    const raw: [IndexedName['lang'], string][] = [
      ['fr', p.nameFr],
      ['en', p.nameEn],
      ...p.aliases.map((alias): [IndexedName['lang'], string] => ['alias', alias]),
    ];
    return {
      pokemon: p,
      names: raw.map(([lang, name]) => {
        const text = normalize(name);
        return { lang, text, compact: text.replace(/ /g, '') };
      }),
    };
  });

  return (query, options = {}) => {
    const q = normalize(query);
    if (q === '') return [];
    const limit = options.limit ?? Infinity;

    const number = NATIONAL_NUMBER.exec(q);
    if (number?.[1] !== undefined) {
      const id = Number(number[1]);
      return index.filter((entry) => entry.pokemon.id === id).map((entry) => entry.pokemon);
    }

    const compactQuery = q.replace(/ /g, '');
    const preferred = options.lang ?? 'fr';
    const ranked: (Match & { pokemon: Pokemon })[] = [];

    for (const entry of index) {
      let best: Match | null = null;
      for (const name of entry.names) {
        const rank = rankName(name, q, compactQuery);
        if (rank === null) continue;
        const candidate = {
          rank,
          // aliases count as the preferred language: they are extra spellings of the same name
          foreign: name.lang === 'alias' || name.lang === preferred ? 0 : 1,
          length: name.compact.length,
        };
        if (best === null || isBetter(candidate, best)) best = candidate;
      }
      if (best) ranked.push({ pokemon: entry.pokemon, ...best });
    }

    ranked.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.foreign - b.foreign ||
        a.length - b.length ||
        a.pokemon.id - b.pokemon.id,
    );
    return ranked.slice(0, limit).map((r) => r.pokemon);
  };
}

/** One-shot convenience; build a `createSearch` once when searching repeatedly (autocomplete). */
export function search(
  pokemon: readonly Pokemon[],
  query: string,
  options?: SearchOptions,
): Pokemon[] {
  return createSearch(pokemon)(query, options);
}
