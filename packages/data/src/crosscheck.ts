import type { EvolutionMethod, Pokedex, Pokemon } from '@pokeneuf/core';

/** What we read from one entry of Pokémon Showdown's `data/pokedex.ts`. */
export interface ShowdownEntry {
  num: number;
  name: string;
  types: string[];
  baseStats: Record<string, number>;
  heightm: number;
  weightkg: number;
  color: string;
  prevo: string | null;
  /** How it evolves from `prevo`: `useItem`, `trade`, `levelFriendship`… (absent = plain level). */
  evoType: string | null;
  evos: string[];
  /** `Mythical`, `Sub-Legendary`, `Restricted Legendary`… */
  tags: string[];
  baseSpecies: string | null;
  forme: string | null;
  canGigantamax: boolean;
}

const BLOCK = /^\t(\w+): \{\n([\s\S]*?)\n\t\},?$/gm;
const PROPERTY = /^\t\t(\w+): (.+?),?$/gm;

function jsonValue(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // multi-line or non-JSON value: we do not need it
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numbers(raw: string | undefined): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [, key, value] of (raw ?? '').matchAll(/(\w+): (\d+)/g)) {
    if (key !== undefined && value !== undefined) stats[key] = Number(value);
  }
  return stats;
}

/**
 * Reads every entry of Showdown's `pokedex.ts`, forms included (they carry `baseSpecies`/`forme`).
 * A line-based reader on purpose: the file is generated, regular, and we only need a few keys.
 */
export function parseShowdownPokedex(source: string): ShowdownEntry[] {
  const entries: ShowdownEntry[] = [];
  for (const [, , body] of source.matchAll(BLOCK)) {
    const raw = new Map<string, string>();
    for (const [, key, value] of (body ?? '').matchAll(PROPERTY)) {
      if (key !== undefined && value !== undefined) raw.set(key, value);
    }
    const num = Number(raw.get('num'));
    const name = text(jsonValue(raw.get('name')));
    if (!Number.isInteger(num) || name === null) continue;

    const strings = (key: string): string[] => {
      const value = jsonValue(raw.get(key));
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    };
    entries.push({
      num,
      name,
      types: strings('types'),
      baseStats: numbers(raw.get('baseStats')),
      heightm: Number(raw.get('heightm')),
      weightkg: Number(raw.get('weightkg')),
      color: text(jsonValue(raw.get('color'))) ?? '',
      prevo: text(jsonValue(raw.get('prevo'))),
      evoType: text(jsonValue(raw.get('evoType'))),
      evos: strings('evos'),
      tags: strings('tags'),
      baseSpecies: text(jsonValue(raw.get('baseSpecies'))),
      forme: text(jsonValue(raw.get('forme'))),
      canGigantamax: raw.has('canGigantamax'),
    });
  }
  return entries;
}

const STAT_KEYS = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  specialAttack: 'spa',
  specialDefense: 'spd',
  speed: 'spe',
} as const;

