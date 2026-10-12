import type { Pokedex, Pokemon } from '@pokeneuf/core';

/**
 * Required values that are empty (`''`, NaN, null where null is not meaningful). The schema already
 * rejects these, so a non-empty result means the schema and the report disagree: a bug to look at.
 */
export function findMissingFields(pokedex: Pokedex): Record<string, number> {
  const missing: Record<string, number> = {};
  const flag = (field: string) => {
    missing[field] = (missing[field] ?? 0) + 1;
  };
  const empty = (value: unknown) =>
    value === undefined || value === null || value === '' || Number.isNaN(value);

  for (const p of pokedex.pokemon) {
    const { evolution, ...flat } = p;
    for (const [key, value] of Object.entries(flat)) if (empty(value)) flag(key);
    if (p.types.length === 0) flag('types');
    if (p.abilities.length === 0) flag('abilities');
    // evolvesFromId / evolutionAddedInGen are legitimately null for a Pokémon without pre-evolution.
    if (empty(evolution.stage)) flag('evolution.stage');
  }
  return missing;
}

function count(pokedex: Pokedex, predicate: (p: Pokemon) => boolean): number {
  return pokedex.pokemon.filter(predicate).length;
}

export function formatReport(pokedex: Pokedex, warnings: string[] = []): string {
  const { meta } = pokedex;
  const perGeneration = new Map<number, number>();
  for (const p of pokedex.pokemon) {
    perGeneration.set(p.generation, (perGeneration.get(p.generation) ?? 0) + 1);
  }
  const missing = Object.entries(findMissingFields(pokedex));

  const lines = [
    `Pokédex: ${meta.count} entries (Gen 1-${meta.maxGen}) from ${meta.source}@${meta.sourceSha.slice(0, 7)}`,
    '',
    'Entries per generation:',
    ...[...perGeneration].sort(([a], [b]) => a - b).map(([gen, n]) => `  Gen ${gen}: ${n}`),
    '',
    'Flags:',
    `  baby ${count(pokedex, (p) => p.isBaby)}, legendary ${count(pokedex, (p) => p.isLegendary)}, mythical ${count(pokedex, (p) => p.isMythical)}`,
    `  starter ${count(pokedex, (p) => p.isStarter)}, fossil ${count(pokedex, (p) => p.isFossil)}, pseudo-legendary ${count(pokedex, (p) => p.isPseudoLegendary)}`,
    `  mega ${count(pokedex, (p) => p.hasMega)}, gmax ${count(pokedex, (p) => p.hasGmax)}`,
    '',
    'Evolution:',
    `  final ${count(pokedex, (p) => p.evolution.isFinal)}, branched ${count(pokedex, (p) => p.evolution.branched)}, no line at all ${count(pokedex, (p) => p.evolution.isFinal && p.evolution.stage === 1)}`,
    '',
    missing.length === 0
      ? 'Missing fields: none'
      : `Missing fields: ${missing.map(([field, n]) => `${field} (${n})`).join(', ')}`,
  ];
  if (warnings.length > 0) {
    lines.push('', `Warnings (${warnings.length}):`, ...warnings.map((w) => `  ! ${w}`));
  }
  return lines.join('\n');
}
