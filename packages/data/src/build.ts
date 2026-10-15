import {
  EVOLUTION_METHODS,
  POKEDEX_COLORS,
  POKEDEX_SHAPES,
  POKEMON_TYPES,
  type BaseStats,
  type EvolutionMethod,
  type Pokedex,
  type Pokemon,
  type PokemonAbility,
} from '@pokeneuf/core';
import { LANGUAGE_IDS, POKEAPI_REPO, SCHEMA_VERSION } from './config';
import type { CsvRow } from './csv';
import type { RawTables } from './download';
import type { ManualLists, Override } from './manual';
import { addPopularity } from './popularity';
import { parsePokedex } from './schema';

export interface BuildOptions {
  maxGen: number;
  sourceSha: string;
  manual: ManualLists;
  overrides?: Override[];
}

// ---------------------------------------------------------------------------------------------
// CSV helpers. Cells are strings; '' means "no value".

function cell(row: CsvRow, column: string): string {
  return row[column] ?? '';
}

function filled(row: CsvRow, column: string): boolean {
  return cell(row, column) !== '';
}

function int(row: CsvRow, column: string, context: string): number {
  const raw = cell(row, column);
  const value = Number(raw);
  if (raw === '' || !Number.isInteger(value)) {
    throw new Error(`${context}: column "${column}" should be an integer, found "${raw}"`);
  }
  return value;
}

function indexBy(rows: CsvRow[], column: string): Map<string, CsvRow> {
  return new Map(rows.map((row) => [cell(row, column), row]));
}

function groupBy(rows: CsvRow[], column: string): Map<string, CsvRow[]> {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = cell(row, column);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function oneOf<T extends string>(allowed: readonly T[], value: string, context: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new Error(`${context}: "${value}" is not one of ${allowed.join(', ')}`);
  }
  return match;
}

function assertLanguages(languages: CsvRow[]): void {
  const byId = indexBy(languages, 'id');
  for (const [code, id] of Object.entries(LANGUAGE_IDS)) {
    const found = byId.get(String(id));
    if (found === undefined || cell(found, 'identifier') !== code) {
      throw new Error(
        `languages.csv: id ${id} should be "${code}", found "${found ? cell(found, 'identifier') : 'nothing'}"`,
      );
    }
  }
}

function namesFor(rows: CsvRow[], idColumn: string, languageId: number): Map<number, string> {
  const names = new Map<number, string>();
  for (const row of rows) {
    if (cell(row, 'local_language_id') === String(languageId)) {
      names.set(int(row, idColumn, 'names'), cell(row, 'name'));
    }
  }
  return names;
}

// ---------------------------------------------------------------------------------------------
// Evolution methods.

/** Evolution conditions that make a level-up evolution "something else than a plain level". */
const OTHER_CONDITION_COLUMNS = [
  'trigger_item_id',
  'location_id',
  'held_item_id',
  'known_move_id',
  'known_move_type_id',
  'minimum_beauty',
  'party_species_id',
  'party_type_id',
  'trade_species_id',
  'used_move_id',
  'minimum_move_count',
  'minimum_steps',
  'minimum_damage_taken',
] as const;
/** Boolean columns: '0' means "not required". */
const OTHER_FLAG_COLUMNS = [
  'needs_overworld_rain',
  'turn_upside_down',
  'needs_multiplayer',
  'near_special_rock',
] as const;

/**
 * PokeAPI `items.id` of the evolution stones that matter in Gen 1–4: Sun, Moon, Fire, Thunder,
 * Water and Leaf Stones, Shiny, Dusk and Dawn Stones, Ice Stone. Any other item used to evolve
 * (Galarica Cuff / Wreath, Sweet Apple…) is "something else", not a stone.
 */
const STONE_ITEM_IDS: ReadonlySet<string> = new Set([
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '107',
  '108',
  '109',
  '885',
]);

