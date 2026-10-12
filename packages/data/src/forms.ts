import type { RawTables } from './download';
import type { ManualLists } from './manual';

function sorted(ids: Iterable<number>): number[] {
  return [...ids].sort((a, b) => a - b);
}

function difference(a: Set<number>, b: Set<number>): number[] {
  return sorted([...a].filter((id) => !b.has(id)));
}

/**
 * Compares the manual Mega / Gigamax lists with what PokeAPI says (`pokemon_forms`), for the
 * species in scope. Returns human-readable mismatches: empty when the lists agree with the source.
 * A mismatch is not necessarily a mistake (the source can be wrong), but it must be a decision.
 */
export function crossCheckForms(tables: RawTables, manual: ManualLists, maxGen: number): string[] {
  const speciesOfPokemon = new Map(
    tables.pokemon.map((row) => [row['id'] ?? '', Number(row['species_id'])]),
  );
  const inScope = new Set(
    tables.pokemon_species
      .filter((row) => Number(row['generation_id']) <= maxGen)
      .map((row) => Number(row['id'])),
  );

  const fromSource = { mega: new Set<number>(), gmax: new Set<number>() };
  for (const form of tables.pokemon_forms) {
    const speciesId = speciesOfPokemon.get(form['pokemon_id'] ?? '');
    if (speciesId === undefined || !inScope.has(speciesId)) continue;
    if (form['is_mega'] === '1') fromSource.mega.add(speciesId);
    if (form['form_identifier'] === 'gmax') fromSource.gmax.add(speciesId);
  }

  const problems: string[] = [];
  for (const kind of ['mega', 'gmax'] as const) {
    const listed = new Set(manual[kind]);
    const missing = difference(fromSource[kind], listed);
    const extra = difference(listed, fromSource[kind]);
    if (missing.length > 0) {
      problems.push(
        `${kind}.json lacks ids that PokeAPI has a ${kind} form for: ${missing.join(', ')}`,
      );
    }
    if (extra.length > 0) {
      problems.push(
        `${kind}.json lists ids that PokeAPI has no ${kind} form for: ${extra.join(', ')}`,
      );
    }
  }
  return problems;
}
