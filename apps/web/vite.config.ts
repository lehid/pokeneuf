/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site under /<repo>/ — the deploy workflow sets VITE_BASE.
// With a custom domain, set VITE_BASE=/ instead.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
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
