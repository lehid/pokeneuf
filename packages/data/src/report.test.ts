import type { Pokedex } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { buildPokedex } from './build';
import { findMissingFields, formatReport } from './report';
import { buildOptions, fakeTables } from './test-fixtures';

function pokedex(): Pokedex {
  return buildPokedex(
    fakeTables(
      [
        { id: 1, generation: 1 },
        { id: 2, generation: 1, from: 1 },
        { id: 3, generation: 2, isLegendary: true },
      ],
      [{ into: 2, columns: { minimum_level: '16' } }],
    ),
    buildOptions(),
  );
}

describe('formatReport', () => {
  it('counts the entries per generation and the flags', () => {
    const report = formatReport(pokedex());
    expect(report).toContain('Pokédex: 3 entries (Gen 1-4)');
    expect(report).toContain('Gen 1: 2');
    expect(report).toContain('Gen 2: 1');
    expect(report).toContain('legendary 1');
    expect(report).toContain('Missing fields: none');
  });

  it('shows the warnings it is given', () => {
    const report = formatReport(pokedex(), ['mega.json lacks ids: 5']);
    expect(report).toContain('Warnings (1):');
    expect(report).toContain('! mega.json lacks ids: 5');
  });

  it('names the missing fields when there are some', () => {
    const broken = pokedex();
    const first = broken.pokemon[0];
    if (!first) throw new Error('empty fixture');
    first.nameFr = '';
    expect(formatReport(broken)).toContain('Missing fields: nameFr (1)');
  });
});

describe('findMissingFields', () => {
  it('is empty for a complete Pokédex', () => {
    expect(findMissingFields(pokedex())).toEqual({});
  });

  it('counts empty values per field, but not the legitimate nulls of a base form', () => {
    const broken = pokedex();
    for (const p of broken.pokemon) {
      p.slug = '';
      p.types = [];
    }
    expect(findMissingFields(broken)).toEqual({ slug: 3, types: 3 });
  });
});
