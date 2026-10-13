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
pnpm data:build # régénère packages/data/dist/pokedex.json (voir packages/data/README.md)
pnpm lint && pnpm typecheck
pnpm assets:build # redessine les icônes et l'image de partage dans apps/web/public/ (PNG versionnés)
```

Node 22 et pnpm 10 (`corepack enable`).

## Mise en ligne

GitHub Pages, déployé automatiquement à chaque push sur `main` (`.github/workflows/deploy.yml`).
Réglage unique : *Settings › Pages › Source : GitHub Actions*.

## Contenu et mentions légales

- **À faire avant le lancement : compléter `apps/web/src/content/legal.ts`** (éditeur, statut, adresse, directeur de la publication, contact). Chaque champ `null` s'affiche en rouge « À compléter » sur la page `#/legal`.
- Les nouveautés se rédigent dans `apps/web/src/content/changelog.md` (Markdown restreint : titres, listes, **gras**, `code`, liens) ; elles s'affichent sur `#/changelog`.
- La FAQ (`#/faq`) génère les définitions des catégories depuis le registre et les chiffres du score depuis `SCORING` : rien à recopier à la main.
- Application installable (PWA) : seul le *shell* est mis en cache hors-ligne ; les grilles viennent toujours du réseau. `VITE_SITE_URL` (posé par le workflow de déploiement) donne l'adresse absolue des aperçus de lien.
