import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POKEAPI_REPO = 'PokeAPI/pokeapi';

/**
 * Pinned PokeAPI commit: the build is reproducible because the CSVs never change under us.
 * Bump it deliberately, then run `pnpm data:build`, read the report and the failing golden facts.
 */
export const PINNED_SHA = 'c80757193bd0889054e36f4209762360bdaa4b95';

export const CSV_BASE_URL = `https://raw.githubusercontent.com/${POKEAPI_REPO}/${PINNED_SHA}/data/v2/csv`;

/** The only CSVs the pipeline reads (all under `data/v2/csv/`). */
export const CSV_FILES = [
  'abilities',
  'ability_names',
  'evolution_triggers',
  'languages',
  'pokemon',
  'pokemon_abilities',
  'pokemon_colors',
  'pokemon_evolution',
  'pokemon_forms',
  'pokemon_shapes',
  'pokemon_species',
  'pokemon_species_names',
  'pokemon_stats',
  'pokemon_types',
  'stats',
  'types',
] as const;
export type CsvName = (typeof CSV_FILES)[number];

/**
 * Pinned Pokémon Showdown commit, used only to cross-check PokeAPI (`pnpm --filter @pokeneuf/data
 * crosscheck`, and a test): types, base stats, size, colour, evolutions, Mega and Gigantamax forms.
 */
export const SHOWDOWN_REPO = 'smogon/pokemon-showdown';
export const SHOWDOWN_SHA = '942cda71d14bf0618bd57991708a2e2734b6daba';
export const SHOWDOWN_POKEDEX_URL = `https://raw.githubusercontent.com/${SHOWDOWN_REPO}/${SHOWDOWN_SHA}/data/pokedex.ts`;

/** PokeAPI `languages.id`. Checked against `languages.csv` at build time. */
export const LANGUAGE_IDS = { fr: 5, en: 9 } as const;

/** Version of the `dist/pokedex.json` layout (`PokedexMeta.schemaVersion`). */
export const SCHEMA_VERSION = 1;

export const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CACHE_DIR = path.join(PACKAGE_ROOT, '.cache', 'pokeapi', PINNED_SHA);
export const SHOWDOWN_CACHE_FILE = path.join(
  PACKAGE_ROOT,
  '.cache',
  'showdown',
  SHOWDOWN_SHA,
  'pokedex.ts',
);
export const DIST_DIR = path.join(PACKAGE_ROOT, 'dist');
export const POKEDEX_PATH = path.join(DIST_DIR, 'pokedex.json');
export const MEMBERSHIPS_PATH = path.join(DIST_DIR, 'memberships.json');
export const MANUAL_DIR = path.join(PACKAGE_ROOT, 'data', 'manual');
export const OVERRIDES_PATH = path.join(PACKAGE_ROOT, 'data', 'overrides.json');
