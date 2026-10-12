import { createSearch, type Pokedex, type Searcher } from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadArtifact } from './test-artifact';

let search: Searcher;
let pokedex: Pokedex;

beforeAll(async () => {
  pokedex = await loadArtifact();
  search = createSearch(pokedex.pokemon);
}, 120_000);

const names = (query: string, options?: Parameters<Searcher>[1]) =>
  search(query, options).map((p) => p.nameFr);

describe('search on the real Pokédex', () => {
  it.each(['electhor', 'Électhor', 'Zapdos', 'zapd', '145', '#145'])(
    '%j finds Électhor first',
    (q) => {
      expect(names(q)[0]).toBe('Électhor');
    },
  );

  it('finds the awkward names however they are typed', () => {
    expect(names('mr mime')[0]).toBe('M. Mime');
    expect(names('m. mime')[0]).toBe('M. Mime');
    expect(names("farfetch'd")[0]).toBe('Canarticho');
    expect(names('farfetch’d')[0]).toBe('Canarticho');
    expect(names('ho-oh')[0]).toBe('Ho-Oh');
    expect(names('hooh')[0]).toBe('Ho-Oh');
    expect(names('porygon z')[0]).toBe('Porygon-Z');
    expect(names('mime jr')[0]).toBe('Mime Jr.');
  });

  it('tells the two Nidoran apart', () => {
    expect(names('nidoran f')).toEqual(['Nidoran♀']);
    expect(names('Nidoran femelle')).toEqual(['Nidoran♀']);
    expect(names('nidoran♂')).toEqual(['Nidoran♂']);
    expect(names('nidoran m')).toEqual(['Nidoran♂']);
    expect(names('nidoran').slice(0, 2)).toEqual(['Nidoran♀', 'Nidoran♂']);
  });

  it('ranks an exact name before names that merely start with it', () => {
    expect(names('mew').slice(0, 2)).toEqual(['Mew', 'Mewtwo']);
    expect(names('pikachu')[0]).toBe('Pikachu');
    expect(names('evoli')[0]).toBe('Évoli');
  });

  it('finds every Pokémon by its own French name, English name and number', () => {
    for (const p of pokedex.pokemon) {
      expect(search(p.nameFr)[0]?.id, p.nameFr).toBe(p.id);
      expect(search(p.nameEn)[0]?.id, p.nameEn).toBe(p.id);
      expect(search(String(p.id).padStart(3, '0'))[0]?.id, `#${p.id}`).toBe(p.id);
    }
  });

  it('returns nothing for gibberish and honours the language and the limit', () => {
    expect(names('zzzzz')).toEqual([]);
    expect(search('a', { limit: 5 })).toHaveLength(5);
    expect(search('a', { lang: 'en' })).not.toHaveLength(0);
  });
});
