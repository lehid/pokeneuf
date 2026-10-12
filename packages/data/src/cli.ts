import { gzipSync } from 'node:zlib';
import { MEMBERSHIPS_PATH, POKEDEX_PATH } from './config';
import { runPipeline } from './pipeline';

const { json, membershipsJson, report } = await runPipeline();

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(report);
console.log(
  `\nWrote ${POKEDEX_PATH} (${kb(Buffer.byteLength(json))}, ${kb(gzipSync(json).length)} gzip)`,
);
console.log(`Wrote ${MEMBERSHIPS_PATH} (${kb(Buffer.byteLength(membershipsJson))})`);
