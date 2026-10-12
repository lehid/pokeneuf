/** Display name of the site. Rename the whole app by changing this single constant. */
export const APP_NAME = 'PokéNeuf';

/** Prefix for every localStorage key. Bump the version on any breaking schema change. */
export const STORAGE_PREFIX = 'pokeneuf:v1:';

/** Highest Pokémon generation included in the game (Gen 1–4 = national dex #1–#493). */
export const MAX_GEN = 4;

/** Every grid date is computed in this time zone. */
export const GRID_TIME_ZONE = 'Europe/Paris';

/** Date of grid #1 (YYYY-MM-DD, Paris time). Adjust before launch. */
export const LAUNCH_DATE = '2026-11-01';

/** Max wrong guesses per game. */
export const MAX_ERRORS = 3;

/** Max score per game. */
export const MAX_SCORE = 900;
