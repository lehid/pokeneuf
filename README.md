# PokéNeuf

Jeu web quotidien : une grille 3×3 à remplir avec des Pokémon (Gén 1 à 4) qui vérifient à la fois le critère de la ligne et celui de la colonne.

Projet de fan non officiel, non affilié à Nintendo, Game Freak ou The Pokémon Company.

- Spécification et plan par phases : [ROADMAP.md](ROADMAP.md)
- Règles pour Claude Code : [CLAUDE.md](CLAUDE.md)

## Développement

```bash
pnpm install
pnpm dev        # site en local
pnpm test       # tests
pnpm lint && pnpm typecheck
```

Node 22 et pnpm 10 (`corepack enable`).

## Mise en ligne

GitHub Pages, déployé automatiquement à chaque push sur `main` (`.github/workflows/deploy.yml`).
Réglage unique : *Settings › Pages › Source : GitHub Actions*.
