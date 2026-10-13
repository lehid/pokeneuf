import type { Pokedex, Pokemon } from '@pokeneuf/core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MANUAL_DIR } from './config';
import { addPopularity, POPULARITY_WEIGHTS, rawPopularity } from './popularity';
import { loadArtifact } from './test-artifact';

let pokedex: Pokedex;
let popular: number[];

beforeAll(async () => {
  pokedex = await loadArtifact();
  const file = JSON.parse(await readFile(path.join(MANUAL_DIR, 'popular.json'), 'utf8')) as {
    ids: number[];
  };
  popular = file.ids;
}, 120_000);

const bare = (p: Pokemon): Omit<Pokemon, 'pop'> => {
  const rest: Partial<Pokemon> = { ...p };
  delete rest.pop;
  return rest as Omit<Pokemon, 'pop'>;
};
/** A Pokémon with neutral flags, to check one weight at a time. */
const plain = (overrides: Partial<Omit<Pokemon, 'pop'>> = {}): Omit<Pokemon, 'pop'> => {
  const base = pokedex.pokemon.find((p) => p.id === 287); // Parecool: Gen 3, nothing special
  if (!base) throw new Error('fixture missing');
  return {
    ...bare(base),
    isStarter: false,
    isLegendary: false,
    isMythical: false,
    isPseudoLegendary: false,
    isFossil: false,
    isBaby: false,
    hasMega: false,
    hasGmax: false,
    evolution: { ...base.evolution, stage: 1, isFinal: false },
    ...overrides,
  };
};
const raw = (p: Omit<Pokemon, 'pop'>, rank: number | null = null) => rawPopularity(p, rank, 10);

describe('rawPopularity', () => {
  it('ranks generations from the best known to the least', () => {
    const [g1, g2, g3, g4] = [1, 2, 3, 4].map((generation) => raw(plain({ generation })));
    expect(g1).toBeGreaterThan(g2 ?? 0);
    expect(g2).toBeGreaterThan(g3 ?? 0);
    expect(g3).toBeGreaterThan(g4 ?? 0);
  });

  it('adds up the weights of what a Pokémon is', () => {
    const base = raw(plain());
    const w = POPULARITY_WEIGHTS;
    expect(raw(plain({ isStarter: true })) - base).toBeCloseTo(w.starter);
    expect(raw(plain({ isLegendary: true })) - base).toBeCloseTo(w.legendary);
    expect(raw(plain({ isMythical: true })) - base).toBeCloseTo(w.mythical);
    expect(raw(plain({ isPseudoLegendary: true })) - base).toBeCloseTo(w.pseudoLegendary);
    expect(raw(plain({ isFossil: true })) - base).toBeCloseTo(w.fossil);
    expect(raw(plain({ isBaby: true })) - base).toBeCloseTo(w.baby);
    expect(raw(plain({ hasMega: true })) - base).toBeCloseTo(w.mega);
    expect(raw(plain({ hasGmax: true })) - base).toBeCloseTo(w.gmax);
  });

  it('prefers final stages, then lone Pokémon, then first stages, then middle stages', () => {
    const stage = (stageNumber: number, isFinal: boolean) => {
      const p = plain();
      return raw({ ...p, evolution: { ...p.evolution, stage: stageNumber, isFinal } });
    };
    expect(stage(3, true)).toBeGreaterThan(stage(1, true));
    expect(stage(1, true)).toBeGreaterThan(stage(1, false));
    expect(stage(1, false)).toBeGreaterThan(stage(2, false));
  });

  it('puts popular.json above everyone else, in list order', () => {
    // The best a Pokémon can do without being listed: Gen 1, final stage, Mega and Gigamax.
    const unlisted = plain({ generation: 1, hasMega: true, hasGmax: true });
    const best = raw({
      ...unlisted,
      evolution: { ...unlisted.evolution, stage: 3, isFinal: true },
    });
    expect(raw(plain({ generation: 4 }), 9)).toBeGreaterThan(best);
    expect(raw(plain(), 0)).toBeGreaterThan(raw(plain(), 1));
    expect(raw(plain(), 1)).toBeGreaterThan(raw(plain(), 9));
  });
});

