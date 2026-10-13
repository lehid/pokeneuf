# CLAUDE.md — PokéNeuf

Jeu web quotidien : grille 3×3 à remplir avec des Pokémon qui vérifient un critère de ligne ET un critère de colonne. Inspiré de métrodoku. Périmètre v1 : Gén 1–4 (493 espèces, `MAX_GEN = 4`), types actuels, évolutions relatives au périmètre, **aucun sprite** (identité visuelle par les couleurs de types, ROADMAP §2.5). La spec complète et le plan par phases sont dans `ROADMAP.md`. Lis-la avant chaque phase.

## Stack
- **v1 100 % statique, hébergée sur GitHub Pages** : aucun backend, grilles pré-générées dans `apps/web/public/grids/`, rareté *estimée* (ROADMAP §3.5). Le backend Cloudflare (`apps/api`) n'arrive qu'en v2 (ROADMAP §7). Ne le crée pas avant.
- Monorepo pnpm : `apps/web` (Vite + React + TS + Tailwind + Zustand), `packages/core` (logique métier pure, sans réseau), `packages/data` (pipeline Pokédex), `tools/generator` (grilles).
- Node 22, pnpm 10.
- Tests : Vitest partout, Playwright pour le web. Validation : Zod.

## Règles de travail
- **Une phase = une branche = une PR.** Tu ne commences pas la phase suivante sans qu'on te le demande.
- Avant de coder, résume en 5 lignes ce que tu vas faire et les fichiers touchés.
- Avant d'ouvrir la PR, tu dois avoir lancé `pnpm lint && pnpm typecheck && pnpm test` et vérifié chaque critère d'acceptation. Liste-les cochés dans la description de la PR.
- Si une donnée ou une API externe ne correspond pas à la ROADMAP, vérifie la source réelle, adapte et signale l'écart dans la PR. Pas de supposition silencieuse.

## Conventions
- TypeScript `strict`, pas de `any`. Code et identifiants en anglais, textes UI en français (via fichier i18n, jamais en dur).
- **Toute logique métier vit dans `packages/core`** : catégories, validation, recherche, score, rareté, dates. Les composants React ne font qu'afficher.
- Dates de grille : uniquement via `gridDateFor(now)` (fuseau `Europe/Paris`).
- Données Pokémon : on ne modifie jamais `dist/` à la main. Pour corriger, on passe par `data/overrides.json` ou `data/manual/*.json` et on ajoute un golden fact.
- Nom du site : uniquement via la constante `APP_NAME` ; préfixe de stockage via `STORAGE_PREFIX`.
- Visuels Pokémon : aucun sprite/artwork en v1. Couleurs de types et pictos maison uniquement via `packages/core/theme` (`TYPE_COLORS`, `cellBackground`, `readableTextColor`).
- localStorage : clés préfixées `pokeneuf:v{N}:`. Tout changement de schéma = migration + test.
- Mobile first (375 px). Grille et combobox utilisables au clavier et au lecteur d'écran.
- Aucun traceur non essentiel, aucune pub.

## Commandes
- `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- `pnpm data:build` : régénère pokedex.json + memberships
- `pnpm grids:generate --from YYYY-MM-DD --days N`, `pnpm grids:report`, `pnpm grids:stock` (échoue s'il reste moins de 30 jours de grilles), `pnpm grids:publish --dir apps/web/dist/grids` (retire du site construit les grilles des jours à venir), `pnpm score:simulate` (scores de joueurs simulés par niveau de difficulté, à comparer à la bande visée)

## À ne pas faire
- Ne pas mettre « Pokémon » en toutes lettres dans le nom du site, le domaine ou le logo ; pas de Poké Ball ni d'icônes officielles.
- Ne pas inclure d'espèce de génération > MAX_GEN, ni d'évolution vers une telle espèce.
- Ne pas mettre en cache longue durée les grilles (service worker ou CDN).
- Ne pas publier les grilles des jours à venir : le dépôt garde 90 jours d'avance, le site déployé n'a que celles d'aujourd'hui et du passé (`grids:publish`, déploiement planifié après minuit Paris). Une grille publiée est de l'histoire : on ne la régénère jamais, on ne retire jamais une catégorie qu'elle utilise.
- Ne pas compter les parties d'archives dans les stats ou la streak : une partie ne compte que si elle se termine le jour de sa grille (`endedOnItsDay`), jamais après minuit ni depuis les archives.
- Ne pas afficher de faux « % de joueurs » en v1 : la rareté est estimée et présentée en paliers.
- Ne pas casser le déploiement GitHub Pages : le site doit marcher sous `/<repo>/` (base Vite via `VITE_BASE`).
