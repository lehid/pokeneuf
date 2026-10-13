import type { Pokedex } from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { GOLDEN_FACTS } from './golden-facts';
import { loadArtifact } from './test-artifact';

let pokedex: Pokedex;

beforeAll(async () => {
  pokedex = await loadArtifact();
}, 120_000);

/** `abilities.1.slug` → `entry.abilities[1].slug`; `undefined` when the path does not exist. */
function valueAt(entry: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      entry,
    );
}

describe('golden facts', () => {
  it.each(GOLDEN_FACTS)('#%i %s = %j', (id, path, expected) => {
    const entry = pokedex.pokemon.find((p) => p.id === id);
    expect(entry, `no Pokémon with id ${id}`).toBeDefined();
    expect(valueAt(entry, path)).toEqual(expected);
  });

  it('are numerous enough (ROADMAP §3.3: at least 80 hand-written assertions)', () => {
    expect(GOLDEN_FACTS.length).toBeGreaterThanOrEqual(80);
  });

  it('target an existing field of an existing entry (no typo hides a dead fact)', () => {
    for (const [id, path] of GOLDEN_FACTS) {
      const entry = pokedex.pokemon.find((p) => p.id === id);
      expect(valueAt(entry, path), `#${id} ${path}`).not.toBeUndefined();
    }
  });

  it('cover every field of the entry', () => {
    const covered = new Set(GOLDEN_FACTS.map(([, path]) => path.split('.').slice(0, 2).join('.')));
    const fields = [
      'slug',
      'nameFr',
      'nameEn',
      'aliases',
      'generation',
      'types',
      'baseStats',
      'abilities.0',
      'evolution.stage',
      'evolution.isFinal',
      'evolution.evolvesFromId',
      'evolution.evolvesToIds',
      'evolution.methods',
      'evolution.branched',
      'evolution.evolutionAddedInGen',
      'isBaby',
      'isLegendary',
      'isMythical',
      'isStarter',
      'isFossil',
      'isPseudoLegendary',
      'color',
      'shape',
      'heightDm',
      'weightHg',
      'hasMega',
      'hasGmax',
    ];
    expect(fields.filter((field) => !covered.has(field))).toEqual([]);
  });
});
