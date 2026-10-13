import { SHOWDOWN_CACHE_FILE, SHOWDOWN_POKEDEX_URL, SHOWDOWN_SHA } from './config';
import { crossCheckShowdown } from './crosscheck';
import { readCachedText } from './download';
import { runPipeline } from './pipeline';

const { pokedex } = await runPipeline({ write: false });
const source = await readCachedText(SHOWDOWN_CACHE_FILE, SHOWDOWN_POKEDEX_URL);
const problems = crossCheckShowdown(pokedex, source);

console.log(
  `Cross-check PokeAPI@${pokedex.meta.sourceSha.slice(0, 7)} vs Showdown@${SHOWDOWN_SHA.slice(0, 7)}: ` +
    `${pokedex.pokemon.length} Pokémon, ${problems.length} difference(s)`,
);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
