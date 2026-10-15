import { describe, expect, it } from 'vitest';
import { ISSUES_URL } from './config';
import {
  REPORT_FIELDS,
  REPORT_KIND_OPTIONS,
  REPORT_LABEL,
  REPORT_LIMITS,
  REPORT_TEMPLATE,
  buildReportUrl,
  type ReportContext,
} from './report';

function parse(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('buildReportUrl', () => {
  it('points at the data-error issue form of the repository, with its label', () => {
    const url = buildReportUrl({ kind: 'grid' });
    expect(url.startsWith(`${ISSUES_URL}/new?`)).toBe(true);
    const params = parse(url);
    expect(params.get('template')).toBe(REPORT_TEMPLATE);
    expect(params.get('labels')).toBe(REPORT_LABEL);
    expect(params.get(REPORT_FIELDS.kind)).toBe(REPORT_KIND_OPTIONS.grid);
  });

  it('pre-fills the grid, the cell with its categories and the Pokémon', () => {
    const params = parse(
      buildReportUrl({
        kind: 'answer',
        gridId: 12,
        gridDate: '2026-11-12',
        row: 0,
        col: 2,
        rowCategoryId: 'type-mono',
        colCategoryId: 'type-dual',
        pokemonId: 25,
        pokemonName: 'Pikachu',
      }),
    );
    expect(params.get(REPORT_FIELDS.kind)).toBe(REPORT_KIND_OPTIONS.answer);
    expect(params.get(REPORT_FIELDS.grid)).toBe('n° 12 · 2026-11-12');
    expect(params.get(REPORT_FIELDS.location)).toBe(
      'Case ligne 1 × colonne 3 (Monotype × Double type)',
    );
    expect(params.get(REPORT_FIELDS.pokemon)).toBe('Pikachu (n° 25)');
    expect(params.get('title')).toBe('Erreur de donnée — Réponse : Pikachu (n° 25)');
  });

  it('names the category of a definition report', () => {
    const params = parse(buildReportUrl({ kind: 'definition', categoryId: 'type-mono' }));
    expect(params.get(REPORT_FIELDS.location)).toBe('Catégorie « Monotype » (type-mono)');
    expect(params.get(REPORT_FIELDS.pokemon)).toBeNull();
    expect(params.get('title')).toBe(
      'Erreur de donnée — Définition : Catégorie « Monotype » (type-mono)',
    );
  });

  it('leaves out what is missing, unknown or malformed instead of guessing', () => {
    const params = parse(
      buildReportUrl({
        kind: 'answer',
        gridId: -3,
        gridDate: '12/11/2026',
        row: 3,
        col: 1.5,
        categoryId: 'does-not-exist',
        pokemonId: 0,
      }),
    );
    for (const field of [REPORT_FIELDS.grid, REPORT_FIELDS.location, REPORT_FIELDS.pokemon]) {
      expect(params.has(field), field).toBe(false);
    }
    expect(params.get('title')).toBe('Erreur de donnée — Réponse');
  });

  it('encodes accents, quotes, ampersands and non-ASCII safely, and they round-trip', () => {
    const name = `Flabébé "l'été" & <b>Ñ</b> #1 ? = + % ✨ 😀`;
    const url = buildReportUrl({ kind: 'answer', pokemonName: name });
    expect(url).not.toMatch(/[\s"'<>]/);
    expect(url.split('?')[1]?.split('&')).toHaveLength(5); // template, labels, title, kind, pokemon
    expect(parse(url).get(REPORT_FIELDS.pokemon)).toBe(name);
  });

  it('turns newlines, tabs and control characters into single spaces', () => {
    const url = buildReportUrl({ kind: 'answer', pokemonName: 'Pika\r\nchu\t\u0000\n\nX' });
    expect(url).not.toContain('%0A');
    expect(url).not.toContain('%0D');
    expect(url).not.toContain('%00');
    expect(parse(url).get(REPORT_FIELDS.pokemon)).toBe('Pika chu X');
  });

  it('survives lone surrogates, which encodeURIComponent would reject', () => {
    const url = buildReportUrl({ kind: 'answer', pokemonName: 'Ab\uD800c\uDC00d' });
    expect(parse(url).get(REPORT_FIELDS.pokemon)).toBe('Abcd');
  });

  it('caps every pre-filled value, without cutting a character in two', () => {
    const long = '😀é'.repeat(500);
    const params = parse(buildReportUrl({ kind: 'answer', pokemonName: long }));
    const pokemon = params.get(REPORT_FIELDS.pokemon) ?? '';
    expect(Array.from(pokemon)).toHaveLength(REPORT_LIMITS.pokemon);
    expect(pokemon.endsWith('…')).toBe(true);
    expect(Array.from(params.get('title') ?? '').length).toBeLessThanOrEqual(REPORT_LIMITS.title);
    expect(pokemon).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('keeps the whole URL well under GitHub’s limit, even in the worst case', () => {
    const worst: ReportContext = {
      kind: 'answer',
      gridId: 999_999,
      gridDate: '2099-12-31',
      row: 2,
      col: 2,
      rowCategoryId: 'type-mono',
      colCategoryId: 'type-dual',
      categoryId: 'type-mono',
      pokemonId: 493,
      pokemonName: '😀'.repeat(1000),
    };
    expect(buildReportUrl(worst).length).toBeLessThan(2500);
  });

  it('carries nothing but the given context', () => {
    const url = buildReportUrl({ kind: 'grid', gridId: 1, gridDate: '2026-11-01' });
    const names = [...parse(url).keys()].sort();
    expect(names).toEqual(['grid', 'kind', 'labels', 'template', 'title']);
  });

  it('accepts another repository URL, with or without a trailing slash', () => {
    expect(buildReportUrl({ kind: 'grid' }, 'https://example.org/r/issues/')).toMatch(
      /^https:\/\/example\.org\/r\/issues\/new\?/,
    );
  });
});
