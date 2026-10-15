// @vitest-environment node
// Vite (esbuild) cannot run in the jsdom environment of the other tests.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { frPreview } from './src/i18n/fr';

const here = path.dirname(fileURLToPath(import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Strings that only the review page (or its helpers) contain. */
const MARKERS = [
  'pokeneuf-grid-preview-dev-only',
  'preview-grid-',
  'preview:reviewed',
  'parsePreviewRoute',
  frPreview.title,
  frPreview.markReviewed,
  frPreview.devOnly,
];

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return statSync(file).isDirectory() ? filesIn(file) : [file];
  });
}

/** Builds the site into a fresh folder and returns the text of every file that is not a font. */
async function buildSite(nodeEnv: 'production' | 'development'): Promise<Map<string, string>> {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pokeneuf-preview-'));
  dirs.push(outDir);
  const previous = { env: process.env.NODE_ENV, base: process.env.VITE_BASE };
  // Vitest runs with NODE_ENV=test: ask for what a real `vite build` (production) or a dev build is.
  process.env.NODE_ENV = nodeEnv;
  delete process.env.VITE_BASE;
  try {
    await build({
      root: here,
      configFile: path.join(here, 'vite.config.ts'),
      logLevel: 'silent',
      mode: nodeEnv,
      build: { outDir, emptyOutDir: true, minify: false },
    });
  } finally {
    if (previous.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.env;
    if (previous.base !== undefined) process.env.VITE_BASE = previous.base;
  }
  return new Map(
    filesIn(outDir)
      .filter((file) => /\.(js|html|css|webmanifest|json)$/.test(file))
      .map((file) => [path.relative(outDir, file), readFileSync(file, 'utf8')]),
  );
}

describe('the grid review page (/preview) is development only', () => {
  it('is in a development build (so the check below can see it)', async () => {
    const files = await buildSite('development');
    const text = [...files.values()].join('\n');
    for (const marker of MARKERS) expect(text, marker).toContain(marker);
  }, 180_000);

  it('is nowhere in the production build: no chunk, no strings, no route', async () => {
    const files = await buildSite('production');
    expect(files.size).toBeGreaterThan(3);
    for (const [name, text] of files) {
      for (const marker of MARKERS)
        expect(text, `${name} contains "${marker}"`).not.toContain(marker);
    }
    // No chunk of its own either: the app ships a main chunk, React and the Pokédex.
    const scripts = [...files.keys()].filter((name) => name.endsWith('.js'));
    expect(scripts.some((name) => /preview/i.test(name))).toBe(false);
  }, 180_000);
});