function classifyEvolution(row: CsvRow, trigger: string): EvolutionMethod {
  if (trigger === 'use-item')
    return STONE_ITEM_IDS.has(cell(row, 'trigger_item_id')) ? 'stone' : 'other';
  if (trigger === 'trade') return 'trade';
  if (trigger !== 'level-up') return 'other'; // shed (Shedinja), spin, tower of darkness…

  if (filled(row, 'minimum_happiness') || filled(row, 'minimum_affection')) return 'friendship';

  // Gender, time of day, personality and the Attack/Defense comparison (`relative_physical_stats`,
  // Tyrogue) are intrinsic to the Pokémon: such an evolution is still "by level". Anything that
  // needs something external (item, move, place, party member…) is "other".
  const hasOtherCondition =
    OTHER_CONDITION_COLUMNS.some((column) => filled(row, column)) ||
    OTHER_FLAG_COLUMNS.some((column) => filled(row, column) && cell(row, column) !== '0');
  return filled(row, 'minimum_level') && !hasOtherCondition ? 'level' : 'other';
}

// ---------------------------------------------------------------------------------------------

interface SpeciesRow {
  id: number;
  generation: number;
  row: CsvRow;
}

/**
 * Builds the Pokédex from the raw PokeAPI tables. Pure: no I/O, same input → same output.
 * Throws on any missing or inconsistent datum rather than guessing.
 */
