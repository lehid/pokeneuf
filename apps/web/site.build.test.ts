// @vitest-environment node
// Vite (esbuild) cannot run in the jsdom environment of the other tests.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('the built service worker', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pokeneuf-sw-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('has no free variable and routes the grids with a RegExp, never precached', async () => {
    const previous = process.env.VITE_BASE;
    process.env.VITE_BASE = '/pokeneuf/';
    try {
      await build({
        root: here,
        configFile: path.join(here, 'vite.config.ts'),
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true },
      });
    } finally {
      if (previous === undefined) delete process.env.VITE_BASE;
      else process.env.VITE_BASE = previous;
    }
    const sw = readFileSync(path.join(outDir, 'sw.js'), 'utf8');
    // The minifier would have named the closure's variable `base2`, which does not exist in the worker.
    expect(sw).not.toMatch(/\bbase2\b/);
    expect(sw).not.toContain('startsWith');
    // The grids route is a regex built from the escaped base, handled by NetworkOnly.
    expect(sw).toMatch(/registerRoute\(\/\^https\?:\\\/\\\/\[\^\/\]\+\\\/pokeneuf\\\/grids\\\//);
    expect(sw).toContain('NetworkOnly');
    // And no grid is in the precache list.
    expect(sw).not.toMatch(/grids\/\d{4}-\d{2}-\d{2}\.json/);
    expect(existsSync(path.join(outDir, 'manifest.webmanifest'))).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.webmanifest'), 'utf8'));
    expect(manifest).not.toHaveProperty('orientation');
    expect(manifest.scope).toBe('/pokeneuf/');
  }, 180_000);
});