describe('addPopularity', () => {
  it('scales into [0, 1], the best being exactly 1, and keeps the order', () => {
    const entries = pokedex.pokemon.map(bare);
    const scored = addPopularity(entries, popular);
    expect(Math.max(...scored.map((p) => p.pop))).toBe(1);
    expect(Math.min(...scored.map((p) => p.pop))).toBeGreaterThan(0);
    const rank = popular.length;
    const raws = entries.map((p) =>
      rawPopularity(p, popular.indexOf(p.id) === -1 ? null : popular.indexOf(p.id), rank),
    );
    for (const [i, p] of scored.entries()) {
      for (const [j, q] of scored.entries()) {
        if ((raws[i] ?? 0) > (raws[j] ?? 0) + 1e-3) expect(p.pop).toBeGreaterThan(q.pop);
        else if ((raws[j] ?? 0) > (raws[i] ?? 0) + 1e-3) expect(q.pop).toBeGreaterThan(p.pop);
      }
      if (i > 20) break; // all pairs on a sample: the full square is 240k comparisons
    }
  });

  it('is deterministic, and rounded to 4 decimals', () => {
    const entries = pokedex.pokemon.map(bare);
    expect(addPopularity(entries, popular)).toEqual(addPopularity(entries, popular));
    for (const p of addPopularity(entries, popular)) {
      expect(Math.abs(p.pop * 10_000 - Math.round(p.pop * 10_000))).toBeLessThan(1e-6);
    }
  });
});

describe('pop in the shipped pokedex.json (golden facts)', () => {
  const rankOf = (id: number) => {
    const sorted = [...pokedex.pokemon].sort((a, b) => b.pop - a.pop || a.id - b.id);
    return sorted.findIndex((p) => p.id === id) + 1;
  };
  const topFive = () => Math.ceil(pokedex.pokemon.length * 0.05);

  it('puts Pikachu and Dracaufeu in the top 5 %', () => {
    expect(rankOf(25)).toBeLessThanOrEqual(topFive());
    expect(rankOf(6)).toBeLessThanOrEqual(topFive());
  });

  it('puts obscure Gen 3 and Gen 4 Pokémon in the bottom quarter', () => {
    const bottomQuarter = pokedex.pokemon.length * 0.75;
    for (const id of [287, 265, 401, 404]) {
      // Parecool, Chenipotte, Crikzik, Luxio
      expect(rankOf(id), `#${id}`).toBeGreaterThan(bottomQuarter);
    }
  });

  it('puts every Pokémon of popular.json above every other one', () => {
    const listed = new Set(popular);
    const lowestListed = Math.min(
      ...pokedex.pokemon.filter((p) => listed.has(p.id)).map((p) => p.pop),
    );
    const highestOther = Math.max(
      ...pokedex.pokemon.filter((p) => !listed.has(p.id)).map((p) => p.pop),
    );
    expect(lowestListed).toBeGreaterThan(highestOther);
  });

  it('keeps popular.json to about 60 Pokémon, all within the scope', () => {
    expect(popular.length).toBeGreaterThanOrEqual(50);
    expect(popular.length).toBeLessThanOrEqual(80);
    expect(new Set(popular).size).toBe(popular.length);
    for (const id of popular) expect(id).toBeLessThanOrEqual(pokedex.pokemon.length);
  });

  it('gives every Pokémon a pop in [0, 1]', () => {
    for (const p of pokedex.pokemon) {
      expect(p.pop, p.nameFr).toBeGreaterThanOrEqual(0);
      expect(p.pop, p.nameFr).toBeLessThanOrEqual(1);
    }
  });
});