export function buildPokedex(tables: RawTables, options: BuildOptions): Pokedex {
  const { maxGen, manual } = options;
  assertLanguages(tables.languages);

  const species: SpeciesRow[] = tables.pokemon_species
    .map((row) => ({
      id: int(row, 'id', 'pokemon_species'),
      generation: int(row, 'generation_id', 'pokemon_species'),
      row,
    }))
    .filter((s) => s.generation <= maxGen)
    .sort((a, b) => a.id - b.id);
  const scope = new Set(species.map((s) => s.id));
  const generationOf = new Map(species.map((s) => [s.id, s.generation]));

  // Default form of every in-scope species (no regional or alternate forms in v1).
  const defaultForms = new Map<number, CsvRow>();
  for (const row of tables.pokemon) {
    if (cell(row, 'is_default') !== '1') continue;
    const speciesId = int(row, 'species_id', 'pokemon');
    if (defaultForms.has(speciesId)) throw new Error(`species ${speciesId} has two default forms`);
    defaultForms.set(speciesId, row);
  }

  const namesFr = namesFor(tables.pokemon_species_names, 'pokemon_species_id', LANGUAGE_IDS.fr);
  const namesEn = namesFor(tables.pokemon_species_names, 'pokemon_species_id', LANGUAGE_IDS.en);
  const abilityNamesFr = namesFor(tables.ability_names, 'ability_id', LANGUAGE_IDS.fr);

  const typeSlugs = indexBy(tables.types, 'id');
  const statSlugs = indexBy(tables.stats, 'id');
  const colorSlugs = indexBy(tables.pokemon_colors, 'id');
  const shapeSlugs = indexBy(tables.pokemon_shapes, 'id');
  const abilitySlugs = indexBy(tables.abilities, 'id');
  const triggerSlugs = indexBy(tables.evolution_triggers, 'id');
  const formsById = indexBy(tables.pokemon_forms, 'id');
  // `pokemon_forms.is_default` is "default form OF ITS OWN pokemon", so a regional form (Alolan
  // Sandslash, pokemon 10102) is "default" too. What decides is the `pokemon` the form belongs to.
  const defaultPokemonIds = new Set(
    tables.pokemon.filter((row) => cell(row, 'is_default') === '1').map((row) => cell(row, 'id')),
  );
  const isSpeciesDefaultForm = (formId: string): boolean => {
    if (formId === '') return true;
    const form = formsById.get(formId);
    return form === undefined || defaultPokemonIds.has(cell(form, 'pokemon_id'));
  };

  const typesByPokemon = groupBy(tables.pokemon_types, 'pokemon_id');
  const statsByPokemon = groupBy(tables.pokemon_stats, 'pokemon_id');
  const abilitiesByPokemon = groupBy(tables.pokemon_abilities, 'pokemon_id');
  const evolutionsInto = groupBy(tables.pokemon_evolution, 'evolved_species_id');

  // --- Evolution graph, relative to the scope. -------------------------------------------------
  const evolvesFrom = new Map<number, number | null>();
  const evolvesTo = new Map<number, number[]>(species.map((s) => [s.id, []]));
  for (const { id, row } of species) {
    const raw = cell(row, 'evolves_from_species_id');
    const parent = raw === '' ? null : int(row, 'evolves_from_species_id', `species ${id}`);
    const inScope = parent !== null && scope.has(parent) ? parent : null;
    evolvesFrom.set(id, inScope);
    if (inScope !== null) evolvesTo.get(inScope)?.push(id);
  }
  for (const children of evolvesTo.values()) children.sort((a, b) => a - b);

  function stageOf(id: number): number {
    let stage = 1;
    for (let at = evolvesFrom.get(id) ?? null; at !== null; at = evolvesFrom.get(at) ?? null) {
      if (++stage > 6) throw new Error(`species ${id}: evolution chain loops or is too deep`);
    }
    return stage;
  }

  /** Rows of `pokemon_evolution` that describe the default form's own evolution. */
  function defaultFormRows(speciesId: number): CsvRow[] {
    return (evolutionsInto.get(String(speciesId)) ?? []).filter((row) => {
      if (filled(row, 'region_id')) return false; // Alola / Galar / Hisui variants
      return (
        isSpeciesDefaultForm(cell(row, 'evolved_pokemon_form_id')) &&
        isSpeciesDefaultForm(cell(row, 'required_pokemon_form_id'))
      );
    });
  }

  /** How the species is reached from its pre-evolution (empty when it has none in scope). */
  function incomingMethods(speciesId: number): EvolutionMethod[] {
    if (evolvesFrom.get(speciesId) === null) return [];
    const rows = defaultFormRows(speciesId);
    if (rows.length === 0) {
      throw new Error(
        `species ${speciesId}: evolves from another species but no usable evolution row`,
      );
    }
    return rows.map((row) => {
      const trigger = triggerSlugs.get(cell(row, 'evolution_trigger_id'));
      if (trigger === undefined) throw new Error(`species ${speciesId}: unknown evolution trigger`);
      return classifyEvolution(row, cell(trigger, 'identifier'));
    });
  }

  function outgoingMethods(speciesId: number): EvolutionMethod[] {
    const used = new Set((evolvesTo.get(speciesId) ?? []).flatMap(incomingMethods));
    return EVOLUTION_METHODS.filter((method) => used.has(method));
  }

  // --- Manual lists (checked against the scope: no silent drop). --------------------------------
  const lists = {
    starters: new Set(manual.starters),
    fossils: new Set(manual.fossils),
    pseudoLegendaries: new Set(manual.pseudoLegendaries),
    mega: new Set(manual.mega),
    gmax: new Set(manual.gmax),
    popular: new Set(manual.popular),
  };
  for (const [name, ids] of Object.entries(lists)) {
    const source = manual[name as keyof typeof lists];
    if (ids.size !== source.length) throw new Error(`data/manual/${name}.json has duplicate ids`);
    const outside = source.filter((id) => !scope.has(id));
    if (outside.length > 0) {
      throw new Error(
        `data/manual/${name}.json lists ids outside Gen 1-${maxGen}: ${outside.join(', ')}`,
      );
    }
  }
  const outsideAliases = Object.keys(manual.aliases)
    .map(Number)
    .filter((id) => !scope.has(id));
  if (outsideAliases.length > 0) {
    throw new Error(
      `data/manual/aliases.json has ids outside Gen 1-${maxGen}: ${outsideAliases.join(', ')}`,
    );
  }

  // --- Entries. ---------------------------------------------------------------------------------
  const unscored: Omit<Pokemon, 'pop'>[] = species.map(({ id, generation, row }) => {
    const who = `species ${id}`;
    const form = defaultForms.get(id);
    if (!form) throw new Error(`${who}: no default form in pokemon.csv`);
    const pokemonId = cell(form, 'id');

    const nameFr = namesFr.get(id);
    const nameEn = namesEn.get(id);
    if (!nameFr || !nameEn) throw new Error(`${who}: missing French or English name`);

    const types = (typesByPokemon.get(pokemonId) ?? [])
      .sort((a, b) => int(a, 'slot', who) - int(b, 'slot', who))
      .map((typeRow) => {
        const type = typeSlugs.get(cell(typeRow, 'type_id'));
        return oneOf(POKEMON_TYPES, type ? cell(type, 'identifier') : '', `${who}: type`);
      });

    const stats: Partial<Record<string, number>> = {};
    for (const statRow of statsByPokemon.get(pokemonId) ?? []) {
      const stat = statSlugs.get(cell(statRow, 'stat_id'));
      if (stat) stats[cell(stat, 'identifier')] = int(statRow, 'base_stat', who);
    }
    const baseStat = (slug: string): number => {
      const value = stats[slug];
      if (value === undefined) throw new Error(`${who}: missing base stat "${slug}"`);
      return value;
    };
    const baseStats: BaseStats = {
      hp: baseStat('hp'),
      attack: baseStat('attack'),
      defense: baseStat('defense'),
      specialAttack: baseStat('special-attack'),
      specialDefense: baseStat('special-defense'),
      speed: baseStat('speed'),
    };

    const abilities: PokemonAbility[] = (abilitiesByPokemon.get(pokemonId) ?? [])
      .sort((a, b) => int(a, 'slot', who) - int(b, 'slot', who))
      .map((abilityRow) => {
        const abilityId = int(abilityRow, 'ability_id', who);
        const ability = abilitySlugs.get(String(abilityId));
        const nameFrAbility = abilityNamesFr.get(abilityId);
        if (!ability || !nameFrAbility)
          throw new Error(`${who}: ability ${abilityId} has no French name`);
        return {
          slug: cell(ability, 'identifier'),
          nameFr: nameFrAbility,
          isHidden: cell(abilityRow, 'is_hidden') === '1',
        };
      });

    const color = colorSlugs.get(cell(row, 'color_id'));
    const shape = shapeSlugs.get(cell(row, 'shape_id'));
    const from = evolvesFrom.get(id) ?? null;
    const to = evolvesTo.get(id) ?? [];
    const fromGeneration = from === null ? null : (generationOf.get(from) ?? null);

    return {
      id,
      slug: cell(row, 'identifier'),
      nameFr,
      nameEn,
      aliases: manual.aliases[id] ?? [],
      generation,
      types,
      baseStats,
      abilities,
      evolution: {
        stage: stageOf(id),
        isFinal: to.length === 0,
        evolvesFromId: from,
        evolvesToIds: to,
        methods: outgoingMethods(id),
        branched: to.length > 1,
        evolutionAddedInGen: fromGeneration === null ? null : Math.max(generation, fromGeneration),
      },
      isBaby: cell(row, 'is_baby') === '1',
      isLegendary: cell(row, 'is_legendary') === '1',
      isMythical: cell(row, 'is_mythical') === '1',
      isStarter: lists.starters.has(id),
      isFossil: lists.fossils.has(id),
      isPseudoLegendary: lists.pseudoLegendaries.has(id),
      color: oneOf(POKEDEX_COLORS, color ? cell(color, 'identifier') : '', `${who}: color`),
      shape: oneOf(POKEDEX_SHAPES, shape ? cell(shape, 'identifier') : '', `${who}: shape`),
      heightDm: int(form, 'height', who),
      weightHg: int(form, 'weight', who),
      hasMega: lists.mega.has(id),
      hasGmax: lists.gmax.has(id),
    };
  });

  const entries = addPopularity(unscored, manual.popular);

  const raw = applyOverrides(
    {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        source: POKEAPI_REPO,
        sourceSha: options.sourceSha,
        maxGen,
        count: entries.length,
      },
      pokemon: entries,
    },
    options.overrides ?? [],
  );
  return parsePokedex(raw);
}

// ---------------------------------------------------------------------------------------------
// Overrides.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objects merge key by key; arrays and scalars are replaced. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) merged[key] = deepMerge(base[key], value);
  return merged;
}

function applyOverrides(pokedex: Pokedex, overrides: Override[]): unknown {
  if (overrides.length === 0) return pokedex;
  const patched: unknown[] = [...pokedex.pokemon];
  for (const override of overrides) {
    const index = pokedex.pokemon.findIndex((p) => p.id === override.id);
    if (index === -1) throw new Error(`overrides.json: no Pokémon with id ${override.id}`);
    patched[index] = deepMerge(patched[index], override.set);
  }
  return { ...pokedex, pokemon: patched };
}
