import { APP_NAME } from '@pokeneuf/core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME as BUILD_APP_NAME, pwaOptions, SITE, siteUrl, socialTags } from './site.config';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = (file: string) => readFileSync(path.join(here, file), 'utf8');

describe('site name', () => {
  it('is the APP_NAME of the core, read once for the whole build', () => {
    expect(BUILD_APP_NAME).toBe(APP_NAME);
    expect(SITE.title).toContain(APP_NAME);
  });

  it('is never written by hand in the HTML entry points', () => {
    for (const file of ['./index.html', './404.html']) {
      expect(html(file), file).not.toContain(APP_NAME);
      expect(html(file), file).toContain('%APP_NAME%');
    }
  });

  it('is the name of the installed app', () => {
    const manifest = pwaOptions('/').manifest;
    expect(manifest && manifest.name).toBe(APP_NAME);
    expect(manifest && manifest.short_name).toBe(APP_NAME);
  });
});

describe('siteUrl', () => {
  it('is the base path without VITE_SITE_URL, and the public address (with a slash) with it', () => {
    expect(siteUrl('/pokeneuf/', {})).toBe('/pokeneuf/');
    expect(siteUrl('/pokeneuf/', { VITE_SITE_URL: ' ' })).toBe('/pokeneuf/');
    expect(siteUrl('/', { VITE_SITE_URL: 'https://lehid.github.io/pokeneuf' })).toBe(
      'https://lehid.github.io/pokeneuf/',
    );
    expect(siteUrl('/', { VITE_SITE_URL: 'https://example.org/' })).toBe('https://example.org/');
  });
});

describe('link previews', () => {
  const content = (tags: ReturnType<typeof socialTags>, name: string) =>
    tags.find((t) => t.attrs?.property === name || t.attrs?.name === name)?.attrs?.content;

  it('has Open Graph and Twitter tags, with the image under the public address', () => {
    const tags = socialTags('https://lehid.github.io/pokeneuf/', true);
    expect(content(tags, 'og:title')).toBe(SITE.title);
    expect(content(tags, 'og:description')).toBe(SITE.description);
    expect(content(tags, 'og:image')).toBe('https://lehid.github.io/pokeneuf/og-image.png');
    expect(content(tags, 'twitter:image')).toBe('https://lehid.github.io/pokeneuf/og-image.png');
    expect(content(tags, 'twitter:card')).toBe('summary_large_image');
    expect(content(tags, 'og:url')).toBe('https://lehid.github.io/pokeneuf/');
    expect(tags.find((t) => t.attrs?.rel === 'canonical')?.attrs?.href).toBe(
      'https://lehid.github.io/pokeneuf/',
    );
  });

  it('leaves the canonical address out, rather than guess it, without a public address', () => {
    const tags = socialTags('/', false);
    expect(content(tags, 'og:image')).toBe('/og-image.png');
    expect(content(tags, 'og:url')).toBeUndefined();
    expect(tags.some((t) => t.attrs?.rel === 'canonical')).toBe(false);
  });

  it('is described by the HTML entry point only through the plugin, not by hand', () => {
    expect(html('./index.html')).not.toContain('og:image');
  });
});

describe('pwaOptions', () => {
  for (const base of ['/', '/pokeneuf/']) {
    it(`serves the app shell only under ${base}, and never caches a grid`, () => {
      const options = pwaOptions(base);
      expect(options.manifest && options.manifest.start_url).toBe(base);
      expect(options.manifest && options.manifest.scope).toBe(base);
      const workbox = options.workbox;
      expect(workbox && workbox.globIgnores).toContain('grids/**');
      expect(workbox && workbox.navigateFallback).toBe(`${base}index.html`);
      expect(workbox && workbox.clientsClaim).toBe(true);
      expect(workbox && workbox.skipWaiting).toBe(true);
      const rule = workbox && workbox.runtimeCaching && workbox.runtimeCaching[0];
      expect(rule && rule.handler).toBe('NetworkOnly');
      const matches = rule && rule.urlPattern;
      if (typeof matches !== 'function') throw new Error('expected a matcher function');
      const request = (path: string) => ({ url: new URL(path, 'https://x.test') }) as never;
      expect(matches(request(`${base}grids/2026-11-01.json`))).toBe(true);
      expect(matches(request(`${base}grids/index.json`))).toBe(true);
      expect(matches(request(`${base}assets/index.js`))).toBe(false);
    });
  }
});
