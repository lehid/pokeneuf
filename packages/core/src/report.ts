import { CATEGORIES } from './categories';
import { ISSUES_URL } from './config';
import { GRID_SIZE } from './grid';

/**
 * "Report an error" link: a pre-filled GitHub issue form (`.github/ISSUE_TEMPLATE/erreur-donnee.yml`).
 * Opening the link sends nothing anywhere: the player reads the form on GitHub and decides whether
 * to submit it. The URL only ever carries what the page itself shows (grid number and date, the
 * categories of a cell, a Pokémon name): no storage content, no player id, no user agent.
 */

/** `other`: a generic report (from the FAQ), nothing specific to pre-fill. */
export type ReportKind = 'answer' | 'definition' | 'grid' | 'other';

export interface ReportContext {
  kind: ReportKind;
  gridId?: number;
  /** Grid date, `YYYY-MM-DD`. */
  gridDate?: string;
  /** 0-based row and column of the cell. */
  row?: number;
  col?: number;
  /** The category concerned (definition reports). */
  categoryId?: string;
  /** Categories of the row and the column of the cell, when known (their names make the report readable). */
  rowCategoryId?: string;
  colCategoryId?: string;
  pokemonId?: number;
  pokemonName?: string;
}

/** File name of the issue form in `.github/ISSUE_TEMPLATE/`. */
export const REPORT_TEMPLATE = 'erreur-donnee.yml';

/** Label put on the issue by the form itself. */
export const REPORT_LABEL = 'data-error';

/**
 * Ids of the fields of the issue form. They are the URL parameter names GitHub reads to pre-fill
 * the form: never rename one without renaming it in the YAML (a test compares the two).
 */
export const REPORT_FIELDS = {
  kind: 'kind',
  grid: 'grid',
  location: 'location',
  pokemon: 'pokemon',
  problem: 'problem',
  expected: 'expected',
  proof: 'proof',
} as const;

/**
 * Options of the `kind` dropdown, word for word as in the YAML (GitHub pre-selects the option
 * whose text equals the parameter; a test compares them with the YAML).
 */
export const REPORT_KIND_OPTIONS: Readonly<Record<ReportKind, string>> = {
  answer: 'Une réponse (Pokémon accepté ou refusé à tort)',
  definition: 'La définition d’une catégorie',
  grid: 'Une grille ou une case',
  other: 'Autre chose dans les données',
};

/** Length caps, in characters (code points) of the raw value, before encoding. */
export const REPORT_LIMITS = {
  title: 100,
  grid: 60,
  location: 200,
  pokemon: 80,
} as const;

const SHORT_KIND: Readonly<Record<ReportKind, string>> = {
  answer: 'Réponse',
  definition: 'Définition',
  grid: 'Grille',
  other: 'Autre',
};

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]|\u2028|\u2029/g;

/** One line of text, safe to encode, at most `max` characters (an ellipsis marks a cut). */
function clean(value: string, max: number): string {
  const text = value
    .replace(LONE_SURROGATE, '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

function categoryName(id: string | undefined): string | null {
  if (id === undefined) return null;
  const category = CATEGORIES.find((c) => c.id === id);
  return category === undefined ? null : category.label.fr;
}

function validIndex(value: number | undefined): number | null {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value < GRID_SIZE
    ? value
    : null;
}

function positiveInt(value: number | undefined): number | null {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : null;
}

function gridText(context: ReportContext): string {
  const parts: string[] = [];
  const id = positiveInt(context.gridId);
  if (id !== null) parts.push(`n° ${id}`);
  if (context.gridDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(context.gridDate)) {
    parts.push(context.gridDate);
  }
  return parts.join(' · ');
}

function locationText(context: ReportContext): string {
  const parts: string[] = [];
  const row = validIndex(context.row);
  const col = validIndex(context.col);
  if (row !== null && col !== null) {
    const rowName = categoryName(context.rowCategoryId);
    const colName = categoryName(context.colCategoryId);
    parts.push(
      `Case ligne ${row + 1} × colonne ${col + 1}` +
        (rowName !== null && colName !== null ? ` (${rowName} × ${colName})` : ''),
    );
  }
  const name = categoryName(context.categoryId);
  if (name !== null && context.categoryId !== undefined) {
    parts.push(`Catégorie « ${name} » (${context.categoryId})`);
  }
  return parts.join(' ; ');
}

function pokemonText(context: ReportContext): string {
  const name = context.pokemonName?.trim() ?? '';
  const id = positiveInt(context.pokemonId);
  if (name !== '' && id !== null) return `${name} (n° ${id})`;
  if (name !== '') return name;
  return id === null ? '' : `n° ${id}`;
}

function titleText(context: ReportContext, location: string, pokemon: string): string {
  const where = pokemon !== '' ? pokemon : location !== '' ? location : gridText(context);
  return `Erreur de donnée — ${SHORT_KIND[context.kind]}${where === '' ? '' : ` : ${where}`}`;
}

/** Percent-encoding that cannot throw: `clean` has removed the lone surrogates. */
function param(name: string, value: string): string {
  // `encodeURIComponent` leaves `! ' ( ) *` as they are: encode them too, so the URL is inert anywhere.
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${name}=${encoded}`;
}

/**
 * The URL of the "data error" issue form, pre-filled from what the player was looking at.
 * Unknown or malformed context fields are left out rather than guessed.
 */
export function buildReportUrl(context: ReportContext, issuesUrl: string = ISSUES_URL): string {
  const location = clean(locationText(context), REPORT_LIMITS.location);
  const pokemon = clean(pokemonText(context), REPORT_LIMITS.pokemon);
  const grid = clean(gridText(context), REPORT_LIMITS.grid);
  const title = clean(titleText(context, location, pokemon), REPORT_LIMITS.title);

  const params = [
    param('template', REPORT_TEMPLATE),
    param('labels', REPORT_LABEL),
    param('title', title),
    param(REPORT_FIELDS.kind, REPORT_KIND_OPTIONS[context.kind]),
  ];
  const fields: [string, string][] = [
    [REPORT_FIELDS.grid, grid],
    [REPORT_FIELDS.location, location],
    [REPORT_FIELDS.pokemon, pokemon],
  ];
  for (const [name, value] of fields) {
    if (value !== '') params.push(param(name, value));
  }
  return `${issuesUrl.replace(/\/+$/, '')}/new?${params.join('&')}`;
}
