import { CATEGORIES, type Category, type CategoryRef } from './categories';
import type { Pokemon } from './pokedex';

/**
 * Which Pokémon belongs to which category, precomputed as bitsets (ROADMAP phase 2):
 * one bit per national number (bit `id - 1`), packed 8 per byte, least significant bit first,
 * written as lower-case hex. 493 Pokémon take 124 characters per category.
 */
export interface MembershipsFile {
  meta: {
    schemaVersion: number;
    /** Number of Pokémon: ids are exactly 1..count. */
    count: number;
  };
  /** Category id → hex bitset. */
  bitsets: Record<string, string>;
}

export const MEMBERSHIPS_SCHEMA_VERSION = 1;

export function encodeBitset(bits: readonly boolean[]): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    if (bit) bytes[i >> 3] = (bytes[i >> 3] ?? 0) | (1 << (i & 7));
  });
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function decodeBitset(hex: string, length: number): Uint8Array {
  const size = Math.ceil(length / 8);
  if (!/^[0-9a-f]*$/.test(hex) || hex.length !== size * 2) {
    throw new Error(`Bitset of ${length} bits should be ${size * 2} hex digits, got ${hex.length}`);
  }
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  // Bits beyond `length` must be unset, or the data does not describe this Pokédex.
  const spare = size * 8 - length;
  if (spare > 0 && (bytes[size - 1] ?? 0) >> (8 - spare) !== 0) {
    throw new Error('Bitset has bits set beyond the last Pokémon');
  }
  return bytes;
}

/**
 * Evaluates every category on every Pokémon. Ids must be exactly 1..n, which the Pokédex
 * guarantees. Deterministic: same Pokédex and categories give the same file.
 */
export function computeMemberships(
  pokemon: readonly Pokemon[],
  categories: readonly Category[] = CATEGORIES,
): MembershipsFile {
  pokemon.forEach((p, index) => {
    if (p.id !== index + 1) throw new Error(`Pokémon ids must be 1..n: found #${p.id} at ${index}`);
  });
  const bitsets: Record<string, string> = {};
  for (const category of categories) {
    if (category.id in bitsets) throw new Error(`Duplicate category id: ${category.id}`);
    bitsets[category.id] = encodeBitset(pokemon.map((p) => category.predicate(p)));
  }
  return { meta: { schemaVersion: MEMBERSHIPS_SCHEMA_VERSION, count: pokemon.length }, bitsets };
}

function popcount(byte: number): number {
  let n = 0;
  for (let b = byte; b > 0; b >>= 1) n += b & 1;
  return n;
}

/** Fast membership queries over a `MembershipsFile`: this is what the game and the generator use. */
export class Memberships {
  readonly count: number;
  private readonly bits = new Map<string, Uint8Array>();

  constructor(file: MembershipsFile, categories: readonly Category[] = CATEGORIES) {
    if (file.meta.schemaVersion !== MEMBERSHIPS_SCHEMA_VERSION) {
      throw new Error(`Unsupported memberships schema version ${file.meta.schemaVersion}`);
    }
    this.count = file.meta.count;
    const known = new Set(categories.map((c) => c.id));
    for (const id of Object.keys(file.bitsets)) {
      if (!known.has(id)) throw new Error(`Memberships has an unknown category: ${id}`);
    }
    for (const id of known) {
      const hex = file.bitsets[id];
      if (hex === undefined) throw new Error(`Memberships lacks category: ${id}`);
      this.bits.set(id, decodeBitset(hex, this.count));
    }
  }

  private bitsOf(ref: CategoryRef): Uint8Array {
    // Resolved against this instance only, not the global registry: a Memberships can be built
    // for any list of categories.
    const id = typeof ref === 'string' ? ref : ref.id;
    const bits = this.bits.get(id);
    if (!bits) throw new Error(`Unknown category: ${id}`);
    return bits;
  }

  private checkId(pokemonId: number): void {
    if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > this.count) {
      throw new Error(`Unknown Pokémon number: ${pokemonId}`);
    }
  }

  /** Does the Pokémon belong to the category? */
  has(ref: CategoryRef, pokemonId: number): boolean {
    this.checkId(pokemonId);
    const index = pokemonId - 1;
    return (((this.bitsOf(ref)[index >> 3] ?? 0) >> (index & 7)) & 1) === 1;
  }

  /** Is the Pokémon a valid answer for a cell: it satisfies the row AND the column. */
  isValid(pokemonId: number, rowCategory: CategoryRef, colCategory: CategoryRef): boolean {
    return this.has(rowCategory, pokemonId) && this.has(colCategory, pokemonId);
  }

  /** Every valid answer for a cell, by national number. */
  answersFor(rowCategory: CategoryRef, colCategory: CategoryRef): number[] {
    const row = this.bitsOf(rowCategory);
    const col = this.bitsOf(colCategory);
    const answers: number[] = [];
    for (let index = 0; index < this.count; index++) {
      const mask = 1 << (index & 7);
      if (((row[index >> 3] ?? 0) & (col[index >> 3] ?? 0) & mask) !== 0) answers.push(index + 1);
    }
    return answers;
  }

  /** Number of members of a category. */
  size(ref: CategoryRef): number {
    return this.bitsOf(ref).reduce((total, byte) => total + popcount(byte), 0);
  }
}
