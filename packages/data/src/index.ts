// Phase 1: Pokédex data pipeline (PokeAPI CSV → dist/pokedex.json). See ROADMAP §3.3.
import { MAX_GEN } from '@pokeneuf/core';

export const DATA_SCOPE = { maxGen: MAX_GEN } as const;
