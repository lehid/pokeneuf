/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { htmlPlaceholders, pwaOptions } from './site.config';

// GitHub Pages serves the site under /<repo>/ — the deploy workflow sets VITE_BASE.
// With a custom domain, set VITE_BASE=/ instead.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [htmlPlaceholders(base), react(), tailwindcss(), VitePWA(pwaOptions(base))],
  build: {
    rollupOptions: {
      // `404.html` is what GitHub Pages serves for an unknown path.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
      output: {
        // The Pokédex (data, changes with `data:build`) and React (changes with upgrades) rarely
        // move: kept out of the app chunk so a code change does not invalidate them.
        manualChunks(id) {
          if (id.includes('/packages/data/dist/')) return 'pokedex';
          if (/node_modules\/(\.pnpm\/)?(react|react-dom|scheduler)[@/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  resolve: {
    // The Pokédex and memberships built by `pnpm data:build` (gitignored), bundled with the app.
    alias: { '@data': fileURLToPath(new URL('../../packages/data/dist', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
