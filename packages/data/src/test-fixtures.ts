import { POKEMON_TYPES } from '@pokeneuf/core';
import type { BuildOptions } from './build';
import type { CsvRow } from './csv';
import type { RawTables } from './download';
import type { ManualLists } from './manual';

/** Compact description of a species; everything else gets a harmless default. */
export interface FakeSpecies {
  id: number;
  generation?: number;
  slug?: string;
  /** `evolves_from_species_id`. */
  from?: number;
  /** Type slugs, primary first. */
  types?: string[];
  isBaby?: boolean;
  isLegendary?: boolean;
  isMythical?: boolean;
  /** `null` removes the French name. */
  nameFr?: string | null;
}

/** One `pokemon_evolution` row leading INTO `into`. */
export interface FakeEvolution {
  into: number;
  /** `evolution_triggers.identifier`, default `level-up`. */
  trigger?: string;
  /** Extra columns, e.g. `{ minimum_level: '16', region_id: '7' }`. */
  columns?: Record<string, string>;
}

const TRIGGERS = ['level-up', 'trade', 'use-item', 'shed'];

const row = (values: Record<string, string | number>): CsvRow =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));

/** In-memory PokeAPI tables, just rich enough for `buildPokedex`. */
export function fakeTables(species: FakeSpecies[], evolutions: FakeEvolution[] = []): RawTables {
  const typeIds = new Map<string, number>(POKEMON_TYPES.map((type, i) => [type, i + 1]));
  typeIds.set('shadow', 10002);

  const tables: RawTables = {
    abilities: [row({ id: 1, identifier: 'static' })],
    ability_names: [row({ ability_id: 1, local_language_id: 5, name: 'Statik' })],
    evolution_triggers: TRIGGERS.map((identifier, i) => row({ id: i + 1, identifier })),
    languages: [
      row({ id: 5, identifier: 'fr' }),
      row({ id: 9, identifier: 'en' }),
      row({ id: 1, identifier: 'ja' }),
    ],
    pokemon: [],
    pokemon_abilities: [],
    pokemon_colors: [row({ id: 1, identifier: 'black' })],
    pokemon_evolution: evolutions.map((evolution, i) =>
      row({
        id: i + 1,
        evolved_species_id: evolution.into,
        evolution_trigger_id: TRIGGERS.indexOf(evolution.trigger ?? 'level-up') + 1,
        // A `use-item` row is a Thunder Stone unless the test says otherwise.
        ...(evolution.trigger === 'use-item' ? { trigger_item_id: 83 } : {}),
        ...evolution.columns,
      }),
    ),
    pokemon_forms: [],
    pokemon_shapes: [row({ id: 1, identifier: 'ball' })],
    pokemon_species: [],
    pokemon_species_names: [],
    pokemon_stats: [],
    pokemon_types: [],
    stats: [
      row({ id: 1, identifier: 'hp' }),
      row({ id: 2, identifier: 'attack' }),
      row({ id: 3, identifier: 'defense' }),
      row({ id: 4, identifier: 'special-attack' }),
      row({ id: 5, identifier: 'special-defense' }),
      row({ id: 6, identifier: 'speed' }),
    ],
    types: [...typeIds].map(([identifier, id]) => row({ id, identifier })),
  };

  for (const s of species) {
    const slug = s.slug ?? `species-${s.id}`;
    tables.pokemon_species.push(
      row({
        id: s.id,
        identifier: slug,
        generation_id: s.generation ?? 1,
        evolves_from_species_id: s.from ?? '',
        color_id: 1,
        shape_id: 1,
        is_baby: s.isBaby ? 1 : 0,
        is_legendary: s.isLegendary ? 1 : 0,
        is_mythical: s.isMythical ? 1 : 0,
      }),
    );
    if (s.nameFr !== null) {
      tables.pokemon_species_names.push(
        row({ pokemon_species_id: s.id, local_language_id: 5, name: s.nameFr ?? `FR ${slug}` }),
      );
    }
    tables.pokemon_species_names.push(
      row({ pokemon_species_id: s.id, local_language_id: 9, name: `EN ${slug}` }),
    );
    tables.pokemon.push(
      row({ id: s.id, species_id: s.id, height: 10, weight: 100, is_default: 1 }),
    );
    tables.pokemon_forms.push(row({ id: s.id, pokemon_id: s.id, is_default: 1, is_mega: 0 }));
    (s.types ?? ['normal']).forEach((type, i) =>
      tables.pokemon_types.push(
        row({ pokemon_id: s.id, type_id: typeIds.get(type) ?? 0, slot: i + 1 }),
      ),
    );
    for (const statId of [1, 2, 3, 4, 5, 6]) {
      tables.pokemon_stats.push(row({ pokemon_id: s.id, stat_id: statId, base_stat: 50 }));
    }
    tables.pokemon_abilities.push(row({ pokemon_id: s.id, ability_id: 1, is_hidden: 0, slot: 1 }));
  }
  return tables;
}

export function emptyManual(): ManualLists {
  return {
    starters: [],
    fossils: [],
    pseudoLegendaries: [],
    mega: [],
    gmax: [],
    popular: [],
    aliases: {},
  };
}

export function buildOptions(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return { maxGen: 4, sourceSha: 'a'.repeat(40), manual: emptyManual(), ...overrides };
}
