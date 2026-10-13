import { describe, expect, it } from 'vitest';
import { crossCheckForms } from './forms';
import { emptyManual, fakeTables } from './test-fixtures';

function tables() {
  const t = fakeTables([{ id: 1 }, { id: 2 }, { id: 3, generation: 5 }]);
  // Species 1 has a Mega and a Gigantamax form, species 3 (Gen 5, out of scope) too.
  t.pokemon.push(
    { id: '10001', species_id: '1', is_default: '0' },
    { id: '10002', species_id: '1', is_default: '0' },
    { id: '10003', species_id: '3', is_default: '0' },
  );
  t.pokemon_forms.push(
    { id: '10001', pokemon_id: '10001', form_identifier: 'mega', is_mega: '1' },
    { id: '10002', pokemon_id: '10002', form_identifier: 'gmax', is_mega: '0' },
    { id: '10003', pokemon_id: '10003', form_identifier: 'mega', is_mega: '1' },
  );
  return t;
}

describe('crossCheckForms', () => {
  it('is silent when the manual lists match the source (out-of-scope species ignored)', () => {
    const manual = { ...emptyManual(), mega: [1], gmax: [1] };
    expect(crossCheckForms(tables(), manual, 4)).toEqual([]);
  });

  it('reports a species the source has a form for but the list lacks', () => {
    expect(crossCheckForms(tables(), emptyManual(), 4)).toEqual([
      'mega.json lacks ids that PokeAPI has a mega form for: 1',
      'gmax.json lacks ids that PokeAPI has a gmax form for: 1',
    ]);
  });

  it('reports a listed species the source has no form for', () => {
    const manual = { ...emptyManual(), mega: [1, 2], gmax: [1, 2] };
    expect(crossCheckForms(tables(), manual, 4)).toEqual([
      'mega.json lists ids that PokeAPI has no mega form for: 2',
      'gmax.json lists ids that PokeAPI has no gmax form for: 2',
    ]);
  });

  it('follows the scope: with maxGen 5 the Gen 5 Mega counts', () => {
    const manual = { ...emptyManual(), mega: [1], gmax: [1] };
    expect(crossCheckForms(tables(), manual, 5)).toEqual([
      'mega.json lacks ids that PokeAPI has a mega form for: 3',
    ]);
  });
});
