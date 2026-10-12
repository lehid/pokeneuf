import { APP_NAME, gridDateFor, gridNumber } from '@pokeneuf/core';
import { fr } from './i18n/fr';

export function App() {
  const n = gridNumber(gridDateFor(new Date()));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold">
        {APP_NAME} — {fr.comingSoon}
      </h1>
      <p className="text-lg">{fr.tagline}</p>
      {n > 0 && <p className="text-sm opacity-70">{fr.todayGrid(n)}</p>}
      <footer className="mt-8 text-xs opacity-60">{fr.disclaimer}</footer>
    </main>
  );
}
