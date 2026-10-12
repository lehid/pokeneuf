import { describe, expect, it } from 'vitest';
import { createSearch, normalize, search } from './search';
import { pokemon } from './test-fixtures';

describe('normalize', () => {
  it.each([
    ['Électhor', 'electhor'],
    ['ÉVOLI', 'evoli'],
    ['Mélofée', 'melofee'],
    ['Ténèbres', 'tenebres'],
    ['Çà et là', 'ca et la'],
    ['Cœur', 'coeur'],
    ['Farfetch’d', 'farfetchd'],
    ["Farfetch'd", 'farfetchd'],
    ['Nidoran♀', 'nidoranf'],
    ['Nidoran♂', 'nidoranm'],
    ['M. Mime', 'm mime'],
    ['Mr. Mime', 'mr mime'],
    ['Ho-Oh', 'ho oh'],
    ['Porygon-Z', 'porygon z'],
    ['  Mime   Jr.  ', 'mime jr'],
    ['Mime Jr.', 'mime jr'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const name of ['Électhor', 'Nidoran♀', 'M. Mime', "Farfetch'd", 'Ho-Oh']) {
      expect(normalize(normalize(name))).toBe(normalize(name));
    }
  });
});

const dex = [
  pokemon({ id: 25, nameFr: 'Pikachu', nameEn: 'Pikachu' }),
  pokemon({ id: 26, nameFr: 'Raichu', nameEn: 'Raichu' }),
  pokemon({
    id: 29,
    nameFr: 'Nidoran♀',
    nameEn: 'Nidoran♀',
    aliases: ['Nidoran F', 'Nidoran femelle'],
  }),
  pokemon({ id: 32, nameFr: 'Nidoran♂', nameEn: 'Nidoran♂', aliases: ['Nidoran M'] }),
  pokemon({ id: 83, nameFr: 'Canarticho', nameEn: 'Farfetch’d' }),
  pokemon({ id: 122, nameFr: 'M. Mime', nameEn: 'Mr. Mime' }),
  pokemon({ id: 133, nameFr: 'Évoli', nameEn: 'Eevee' }),
  pokemon({ id: 145, nameFr: 'Électhor', nameEn: 'Zapdos' }),
  pokemon({ id: 150, nameFr: 'Mewtwo', nameEn: 'Mewtwo' }),
  pokemon({ id: 151, nameFr: 'Mew', nameEn: 'Mew' }),
  pokemon({ id: 172, nameFr: 'Pichu', nameEn: 'Pichu' }),
  pokemon({ id: 250, nameFr: 'Ho-Oh', nameEn: 'Ho-Oh' }),
];
const find = createSearch(dex);
const ids = (query: string, options?: Parameters<typeof find>[1]) =>
  find(query, options).map((p) => p.id);

describe('search', () => {
  it.each(['electhor', 'Électhor', 'ELECTHOR', ' electhor '])(
    'finds Électhor by its French name: %j',
    (q) => {
      expect(ids(q)).toEqual([145]);
    },
  );

  it('finds Électhor by its English name and by its number', () => {
    expect(ids('Zapdos')).toEqual([145]);
    expect(ids('zapd')).toEqual([145]);
    expect(ids('145')).toEqual([145]);
    expect(ids('#145')).toEqual([145]);
  });

  it('reads an all-digit query as a national number, zero padded or not', () => {
    expect(ids('25')).toEqual([25]);
    expect(ids('025')).toEqual([25]);
    expect(ids('999')).toEqual([]);
  });

  it('returns nothing for an empty or blank query', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
    expect(ids('...')).toEqual([]);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('zzz')).toEqual([]);
  });

  it('puts prefix matches before substring matches, shorter names first', () => {
    expect(ids('pi')).toEqual([172, 25]); // Pichu (5) before Pikachu (7)
    expect(ids('chu')).toEqual([172, 26, 25]); // substring only: Pichu, Raichu, Pikachu
  });

  it('puts an exact match before a prefix match', () => {
    expect(ids('mew')).toEqual([151, 150]);
  });

  it.each(['m mime', 'm. mime', 'M.Mime', 'mr mime', 'Mr. Mime', 'mrmime', 'mime'])(
    'finds M. Mime with %j',
    (q) => {
      expect(ids(q)).toEqual([122]);
    },
  );

  it.each(["farfetch'd", 'farfetch’d', 'farfetchd', 'Farfetch', 'canart'])(
    'finds Canarticho with %j',
    (q) => {
      expect(ids(q)).toEqual([83]);
    },
  );

  it.each(['ho-oh', 'ho oh', 'hooh', 'Ho-Oh'])('finds Ho-Oh with %j', (q) => {
    expect(ids(q)).toEqual([250]);
  });

  it('tells the two Nidoran apart, and accepts the aliases', () => {
    expect(ids('nidoran')).toEqual([29, 32]);
    expect(ids('nidoran♀')).toEqual([29]);
    expect(ids('nidoran f')).toEqual([29]);
    expect(ids('nidoranf')).toEqual([29]);
    expect(ids('Nidoran femelle')).toEqual([29]);
    expect(ids('nidoran♂')).toEqual([32]);
    expect(ids('nidoran m')).toEqual([32]);
  });

  it('prefers the chosen language when matches are otherwise equal', () => {
    const two = createSearch([
      pokemon({ id: 1, nameFr: 'Salade', nameEn: 'Pomme' }),
      pokemon({ id: 2, nameFr: 'Poire', nameEn: 'Salade' }),
    ]);
    expect(two('salade', { lang: 'fr' }).map((p) => p.id)).toEqual([1, 2]);
    expect(two('salade', { lang: 'en' }).map((p) => p.id)).toEqual([2, 1]);
    expect(two('salade').map((p) => p.id)).toEqual([1, 2]); // French by default
  });

  it('does not let the language hide a better match', () => {
    const two = createSearch([
      pokemon({ id: 1, nameFr: 'Salades', nameEn: 'Pomme' }), // prefix, French
      pokemon({ id: 2, nameFr: 'Poire', nameEn: 'Salade' }), // exact, English
    ]);
    expect(two('salade', { lang: 'fr' }).map((p) => p.id)).toEqual([2, 1]);
  });

  it('honours the limit', () => {
    expect(ids('i', { limit: 3 })).toHaveLength(3);
    expect(ids('i', { limit: 0 })).toEqual([]);
  });

  it('breaks ties by national number', () => {
    const twins = createSearch([
      pokemon({ id: 9, nameFr: 'Tata', nameEn: 'A' }),
      pokemon({ id: 3, nameFr: 'Titi', nameEn: 'B' }),
    ]);
    expect(twins('t').map((p) => p.id)).toEqual([3, 9]);
  });

  it('has a one-shot form', () => {
    expect(search(dex, 'zapdos').map((p) => p.id)).toEqual([145]);
  });
});
