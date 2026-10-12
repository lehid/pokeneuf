/** All French UI strings. Never hard-code UI text in components. */
export const fr = {
  comingSoon: 'bientôt',
  tagline: 'Chaque jour, une grille 3×3 à remplir avec les bons Pokémon.',
  todayGrid: (n: number) => `Grille n° ${n}`,
  disclaimer:
    'Projet de fan non officiel, non affilié à Nintendo, Game Freak ou The Pokémon Company.',
} as const;