/** Showdown's `evoType` expressed in our vocabulary (`EvolutionMethod`). */
function methodOf(evoType: string | null): EvolutionMethod {
  switch (evoType) {
    case null:
      return 'level';
    case 'useItem':
      return 'stone';
    case 'trade':
      return 'trade';
    case 'levelFriendship':
      return 'friendship';
    default:
      return 'other'; // levelHold, levelMove, levelExtra, other
  }
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Compares our Pokédex with an independent source (Pokémon Showdown) and returns one line per
 * disagreement: types, base stats, size, colour, evolution links, how each evolution happens, the
 * legendary / mythical flags, Mega and Gigantamax forms. Empty when both sources agree.
 *
 * Showdown knows ONE method per evolution while we list every way the current games allow
 * (Magneton: location AND Thunder Stone), so methods are checked one way only: the method Showdown
 * gives must be among ours. Showdown is only a witness: when they differ, find out who is
 * right, then fix ours through `data/overrides.json` (with a golden fact) or leave a note here.
 */
export function crossCheckShowdown(pokedex: Pokedex, source: string): string[] {
  const entries = parseShowdownPokedex(source);
  const maxId = pokedex.pokemon.length;
  const bases = new Map<number, ShowdownEntry>();
  const numByName = new Map<string, number>();
  const megas = new Set<number>();
  const gmaxes = new Set<number>();

  for (const entry of entries) {
    numByName.set(entry.name, entry.num);
    if (entry.baseSpecies === null) bases.set(entry.num, entry);
    else if (entry.forme?.startsWith('Mega')) megas.add(entry.num);
    else if (entry.forme === 'Gmax') gmaxes.add(entry.num);
    if (entry.canGigantamax) gmaxes.add(entry.num);
  }

  /** Showdown names → national numbers, regional forms folded into their base species. */
  const toNums = (names: string[]): number[] =>
    [...new Set(names.map((name) => numByName.get(name)).filter((n) => n !== undefined))]
      .filter((n) => n <= maxId)
      .sort((a, b) => a - b);

  const problems: string[] = [];
  const check = (p: Pokemon, field: string, ours: unknown, theirs: unknown, same: boolean) => {
    if (!same) {
      problems.push(
        `#${p.id} ${p.slug}: ${field} ${JSON.stringify(ours)} (PokeAPI) vs ${JSON.stringify(theirs)} (Showdown)`,
      );
    }
  };

  for (const p of pokedex.pokemon) {
    const sd = bases.get(p.id);
    if (!sd) {
      problems.push(`#${p.id} ${p.slug}: not found in Showdown`);
      continue;
    }

    const types = sd.types.map((t) => t.toLowerCase());
    check(p, 'types', p.types, types, sameList(p.types, types));

    for (const [ours, theirs] of Object.entries(STAT_KEYS)) {
      const value = p.baseStats[ours as keyof Pokemon['baseStats']];
      check(p, `baseStats.${ours}`, value, sd.baseStats[theirs], value === sd.baseStats[theirs]);
    }

    const height = Math.round(sd.heightm * 10);
    const weight = Math.round(sd.weightkg * 10);
    check(p, 'heightDm', p.heightDm, height, p.heightDm === height);
    check(p, 'weightHg', p.weightHg, weight, p.weightHg === weight);
    check(p, 'color', p.color, sd.color.toLowerCase(), p.color === sd.color.toLowerCase());

    const to = toNums(sd.evos);
    check(p, 'evolvesToIds', p.evolution.evolvesToIds, to, sameList(p.evolution.evolvesToIds, to));
    const from = sd.prevo === null ? [] : toNums([sd.prevo]);
    const ourFrom = p.evolution.evolvesFromId === null ? [] : [p.evolution.evolvesFromId];
    check(p, 'evolvesFromId', ourFrom, from, sameList(ourFrom, from));

    check(
      p,
      'isLegendary',
      p.isLegendary,
      sd.tags.some((tag) => tag === 'Sub-Legendary' || tag === 'Restricted Legendary'),
      p.isLegendary ===
        sd.tags.some((tag) => tag === 'Sub-Legendary' || tag === 'Restricted Legendary'),
    );
    check(
      p,
      'isMythical',
      p.isMythical,
      sd.tags.includes('Mythical'),
      p.isMythical === sd.tags.includes('Mythical'),
    );

    const parent = pokedex.pokemon.find((q) => q.id === p.evolution.evolvesFromId);
    if (parent) {
      const method = methodOf(sd.evoType);
      if (!parent.evolution.methods.includes(method)) {
        problems.push(
          `#${p.id} ${p.slug}: Showdown evolves it from #${parent.id} by "${method}" but PokeAPI lists ${JSON.stringify(parent.evolution.methods)} for #${parent.id}`,
        );
      }
    }

    check(p, 'hasMega', p.hasMega, megas.has(p.id), p.hasMega === megas.has(p.id));
    check(p, 'hasGmax', p.hasGmax, gmaxes.has(p.id), p.hasGmax === gmaxes.has(p.id));
  }
  return problems;
}
