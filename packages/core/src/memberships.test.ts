import { describe, expect, it } from 'vitest';
import type { Category } from './categories';
import {
  computeMemberships,
  decodeBitset,
  encodeBitset,
  Memberships,
  MEMBERSHIPS_SCHEMA_VERSION,
  type MembershipsFile,
} from './memberships';
import { pokemon } from './test-fixtures';

describe('bitsets', () => {
  it('packs 8 Pokémon per byte, first one in the least significant bit, as hex', () => {
    expect(encodeBitset([])).toBe('');
    expect(encodeBitset([true])).toBe('01');
    expect(encodeBitset([false, true])).toBe('02');
    expect(encodeBitset([true, false, false, false, false, false, false, true])).toBe('81');
    expect(encodeBitset([true, false, false, false, false, false, false, false, true])).toBe(
      '0101',
    );
  });

  it('round-trips, whatever the length', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 2 === 0;
    for (const length of [0, 1, 7, 8, 9, 15, 16, 17, 100, 493]) {
      const bits = Array.from({ length }, random);
      const bytes = decodeBitset(encodeBitset(bits), length);
      const back = bits.map((_, i) => (((bytes[i >> 3] ?? 0) >> (i & 7)) & 1) === 1);
      expect(back, `length ${length}`).toEqual(bits);
    }
  });

  it('rejects data that does not fit the Pokédex', () => {
    expect(() => decodeBitset('0', 8)).toThrow(/2 hex digits/);
    expect(() => decodeBitset('0000', 8)).toThrow(/2 hex digits/);
    expect(() => decodeBitset('zz', 8)).toThrow(/hex digits/);
    expect(() => decodeBitset('FF', 8)).toThrow(/hex digits/); // upper case is not what we write
    expect(() => decodeBitset('80', 7)).toThrow(/beyond the last Pokémon/);
    expect(decodeBitset('7f', 7)).toEqual(new Uint8Array([0x7f]));
  });
});

// Five Pokémon; "even" = even ids, "big" = ids 3, 4, 5, "none" = nobody.
const dex = [1, 2, 3, 4, 5].map((id) => pokemon({ id, heightDm: id }));
const category = (id: string, predicate: Category['predicate']): Category => ({
  id,
  family: 'type',
  label: { fr: id, en: id },
  definition: { fr: id },
  predicate,
  exclusiveWith: [],
  bonus: false,
});
const categories = [
  category('even', (p) => p.id % 2 === 0),
  category('big', (p) => p.heightDm >= 3),
  category('none', () => false),
];

describe('computeMemberships', () => {
  const file = computeMemberships(dex, categories);

  it('writes one bitset per category, in the documented layout', () => {
    expect(file.meta).toEqual({ schemaVersion: MEMBERSHIPS_SCHEMA_VERSION, count: 5 });
    expect(file.bitsets).toEqual({ even: '0a', big: '1c', none: '00' });
  });

  it('is deterministic', () => {
    expect(JSON.stringify(computeMemberships(dex, categories))).toBe(JSON.stringify(file));
  });

  it('refuses ids that are not exactly 1..n', () => {
    expect(() => computeMemberships([pokemon({ id: 2 })], categories)).toThrow(
      /ids must be 1\.\.n/,
    );
    expect(() => computeMemberships([...dex].reverse(), categories)).toThrow(/ids must be 1\.\.n/);
  });

  it('refuses a duplicate category id', () => {
    expect(() =>
      computeMemberships(dex, [categories[0] as Category, categories[0] as Category]),
    ).toThrow(/Duplicate category id: even/);
  });
});

describe('Memberships', () => {
  const file = computeMemberships(dex, categories);
  const engine = new Memberships(file, categories);

  it('answers membership, by id or by category', () => {
    expect(engine.has('even', 2)).toBe(true);
    expect(engine.has('even', 3)).toBe(false);
    expect(engine.has(categories[1] as Category, 3)).toBe(true);
    expect(engine.has('none', 1)).toBe(false);
  });

  it('knows when a Pokémon is a valid answer for a cell (row AND column)', () => {
    expect(engine.isValid(4, 'even', 'big')).toBe(true);
    expect(engine.isValid(2, 'even', 'big')).toBe(false);
    expect(engine.isValid(5, 'even', 'big')).toBe(false);
    expect(engine.isValid(4, 'big', 'even')).toBe(true); // order does not matter
  });

  it('lists every answer of a cell, in national order', () => {
    expect(engine.answersFor('even', 'big')).toEqual([4]);
    expect(engine.answersFor('big', 'big')).toEqual([3, 4, 5]);
    expect(engine.answersFor('even', 'none')).toEqual([]);
  });

  it('counts the members of a category', () => {
    expect(engine.size('even')).toBe(2);
    expect(engine.size('big')).toBe(3);
    expect(engine.size('none')).toBe(0);
    expect(engine.count).toBe(5);
  });

  it('agrees with the predicates on every Pokémon and every pair', () => {
    for (const row of categories) {
      for (const col of categories) {
        const expected = dex.filter((p) => row.predicate(p) && col.predicate(p)).map((p) => p.id);
        expect(engine.answersFor(row, col)).toEqual(expected);
        for (const p of dex) {
          expect(engine.isValid(p.id, row, col)).toBe(expected.includes(p.id));
        }
      }
    }
  });

  it('rejects an unknown Pokémon number or category', () => {
    expect(() => engine.has('even', 0)).toThrow(/Unknown Pokémon number: 0/);
    expect(() => engine.has('even', 6)).toThrow(/Unknown Pokémon number: 6/);
    expect(() => engine.has('even', 1.5)).toThrow(/Unknown Pokémon number/);
    expect(() => engine.has('nope', 1)).toThrow(/Unknown category: nope/);
  });

  it('refuses a file that does not match the categories', () => {
    const lacking: MembershipsFile = { ...file, bitsets: { even: '0a', big: '1c' } };
    expect(() => new Memberships(lacking, categories)).toThrow(/lacks category: none/);
    const extra: MembershipsFile = { ...file, bitsets: { ...file.bitsets, ghost: '00' } };
    expect(() => new Memberships(extra, categories)).toThrow(/unknown category: ghost/);
    const old: MembershipsFile = { ...file, meta: { ...file.meta, schemaVersion: 0 } };
    expect(() => new Memberships(old, categories)).toThrow(/schema version 0/);
    const truncated: MembershipsFile = { ...file, bitsets: { ...file.bitsets, even: '' } };
    expect(() => new Memberships(truncated, categories)).toThrow(/hex digits/);
  });

  it('works with the real registry when no categories are given', () => {
    const real = computeMemberships([pokemon({ id: 1 })]);
    expect(new Memberships(real).has('gen-1', 1)).toBe(true);
  });
});
