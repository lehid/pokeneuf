import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { MAX_GEN, type Pokedex } from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { PINNED_SHA, POKEDEX_PATH, SHOWDOWN_CACHE_FILE, SHOWDOWN_POKEDEX_URL } from './config';
import { crossCheckShowdown } from './crosscheck';
import { readCachedText } from './download';
import { runPipeline } from './pipeline';
import { findMissingFields } from './report';
import { loadArtifact } from './test-artifact';

let pokedex: Pokedex;

beforeAll(async () => {
  pokedex = await loadArtifact();
}, 120_000);

describe('dist/pokedex.json', () => {
  it('has exactly 493 entries, numbered 1 to 493', () => {
    expect(pokedex.pokemon).toHaveLength(493);
    expect(pokedex.pokemon.map((p) => p.id)).toEqual(Array.from({ length: 493 }, (_, i) => i + 1));
    expect(pokedex.meta.count).toBe(493);
  });

  it.each([
    [1, 151],
    [2, 100],
    [3, 135],
    [4, 107],
  ])('has the right number of Gen %i species (%i)', (generation, expected) => {
    expect(pokedex.pokemon.filter((p) => p.generation === generation)).toHaveLength(expected);
  });

  it('puts the generation boundaries on the right national numbers', () => {
    const generationOf = (id: number) => pokedex.pokemon.find((p) => p.id === id)?.generation;
    expect([151, 152, 251, 252, 386, 387, 493].map(generationOf)).toEqual([1, 2, 2, 3, 3, 4, 4]);
  });

  it('contains nothing beyond MAX_GEN, not even as an evolution target', () => {
    const max = pokedex.pokemon.length;
    for (const p of pokedex.pokemon) {
      expect(p.generation, `#${p.id}`).toBeLessThanOrEqual(MAX_GEN);
      expect(
        p.evolution.evolvesToIds.every((id) => id <= max),
        `#${p.id}`,
      ).toBe(true);
      expect((p.evolution.evolvesFromId ?? 0) <= max, `#${p.id}`).toBe(true);
    }
  });

  it('records where it comes from', () => {
    expect(pokedex.meta).toMatchObject({
      schemaVersion: 1,
      source: 'PokeAPI/pokeapi',
      sourceSha: PINNED_SHA,
      maxGen: MAX_GEN,
    });
  });

  it('has unique French names, English names and slugs', () => {
    for (const key of ['nameFr', 'nameEn', 'slug'] as const) {
      const values = pokedex.pokemon.map((p) => p[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it('has no empty field', () => {
    expect(findMissingFields(pokedex)).toEqual({});
  });

  it('weighs less than 150 kB gzipped (ROADMAP phase 1)', async () => {
    const gzipped = gzipSync(await readFile(POKEDEX_PATH)).length;
    expect(gzipped).toBeLessThan(150 * 1024);
  });

  it('is reproducible: a fresh build is byte-identical to the file on disk', async () => {
    const fresh = await runPipeline({ write: false });
    expect(fresh.json).toBe(await readFile(POKEDEX_PATH, 'utf8'));
  });

  it('agrees with PokeAPI on who has a Mega Evolution or a Gigantamax form', async () => {
    const { warnings } = await runPipeline({ write: false });
    expect(warnings).toEqual([]);
  });

  it('agrees with Pokémon Showdown (independent source) on types, stats, size, colour, evolutions and forms', async () => {
    const source = await readCachedText(SHOWDOWN_CACHE_FILE, SHOWDOWN_POKEDEX_URL);
    expect(crossCheckShowdown(pokedex, source)).toEqual([]);
  }, 60_000);
});
