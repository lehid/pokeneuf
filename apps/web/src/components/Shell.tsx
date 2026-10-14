import { APP_NAME } from '@pokeneuf/core';
import type { ReactNode } from 'react';
import { fr } from '../i18n/fr';
import { SiteFooter } from './SiteFooter';

/** Page frame for every screen that is not the game itself. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-3 py-4 sm:max-w-2xl sm:px-6 sm:py-8">
      <header className="panel p-3">
        <h1 className="title-pixel text-base sm:text-xl">{APP_NAME}</h1>
        <p className="mt-1 text-xs text-lcd-soft">{fr.tagline}</p>
      </header>
      {children}
      <SiteFooter />
    </main>
  );
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col items-center gap-3 p-5 text-center" role="status">
      <h2 className="title-pixel text-sm">{title}</h2>
      {children}
    </section>
  );
}
