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
- `pnpm assets:build` : redessine icônes PWA, favicon et image Open Graph (`apps/web/public/`, PNG commités ; couleurs via `TYPE_COLORS`)
- `pnpm data:build` : régénère pokedex.json + memberships
- `pnpm grids:generate --from YYYY-MM-DD --days N` (refuse toute date ≤ aujourd'hui Paris sans `--allow-past`), `pnpm grids:report` (grilles déjà publiques : invariants durs seulement, le reste en avertissements), `pnpm grids:stock` (échoue s'il reste moins de 45 jours de grilles, comptés depuis max(aujourd'hui, `LAUNCH_DATE`)), `pnpm grids:publish --dir apps/web/dist/grids [--ahead N]` (garde dans le site construit les grilles jusqu'à aujourd'hui + N jours Paris, N = 1 par défaut, et retire les suivantes), `pnpm grids:immutable --base origin/main` (échoue si une grille datée ≤ aujourd'hui est modifiée, renommée ou supprimée par rapport à la base ; lancé par la CI sur les pull requests), `pnpm score:simulate` (scores de joueurs simulés par niveau de difficulté, à comparer à la bande visée)

## Contenu, PWA, SEO
- Pages `#/faq`, `#/changelog`, `#/legal` (routes dans `packages/core/src/routes.ts`). Le footer (`SiteFooter`) est sur toutes les pages. La FAQ est **générée** (catégories, score) : ne jamais recopier une définition ou une constante.
- Mentions légales : les faits de l'éditeur vivent dans `apps/web/src/content/legal.ts` ; un `null` s'affiche « À compléter ». Ne pas inventer ces informations.
- Nom du site dans le HTML/manifest : placeholders `%APP_NAME%`… remplis par `apps/web/site.config.ts` (lu depuis `APP_NAME`). Ne jamais l'écrire en dur dans `index.html`.
- PWA : app shell uniquement (`pwaOptions` dans `site.config.ts`), `grids/**` jamais précaché et en `NetworkOnly`. Les e2e bloquent le service worker, sauf `pwa.spec.ts`.

## À ne pas faire
- Ne pas mettre « Pokémon » en toutes lettres dans le nom du site, le domaine ou le logo ; pas de Poké Ball ni d'icônes officielles.
- Ne pas inclure d'espèce de génération > MAX_GEN, ni d'évolution vers une telle espèce.
- Ne pas mettre en cache longue durée les grilles (service worker ou CDN).
- Ne pas publier les grilles au-delà de demain : le dépôt garde 90 jours d'avance, le site déployé a celles du passé, d'aujourd'hui **et de demain** (heure de Paris ; `grids:publish --ahead 1`). Demain est en ligne la veille au soir, pour qu'un déploiement de minuit en retard ne laisse pas les joueurs sans grille ; le dépôt étant public, les grilles futures sont de toute façon lisibles. Le client n'affiche jamais demain (archives = dates strictement passées, grille du jour = date de Paris). Les builds sont planifiés plusieurs fois par jour (voir `deploy.yml`).
- Une grille publiée est de l'histoire : date ≤ aujourd'hui (Paris) = on ne la régénère jamais (`grids:generate` refuse sans `--allow-past`), on ne la modifie, renomme ni supprime jamais (`grids:immutable` en CI), on ne retire jamais une catégorie qu'elle utilise. Pour une grille publiée, `grids:report` ne bloque que sur les invariants durs (catégories connues et croisables, ≥ 3 réponses par case, 9 Pokémon différents possibles, id/date valides, puzzle jamais publié deux fois) ; la dérive des tailles de cases, de la difficulté, des cooldowns et de la variété est un avertissement.
- Ne pas compter les parties d'archives dans les stats ou la streak : une partie ne compte que si elle se termine le jour de sa grille (`endedOnItsDay`), jamais après minuit ni depuis les archives.
- Ne pas afficher de faux « % de joueurs » en v1 : la rareté est estimée et présentée en paliers.
- Ne pas casser le déploiement GitHub Pages : le site doit marcher sous `/<repo>/` (base Vite via `VITE_BASE`).
