import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('maps each data row to the header names', () => {
    expect(parseCsv('id,identifier\n1,bulbasaur\n2,ivysaur\n')).toEqual([
      { id: '1', identifier: 'bulbasaur' },
      { id: '2', identifier: 'ivysaur' },
    ]);
  });

  it('keeps empty cells as empty strings', () => {
    expect(parseCsv('a,b,c\n1,,3\n,,\n')).toEqual([
      { a: '1', b: '', c: '3' },
      { a: '', b: '', c: '' },
    ]);
  });

  it('handles quoted cells: commas, escaped quotes and newlines', () => {
    const csv = 'id,name\n1,"Mr. Mime, the ""clown"""\n2,"two\nlines"\n';
    expect(parseCsv(csv)).toEqual([
      { id: '1', name: 'Mr. Mime, the "clown"' },
      { id: '2', name: 'two\nlines' },
    ]);
  });

  it('accepts CRLF line endings, a BOM and a missing final newline', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('skips blank lines and returns [] for an empty file', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([{ a: '1', b: '2' }]);
    expect(parseCsv('')).toEqual([]);
  });

  it('keeps non-ASCII text intact', () => {
    expect(parseCsv('name\nNidoran♀\nÉvoli\n')).toEqual([{ name: 'Nidoran♀' }, { name: 'Évoli' }]);
  });

  it('rejects rows whose width differs from the header', () => {
    expect(() => parseCsv('a,b\n1,2,3\n')).toThrow(/row 1 has 3 cells/);
    expect(() => parseCsv('a,b\n1\n')).toThrow(/row 1 has 1 cells/);
  });

  it('rejects an unterminated quoted cell', () => {
    expect(() => parseCsv('a\n"oops\n')).toThrow(/unterminated/);
  });
});
