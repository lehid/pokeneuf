# PokéNeuf — Analyse de métrodoku & feuille de route Claude Code

> Nom : **PokéNeuf** (domaine à vérifier). Le nom vit dans une seule constante `APP_NAME` (et le préfixe de stockage dans `STORAGE_PREFIX`), donc un renommage = une ligne.
> Périmètre v1 : **Générations 1 à 4 (493 espèces)**, **sans sprites**, identité visuelle par les couleurs de types.
> Mode d'emploi : la phase 0 est déjà dans le repo. Ouvre Claude Code sur le repo et colle les prompts de la partie 6 **un par un**, en commençant par la **phase 0.5** (une PR par phase : tu merges, puis phase suivante). La v1 est 100 % statique sur GitHub Pages ; la partie 7 (backend Cloudflare) viendra plus tard.

---

## 1. Analyse fonctionnelle de métrodoku (v1.16)

### 1.1 Boucle de jeu
| Feature | Comportement observé | À répliquer ? |
|---|---|---|
| Grille quotidienne 3×3 | 3 critères en ligne × 3 en colonne. Chaque case doit être remplie par une station qui vérifie **les deux** critères. Même grille pour tout le monde. | ✅ cœur |
| Saisie | Clic sur une case → champ de recherche avec autocomplétion. Insensible aux accents (bug corrigé en v1.10). | ✅ + recherche FR **et** EN |
| Unicité | Une station déjà jouée est grisée et non sélectionnable dans l'autocomplétion. | ✅ |
| Erreurs | **3 erreurs max** par partie. Compteur « Erreurs » visible. | ✅ |
| Verrouillage | Une case remplie ne peut plus être modifiée. | ✅ |
| Abandon | Bouton « Abandonner et voir les solutions » + modale de confirmation (v1.8). | ✅ |
| Pas de timer | Retiré en v1.1. | ✅ (pas de timer) |
| Fin de partie | 9/9 trouvées, 3 erreurs, ou abandon → modale de fin. | ✅ |

### 1.2 Score & rareté (le vrai différenciateur)
- Chaque réponse affiche le **% de joueurs** ayant choisi cette réponse pour cette case.
- Score sur **900** : points selon le **rang de rareté** de la réponse dans la case (la plus rare ≈ 100) + bonus fixe par bonne réponse (max ≈ 115 par case avant plafonnement), **−20 par erreur**, total plafonné à 900.
- **Anti-avantage des premiers joueurs** : à minuit, la rareté repose sur une **référence historique figée publiée avec la grille**, puis se pondère progressivement avec les réponses réelles du jour (v1.13/v1.14). → En termes quant : un *prior* bayésien mélangé aux comptages live.
- Modale de fin : score, « Stations trouvées x/9 », « Station la plus rare trouvée ».

### 1.3 Après la partie
- Partager (Web Share) / Copier le résultat (texte type Wordle).
- Voir les solutions : clic sur une case → toutes les réponses possibles + distribution des réponses des autres joueurs (v1.1).
- **Série quotidienne** (streak) affichée dans le header (v1.5).

### 1.4 Archives
- Rejouer les grilles passées, paginées (v1.12).
- N'affectent **ni** les stats, **ni** la rareté, **ni** les scores quotidiens.
- Indiquent si la grille a été complétée en mode « daily » (bug corrigé en v1.16 → bien gérer le passage daily → archive à minuit).

### 1.5 Contenu & périphérie
- Modale de règles/onboarding avec « Ne plus afficher ».
- Pages statiques : FAQ, changelog (sert aussi de canal de communication), blog, mentions légales.
- PWA (manifest, icônes, `apple-mobile-web-app-title`, `theme-color`), balises OG/Twitter.
- Soutien Ko-fi, email de contact, compte X.
- Hébergement OVH. Aucun compte utilisateur : tout l'état joueur est local (localStorage).

### 1.6 Coulisses (ce que révèlent changelog, blog et interview)
- **Base de données structurée** des stations + catégories. La majorité des correctifs du changelog sont des **erreurs de données**. → La qualité des données EST le produit.
- **Interprétations clémentes** et cas limites documentés en FAQ. → Il faut une définition explicite de chaque catégorie, visible en jeu.
- **Générateur de grilles** refondu (v1.2) pour être moins redondant et plus équilibré ; fréquence de certaines catégories réduite (v1.15). Le créateur dit aussi composer les grilles à la main. → Générateur automatique **+ revue humaine**.
- **Montée en charge** : 40–50k joueurs/jour en un mois, nuits blanches, migration serveur (v1.12), garde-fous anti-surcharge (v1.10). Les pics sont à minuit et aux heures de pointe.
- **Bugs de cache** : ancienne grille servie, ancienne partie locale incompatible après une mise à jour (v1.4, FAQ). → Versionner l'état local, servir la grille du jour avec un cache court.

---

## 2. Transposition Pokémon

### 2.1 Unité de jeu
- **Entrée = espèce, Gén 1–4 uniquement (n° 1 à 493).** Le périmètre est une constante `MAX_GEN = 4` : passer à 5+ plus tard = changer la constante, relancer `data:build`, ajuster les seuils.
- **Pas de formes régionales en v1.** Elles appartiennent à des jeux postérieurs (Gén 7+) et doublent la complexité. On les ajoutera avec l'extension de périmètre.
- **Types actuels** (ceux des jeux récents, type Fée inclus) : Mélofée est Fée, Marill est Eau/Fée, Togepi est Fée. C'est ce que les joueurs connaissent, et c'est la donnée par défaut de PokeAPI. À expliquer dans la FAQ.
- **Évolutions relatives au périmètre** : « stade final » = n'évolue en aucun Pokémon de Gén 1–4. Colossinge est donc un stade final dans le jeu, même si Courrousinge existe en Gén 9. La définition affichée le précise (« parmi les Pokémon du jeu »).
- Méga / Gigamax : pas d'entrées distinctes. Ce sont des critères possibles (« possède une Méga-évolution »).
- Noms officiels **français** en affichage. Recherche tolérante sur FR + EN + numéro de Pokédex.

### 2.2 Familles de catégories (plan initial : ≈ 40–50 catégories ; livré en v1 : 69 sur 493 Pokémon)
| Famille | Exemples | Note |
|---|---|---|
| Type | Feu, Eau… (18) ; « monotype » ; « double type » | Types actuels (Fée inclus) |
| Génération / région | Gén 1 (Kanto), Gén 2 (Johto), Gén 3 (Hoenn), Gén 4 (Sinnoh) | Exclusives entre elles → jamais deux sur le même croisement |
| Évolution | Stade de base / intermédiaire / final ; n'évolue pas ; évolue par pierre / échange / amitié ; évolution ramifiée ; bébé ; évolution introduite en Gén 4 (Magnézone, Togekiss…) | Relatif au périmètre Gén 1–4 |
| Statut | Légendaire, Fabuleux, Starter, Fossile, Pseudo-légendaire | Les 3 derniers = listes manuelles |
| Formes | A une Méga, a une forme Gigamax | Listes manuelles (catégories « bonus », fréquence faible) |
| Stats | Total ≥ 500, Vitesse ≥ 100, PV ≤ 50… | Seuils calibrés pour avoir assez de réponses |
| Physique | Couleur Pokédex, taille ≥ 2 m, poids ≤ 1 kg, forme (shape) | Données PokeAPI |
| Talents | Lévitation, Intimidation, Glissade… | Talents cachés inclus ? Définir |
| Nom | Commence par une lettre, ≤ 5 lettres | **Dépend de la langue** → FR uniquement, à documenter |

Le tableau ci-dessus est le plan de départ. La v1 livrée (`CATEGORIES` dans `packages/core/src/categories.ts`, 69 catégories en 10 familles) n'a ni catégorie de talent, ni « évolution ramifiée », ni seuil de PV ou de poids ; elle ajoute en revanche des catégories de nom (13), de couleur (6) et de silhouette (3).

Chaque catégorie a : `id`, `label` FR/EN, `family`, `definition` (texte visible au clic sur l'en-tête), `predicate`, `exclusiveWith` (familles incompatibles).

### 2.3 Concurrence & positionnement
- **PokeDoku** (pokedoku.com, Doku Games) existe déjà en anglais : 3×3, mode daily + mode Unlimited avec catégories personnalisables, partenaire Bulbapedia, boutique merch.
- Inspirations du genre : Immaculate Grid (l'original), geogridgame, moviegrid.io.
- Angle différenciant : **français d'abord** (noms FR, communauté FR), **score de rareté métrodoku-style avec prior figé** (plus juste), **définitions de catégories transparentes**, archives propres.

### 2.4 Propriété intellectuelle (à lire avant de lancer)
Pokémon (noms, sprites, artworks, marque) appartient à Nintendo / Game Freak / The Pokémon Company, qui font retirer des fan games. Je ne suis pas avocat, mais pour réduire le risque :
- Ne mets **pas** « Pokémon » ni « PokeDoku » dans le nom de domaine ou le logo.
- Pas de pub, de merch ni de paywall. Un lien Ko-fi reste une zone grise ; je le désactive par défaut.
- Affiche une mention de non-affiliation dans le footer et les mentions légales.
- **Aucun sprite ni artwork officiel en v1** (cf. §2.5). Pas de Poké Ball ni d'icônes de types officielles dans le logo ou l'UI : on dessine nos propres pictos.

### 2.5 Identité visuelle sans sprites
L'idée est de faire « Pokémon » par les codes visuels, pas par les images.
- **Badges de types** : pastilles colorées avec le nom du type en FR. Palette communautaire usuelle (des couleurs ne sont pas protégeables) :

| Type | Hex | Type | Hex | Type | Hex |
|---|---|---|---|---|---|
| Normal | `#A8A77A` | Feu | `#EE8130` | Eau | `#6390F0` |
| Électrik | `#F7D02C` | Plante | `#7AC74C` | Glace | `#96D9D6` |
| Combat | `#C22E28` | Poison | `#A33EA1` | Sol | `#E2BF65` |
| Vol | `#A98FF3` | Psy | `#F95587` | Insecte | `#A6B91A` |
| Roche | `#B6A136` | Spectre | `#735797` | Dragon | `#6F35FC` |
| Ténèbres | `#705746` | Acier | `#B7B7CE` | Fée | `#D685AD` |

- **Case remplie** : fond en dégradé des couleurs de ses deux types (ou aplat si monotype), nom FR en gros, n° de Pokédex (`#025`) et badges de types. Contraste du texte calculé automatiquement (blanc ou noir selon la luminance, WCAG AA).
- **En-têtes de catégories** : picto maison par famille (flamme stylisée pour un type, chiffre romain pour une génération, flèche pour l'évolution, étoile pour légendaire…). Une catégorie « Type Feu » prend la couleur Feu.
- **Autocomplétion** : chaque ligne affiche nom FR, nom EN en gris, n°, badges de types. On reconnaît le Pokémon sans image.
- **Couleur Pokédex** (catégorie « Pokémon rouge », etc.) : pastille de la couleur à côté du libellé.
- Direction artistique suggérée à la skill frontend-design : esprit « écran de Pokédex / LCD Game Boy » revisité (bordures épaisses, typo pixel pour les titres seulement, typo lisible pour le reste), mode clair et sombre.
- Les sprites restent une évolution possible (v2), via une couche unique `SPRITE_BASE_URL` désactivée par défaut.

---

## 3. Architecture recommandée

### 3.1 Stack — statique d'abord (v1), backend ensuite (v2)
**v1 = site 100 % statique sur GitHub Pages**, aucun serveur, aucun compte à créer en dehors de GitHub. Les grilles sont pré-générées en JSON et versionnées dans le repo. Le client choisit la grille du jour avec `gridDateFor(now)` (date de Paris). Le site déployé contient les grilles du passé, d'aujourd'hui **et de demain** (`grids:publish --ahead 1`) : demain est mis en ligne la veille au soir, donc un build de minuit en retard ou manqué ne prive pas les joueurs de leur grille ; les grilles plus lointaines restent hors du site. Le déploiement se fait par GitHub Actions à chaque push sur `main` **et** par plusieurs builds planifiés par jour (soirée, puis de 22 h 03 à 3 h 03 UTC pour couvrir minuit à Paris en heure d'été et d'hiver) ; chaque build est idempotent. Une vérification après déploiement contrôle que la grille du jour est servie et ouvre une issue `deploy-alert` sinon. Le client réessaie en plus chaque minute pendant une heure si la grille du jour manque.

**v2 = Cloudflare** (Workers + Hono + D1 + KV) pour la rareté multijoueur en direct (§3.6, phases V2).

| | v1 statique (choisi) | v2 Cloudflare |
|---|---|---|
| Coût | 0 € | ~0–5 €/mois |
| Mise en place | Rien en dehors de GitHub | Compte Cloudflare + wrangler |
| Rareté | **Estimée** (prior statique, §3.5) | Réelle, % des joueurs du jour |
| Charge | CDN GitHub, aucun souci de pic | Edge, pas de cold start |
| Limite | Grilles futures lisibles dans le dépôt public (triche possible, sans enjeu) ; celle de demain est en ligne dès la veille | — |

Front : **Vite + React + TypeScript**, Tailwind, Zustand (état), un combobox accessible (Downshift), `vite-plugin-pwa`. Tests : Vitest + Playwright. Validation : Zod. Analytics sans cookie (GoatCounter ou Cloudflare Web Analytics, optionnel).

### 3.2 Monorepo (pnpm workspaces)
```
apps/web        # front React (GitHub Pages)
packages/core   # moteur partagé : catégories, validation, recherche, score, rareté, dates, theme
packages/data   # pipeline de données → dist/pokedex.json (+ tests)
tools/generator # CLI de génération et de revue des grilles → apps/web/public/grids/
# v2 : apps/api  # Worker Hono (Cloudflare)
```
Le **moteur `core` est pur et sans dépendance réseau**. En v2, le Worker le réutilisera tel quel pour revalider les réponses. Une seule source de vérité.

### 3.3 Données
- Source : CSV de **PokeAPI/pokeapi** (`data/v2/csv/`), à **un commit épinglé**. Fichiers : `pokemon_species`, `pokemon_species_names` (language_id 5 = fr, 9 = en), `pokemon`, `pokemon_forms`, `pokemon_types`, `pokemon_stats`, `pokemon_abilities`, `ability_names`, `pokemon_evolution`… Claude Code doit vérifier les colonnes réelles.
- Contrôle croisé : `smogon/pokemon-showdown` (`data/pokedex.ts`) pour types, stats et formes.
- Filtre : `generation_id ≤ MAX_GEN` (= 4), formes par défaut uniquement. Les évolutions vers des espèces hors périmètre sont ignorées.
- Listes manuelles versionnées en JSON : starters, fossiles, pseudo-légendaires, Méga, Gigamax (restreintes à Gén 1–4).
- Pas de sprites en v1.
- Sortie : `pokedex.json` compact (id, slug, noms fr/en, attributs) + `memberships` (bitset par catégorie) précalculés. Très léger avec 493 entrées.
- **Tests « golden facts »** : ~80 assertions écrites à la main (ex. Lucario = Combat/Acier, Gén 4, a une Méga ; Évoli = n'est pas un stade final ; Mélofée = Fée ; Colossinge = stade final dans le périmètre ; Magnéton n'est pas final car Magnézone est Gén 4). C'est le filet anti-régression, puisque métrodoku a passé son changelog à corriger des données.

### 3.4 Générateur de grilles
1. Tirer 3 catégories lignes + 3 colonnes, avec diversité de familles et sans deux catégories `exclusiveWith` qui se croisent.
2. Chaque case doit avoir **entre `MIN` (3) et `MAX` (~80) réponses** (pool de 493, donc des cases plus serrées).
3. **Couplage parfait** obligatoire : il doit exister 9 Pokémon *distincts* qui remplissent la grille (appariement biparti, Hopcroft-Karp ou backtracking).
4. Score de difficulté = f(taille des cases) → cible par jour de semaine (plus facile le lundi, plus dur le week-end, optionnel).
5. **Cooldown** : une catégorie ne revient pas avant N jours, et une paire ligne×colonne ne revient pas avant M jours. Poids de fréquence par catégorie (réglables, cf. v1.15).
6. Déterministe via seed. La CLI génère 90 jours d'avance dans `apps/web/public/grids/YYYY-MM-DD.json` + un `index.json` (n°, date), puis **revue humaine** (`pnpm grids:report` et page de prévisualisation en dev) avant commit. Une GitHub Action hebdomadaire vérifie qu'il reste ≥ 45 jours de grilles (comptés depuis max(aujourd'hui, lancement)) et ouvre une issue sinon ; une Action mensuelle `grids-replenish` ouvre une pull request qui complète le stock à ~90 jours. Une grille dont la date est ≤ aujourd'hui est publique, donc immuable (`grids:immutable`).

### 3.5 Score & rareté (spécification)
**v1 — rareté estimée (statique).** Chaque Pokémon a un score de popularité `pop(a)` ∈ [0,1], calculé une fois par le pipeline à partir de proxys :
- notoriété : Gén 1 > Gén 2 > Gén 3 > Gén 4 ;
- statut : starters, légendaires, mascottes, pseudo-légendaires et stades finaux connus en haut ;
- une liste manuelle `data/manual/popular.json` (~60 « Pokémon que tout le monde cite » : Pikachu, Dracaufeu, Mewtwo, Évoli, Ronflex, Lucario…) qui force le haut du classement.

Dans une case, on trie les réponses valides par `pop` décroissante. `rankScore` vaut 0 pour la plus populaire et 1 pour la plus obscure. On affiche une **rareté estimée** en paliers (Commun / Peu commun / Rare / Très rare), pas un faux pourcentage de joueurs. Ce prior est exactement celui qui servira en v2.

**v2 — rareté réelle.** `share(a) = (w·prior(a) + n(a)) / (w + N_c)`, avec `prior` = la part implicite donnée par `pop` dans la case et **figée à la publication**, `n(a)` = picks live, `N_c` = total de la case, `w` = 300 pseudo-votes par défaut. `rankScore` est alors recalculé sur `share`.

**Commun aux deux versions :**
- Points d'une bonne réponse : `30 + round(85 × √rankScore)` (`SCORING` : `basePoints` 30, `rankPoints` 85, `rankCurve` 0,5). Fonction isolée et configurable dans `core/scoring`. (La formule de départ, `15 + 100 × rang`, donnait environ 300 à un joueur qui répond ce qui lui vient en premier.)
- Score final = Σ points − 20 × erreurs, borné à [0, 900]. **Figé à la fin de partie** pour le partage.
- Les archives ne comptent ni dans les stats, ni dans la streak (et en v2, ni dans la rareté).

### 3.6 API (Worker) — v2 uniquement
- `GET /api/grid/today` → grille du jour (catégories + id), cache court (`s-maxage=60`), date calculée en **Europe/Paris**.
- `GET /api/grid/:id` (archives), `GET /api/archives?page=`.
- `POST /api/guess` `{gridId, cell, pokemonId, deviceId}` → `{valid, share, points}`. Valide via `core`, enregistre si daily.
- `GET /api/grid/:id/stats` → distributions par case (après fin de partie côté client).
- Cron Worker à 00:00 Paris : publie la grille, fige le snapshot de prior dans KV.

### 3.7 État client
- `localStorage` : `pokeneuf:v1:game:{gridId}`, `pokeneuf:v1:history`, `pokeneuf:v1:settings`, `pokeneuf:v1:deviceId`. **Schéma versionné + migration**. Un `gridId` différent du jour = nouvelle partie (évite le bug v1.4).
- Streak calculé depuis l'historique des grilles daily terminées.

### 3.8 Partage
```
PokéNeuf #42 — 684/900 🔥 12
🟩🟨🟩
🟪🟩❌
🟩🟩🟨
pokeneuf.fr
```
Couleur par palier de rareté (🟩 Commun, 🟨 Peu commun, 🟧 Rare, 🟪 Très rare, ⬛ vide, ❌ non trouvée). Web Share API sur mobile, sinon clipboard. **Zéro spoiler** : aucun nom de Pokémon dans le texte partagé.

---

## 4. Décisions à valider avant la phase 0
| # | Décision | Ma recommandation | Alternative |
|---|---|---|---|
| D1 | Nom + domaine | ✅ **PokéNeuf** (vérifier pokeneuf.fr / .com) | — |
| D2 | Périmètre | ✅ **Gén 1–4**, sans formes régionales, types actuels, évolutions relatives au périmètre | Extension Gén 5+ en v2 |
| D3 | Images | ✅ **Aucun sprite**, couleurs et badges de types (§2.5) | Sprites en v2 |
| D4 | Hébergement | ✅ **v1 statique sur GitHub Pages**, rareté estimée ; Cloudflare en v2 | — |
| D5 | Langues | UI FR, recherche FR+EN ; i18n prête pour EN plus tard | FR seul |
| D6 | Monétisation | Aucune au lancement | Ko-fi (zone grise IP) |
| D7 | Comptes | Aucun en v1 | Login Discord pour sync/leaderboard (v2) |

---

## 5. Outillage Claude Code

### 5.1 Skills
- **frontend-design** (dépôt `anthropics/skills`) → direction visuelle non générique. À utiliser en phase 4 et 8.
- **webapp-testing** (même dépôt) → tests Playwright de l'app.
- **skill-creator** → pour créer les skills projet ci-dessous.
- **Skills projet à créer** (dans `.claude/skills/`) :
  - `add-category` : procédure pour ajouter une catégorie (registry, définition FR, prédicat, golden facts, régénération des memberships, test du générateur).
  - `fix-data` : corriger une donnée Pokémon (override JSON + golden fact + entrée changelog).
  - `release` : bump de version, entrée changelog, déploiement.

### 5.2 MCP utiles
- **Playwright MCP** (`microsoft/playwright-mcp`) : Claude Code pilote le navigateur pour vérifier l'UI.
- **Context7** (`upstash/context7`) : documentation à jour (Vite, React, Downshift ; Hono, D1, Drizzle en v2).
- **Cloudflare MCP** (serveurs officiels Cloudflare) : D1, KV, Workers, logs. Seulement en v2.
- **GitHub** via `gh` CLI : PR par phase.

### 5.3 Dépôts de référence
- `PokeAPI/pokeapi` (CSV source), `PokeAPI/api-data` (JSON statique)
- `smogon/pokemon-showdown` (contrôle croisé des données)
- `honojs/hono`, `drizzle-team/drizzle-orm`, `cloudflare/workers-sdk`

### 5.4 Bonnes pratiques à imposer (déjà dans CLAUDE.md)
- Une phase = une branche = une PR, avec critères d'acceptation vérifiés et tests verts.
- TypeScript strict, aucune logique métier dans les composants (tout dans `core`).
- Les données ne se modifient jamais à la main dans `dist/`. On passe par le pipeline + overrides + golden facts.
- Dates : toujours `Europe/Paris` via une seule fonction `gridDateFor(now)`.
- Mobile first (375 px), accessibilité clavier/lecteur d'écran sur la grille et le combobox.
- Pas de traceur non essentiel → pas de bandeau cookies. Le localStorage ne sert qu'à l'état de jeu (en v2, l'identifiant anonyme d'appareil sera à valider côté RGPD).

---

## 6. Prompts par phase (copier-coller dans Claude Code)

> **Phase 0 déjà écrite** : le monorepo, la CI et le déploiement GitHub Pages sont dans le repo. Commence par la phase 0.5.
>
> Réglage unique côté GitHub avant la première mise en ligne : *Settings › Pages › Source : GitHub Actions*.

### Phase 0 — Bootstrap ✅ (écrite)
Monorepo pnpm (apps/web, packages/core, packages/data, tools/generator), TypeScript strict, ESLint + Prettier, Vitest, `gridDateFor` (Europe/Paris) avec tests sur minuit et les changements d'heure, constantes `APP_NAME` / `STORAGE_PREFIX` / `MAX_GEN` / `LAUNCH_DATE`, CI (lint + typecheck + test + build) sur chaque PR, déploiement GitHub Pages sur `main`.
Limite : l'environnement où elle a été écrite n'avait pas accès au registre npm. La logique de dates et le typage de `core` ont été vérifiés, mais l'installation complète, le lint et le build n'ont jamais tourné, et il n'y a pas encore de `pnpm-lock.yaml`.

### Phase 0.5 — Vérification du bootstrap
```
Phase 0.5. La phase 0 a été écrite sans pouvoir lancer `pnpm install`. Vérifie-la et répare-la :
- `pnpm install`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Corrige tout ce qui casse (versions de dépendances, config ESLint, tsconfig, Vitest/jsdom), sans changer l'architecture ni les conventions de CLAUDE.md.
- Commit `pnpm-lock.yaml`, puis dans les deux workflows (.github/workflows/ci.yml et deploy.yml) : ajoute `cache: pnpm` à setup-node et passe en `pnpm install --frozen-lockfile`.
- Vérifie que `VITE_BASE=/pokeneuf/ pnpm --filter @pokeneuf/web build` produit des chemins d'assets en /pokeneuf/.
- `pnpm dev` : la page "PokéNeuf — bientôt" s'affiche.
Critères : les 5 commandes passent en local et la CI est verte sur la PR.
Ouvre une PR "Phase 0.5 — verify bootstrap".
```

### Phase 1 — Pipeline de données
```
Phase 1 (ROADMAP §3.3). Dans packages/data :
- Script `pnpm data:build` qui télécharge les CSV de PokeAPI/pokeapi à un commit épinglé (constante PINNED_SHA), les met en cache dans .cache/, et construit dist/pokedex.json.
- Périmètre : constante MAX_GEN = 4 dans packages/core/config.ts. Uniquement les espèces de génération ≤ MAX_GEN, forme par défaut, pas de formes régionales. Types = types actuels (Fée inclus).
- Champs : id (n° national), slug, nameFr, nameEn, aliases, generation, types[], baseStats, abilities (normal+caché, noms FR), evolution {stage, isFinal, evolvesFromId, evolvesToIds, methods[], branched, evolutionAddedInGen}, isBaby, isLegendary, isMythical, color, shape, heightDm, weightHg, hasMega, hasGmax.
- Évolutions RELATIVES au périmètre : on ignore toute évolution vers une espèce > MAX_GEN (Colossinge est donc isFinal = true). stage/isFinal/branched se calculent après ce filtre.
- Vérifie les noms de colonnes réels des CSV avant de coder (language_id fr=5, en=9 à confirmer).
- Listes manuelles dans data/manual/*.json (restreintes à Gén 1–4) : starters, fossils, pseudoLegendaries, mega, gmax. Overrides dans data/overrides.json.
- Validation Zod du JSON final.
- Tests golden facts (≥ 80 assertions écrites à la main, couvrant chaque champ et chaque génération, dont : exactement 493 entrées ; Mélofée = Fée ; Marill = Eau/Fée ; Colossinge isFinal ; Magnéton non final (Magnézone Gén 4) ; Évoli branché ; Pichu bébé ; Nidoran♀/♂ ; Tarinor non final (Tarinorme Gén 4)).
- Rapport console : nb d'entrées par génération, champs manquants.
Critères : build reproductible, tests verts, dist/pokedex.json < 150 Ko gzip.
Ouvre une PR "Phase 1 — data pipeline".
```

### Phase 2 — Moteur de catégories
```
Phase 2 (ROADMAP §2.2). Dans packages/core :
- Type Category {id, family, label:{fr,en}, definition:{fr}, predicate(p)=>boolean, exclusiveWith: family[]}.
- Registry avec ~45 catégories couvrant toutes les familles du tableau §2.2. Seuils de stats/physique choisis pour que chaque catégorie ait entre 20 et 200 membres sur les 493. Affiche la taille de chaque catégorie dans un test snapshot. Les définitions des catégories d'évolution précisent « parmi les Pokémon du jeu (Gén 1 à 4) ».
- Module theme : TYPE_COLORS (palette ROADMAP §2.5), labels FR des types, fonction readableTextColor(bg) (WCAG AA), cellBackground(types) → aplat ou dégradé.
- Précalcul des memberships en bitsets (pnpm data:build les écrit dans dist/memberships.json).
- Fonctions : isValid(pokemonId, rowCat, colCat), answersFor(rowCat, colCat).
- Normalisation de recherche : normalize(str) (NFD, sans accents, minuscules, ♀/♂, apostrophes, tirets, espaces) + search(query, {lang}) qui matche FR, EN, numéro, et préfixe puis sous-chaîne.
- Tests : chaque catégorie a ≥ 3 golden facts positifs et négatifs ; tests de normalize/search ("electhor", "Zapdos", "145" → Électhor).
Ouvre une PR "Phase 2 — category engine".
```

### Phase 3 — Générateur de grilles
```
Phase 3 (ROADMAP §3.4). Dans tools/generator :
- generate({date, seed, history}) → {id, date, rows[3], cols[3], cellSizes[9], difficulty}.
- Contraintes : diversité de familles, exclusiveWith respecté, MIN=3 ≤ réponses/case ≤ MAX=80, couplage parfait de 9 Pokémon distincts (Hopcroft-Karp), cooldown catégorie 7 jours et paire 30 jours, poids de fréquence par catégorie (config JSON).
- CLI : `pnpm grids:generate --from 2026-11-01 --days 90` → apps/web/public/grids/YYYY-MM-DD.json + index.json (n° de grille, date), déterministe (seed dérivée de la date). Le n° de grille = jours depuis LAUNCH_DATE + 1.
- CLI `pnpm grids:report` : distribution des catégories et de la difficulté sur la période.
- Tests : 1000 grilles générées respectent toutes les contraintes ; déterminisme ; aucune grille impossible.
Ouvre une PR "Phase 3 — grid generator".
```

### Phase 4 — Jeu côté client (local, sans backend)
```
Phase 4. Utilise la skill frontend-design pour la direction visuelle, en suivant ROADMAP §2.5 (aucun sprite, identité par les couleurs de types, esprit écran de Pokédex/LCD revisité, mobile first, clair + sombre, pas de look template, aucune Poké Ball ni icône officielle). Dans apps/web, avec une grille de démo chargée depuis un JSON local :
- Grille 3×3 avec en-têtes de catégories (picto maison par famille, couleur du type si catégorie de type) ; clic/tap sur un en-tête → définition (popover).
- Clic sur une case → modale/bottom sheet avec combobox accessible (Downshift), recherche via core.search ; chaque suggestion affiche nom FR, nom EN en gris, n° et badges de types ; Pokémon déjà utilisés grisés et non sélectionnables.
- Bonne réponse → case verrouillée : fond core.theme.cellBackground(types), nom FR, n° (#025), badges de types, texte lisible via readableTextColor. Mauvaise → erreur (compteur 3 vies), case reste vide, animation légère.
- Fin : 9/9, 3 erreurs ou abandon (avec confirmation "Voulez-vous vraiment abandonner ?").
- Modale de fin (score provisoire = 115×trouvées − 20×erreurs, placeholder), bouton Voir les solutions → clic sur une case = toutes les réponses valides.
- Modale de règles au premier lancement avec "Ne plus afficher".
- Persistance localStorage versionnée (ROADMAP §3.7), reprise de partie après refresh.
- Zustand pour l'état ; toute logique métier dans core.
- Tests Vitest (store) + Playwright (partie complète gagnée, partie perdue, abandon, refresh en cours de partie) en 375 px et desktop.
Ouvre une PR "Phase 4 — client game loop".
```

### Phase 5 — Grille du jour statique & mise en ligne
```
Phase 5 (ROADMAP §3.1, §3.4). Branche apps/web sur les vraies grilles :
- Au chargement, le client calcule gridDateFor(now) et charge public/grids/{date}.json (fetch avec cache: 'no-cache' ; jamais mis en cache longue durée par le service worker). Fallback propre si la grille manque ("Pas de grille aujourd'hui, revenez demain").
- Changement de jour pendant qu'une page est ouverte : si l'onglet revient au premier plan après minuit, proposer la nouvelle grille.
- Génère et commit 90 jours de grilles à partir de LAUNCH_DATE (constante dans core/config.ts), après `pnpm grids:report` lisible dans la PR.
- Workflow GitHub Actions hebdomadaire "grids-stock" : échoue et ouvre une issue s'il reste moins de 45 jours de grilles (seuil porté de 30 à 45 jours : le temps de relire un lot).
- Vérifie que le build GitHub Pages fonctionne sous le sous-chemin /<repo>/ (base Vite) ET sous un domaine perso (variable VITE_BASE).
Tests : gridDateFor autour de minuit et des changements d'heure ; Playwright avec horloge simulée (23:59 → 00:01 Paris).
Ouvre une PR "Phase 5 — daily static grids & deploy".
```

### Phase 6 — Rareté estimée, score, partage, stats
```
Phase 6 (ROADMAP §3.5 v1 et §3.8).
- packages/data : calcule pop(a) ∈ [0,1] (génération, statut, stade final, liste data/manual/popular.json d'environ 60 Pokémon très connus) et l'écrit dans pokedex.json. Golden facts : Pikachu et Dracaufeu dans le top 5 %, un Pokémon obscur de Gén 3/4 dans le bas.
- core/scoring : rankScore par case (tri par pop), paliers Commun / Peu commun / Rare / Très rare, points = 30 + round(85×√rankScore) (formule d'origine `15 + round(100×rankScore)`, remplacée pour la calibration), total borné [0,900], −20/erreur. API pensée pour accepter en v2 un share live à la place de pop. Tests unitaires avec cas chiffrés.
- UI : palier de rareté sur chaque case remplie (libellé "rareté estimée", pas de faux %), score /900 dans le header, modale de fin avec score figé, x/9, réponse la plus rare.
- Solutions : toutes les réponses valides par case, triées de la plus rare à la plus commune, avec leur palier.
- Partage : texte §3.8 sans spoiler, navigator.share puis fallback clipboard, toast de confirmation.
- Streak + modale stats (parties jouées, % victoires, score moyen, meilleur score, distribution).
Ouvre une PR "Phase 6 — estimated rarity, scoring, sharing".
```

### Phase 7 — Archives
```
Phase 7. Page /archives paginée (grille n°, date, statut : non jouée / en cours / terminée en daily / terminée en archive, score), uniquement pour les dates passées (jamais les grilles futures). Rejouer une archive n'affecte ni streak ni stats. Gère le passage daily → archive à minuit (une partie daily terminée apparaît "terminée en daily" le lendemain ; test Playwright avec horloge simulée).
Ouvre une PR "Phase 7 — archives".
```

### Phase 8 — Contenu, PWA, SEO, légal
```
Phase 8. Pages FAQ (règles, définitions des catégories générées depuis le registry, rareté estimée et score, données, pourquoi Gén 1–4, types actuels avec Fée, évolutions relatives au périmètre), changelog (fichier markdown rendu), mentions légales (éditeur à compléter par moi via des TODO clairs, hébergeur GitHub Pages / GitHub Inc., contact, non-affiliation Nintendo/The Pokémon Company/Game Freak), footer. Routing compatible GitHub Pages (HashRouter ou 404.html de redirection). PWA (vite-plugin-pwa, manifest, icônes maison, offline pour l'app shell uniquement, jamais de cache longue durée sur les grilles). Meta OG/Twitter, image OG statique. Audit Lighthouse ≥ 95 perf/a11y sur mobile. Passe frontend-design de finition.
Ouvre une PR "Phase 8 — content & polish".
```

### Phase 9 — Outils & qualité
```
Phase 9. Page /preview accessible uniquement en dev (pas dans le build de prod) : 30 prochaines grilles avec taille des cases et exemples de réponses. Lien "Signaler une erreur" qui ouvre un formulaire d'issue GitHub pré-rempli (template .github/ISSUE_TEMPLATE/erreur-donnee.yml : grille, case, Pokémon, message). Crée les skills projet add-category, fix-data, release (ROADMAP §5.1) avec skill-creator.
Ouvre une PR "Phase 9 — tooling & quality".
```

### Phase 10 — Lancement v1
```
Phase 10 — checklist de lancement : GitHub Pages actif, domaine perso optionnel (CNAME + VITE_BASE), 90 jours de grilles revues, page 404, test final sur iPhone Safari + Android Chrome, vérification des textes FR (accents, typographie), version 1.0 dans le changelog. Produis un LAUNCH.md avec ce qui a été vérifié et ce qui reste à faire par moi.
Ouvre une PR "Phase 10 — launch v1".
```

## 7. v2 — Rareté multijoueur (Cloudflare)
> À lancer seulement si la v1 a des joueurs. Prérequis de ton côté : un compte Cloudflare gratuit et `wrangler login` sur ton ordinateur.

### Phase V2.1 — API & stats live
```
Phase V2.1 (ROADMAP §3.5 v2 et §3.6). Crée apps/api (Cloudflare Worker + Hono + D1 via Drizzle + KV) :
- Tables guesses (gridId, cell, pokemonId, deviceId, createdAt, unique(gridId,cell,deviceId)), cell_counts (agrégats).
- Endpoints de §3.6, validation Zod, revalidation via packages/core.
- Cron 00:00 Paris : fige le prior de la grille du jour (dérivé de pop) dans KV.
- Rate limit par IP, payloads bornés, CORS limité au domaine du site.
- deviceId anonyme (UUID localStorage, préfixe STORAGE_PREFIX), une contribution par case.
- apps/web : POST à chaque bonne réponse en mode daily (jamais en archive), affiche le vrai % (share bayésien) ; si l'API ne répond pas, retombe sur la rareté estimée v1 sans casser la partie.
Tests : intégration Miniflare (guess valide, invalide, doublon, archive non comptée) ; test de charge k6 (5 000 joueurs dans les 5 min après minuit).
Ouvre une PR "Phase V2.1 — live rarity API".
```

### Phase V2.2 — Solutions communautaires & bascule d'hébergement
```
Phase V2.2. Distribution des réponses des autres joueurs dans la vue solutions (barres + %). Migration du front sur Cloudflare Pages si souhaité (même build). Monitoring (Sentry ou équivalent) front + worker. Mise à jour FAQ (rareté réelle) et changelog.
Ouvre une PR "Phase V2.2 — community stats".
```

## 8. Backlog
- **Extension Gén 5+** (MAX_GEN), puis formes régionales comme entrées distinctes.
- **Sprites** optionnels via SPRITE_BASE_URL (après réflexion sur le risque IP).
- Mode **Illimité** (grilles aléatoires, catégories filtrables) comme PokeDoku.
- Version anglaise (i18n déjà prête).
- Comptes optionnels (Discord) → sync multi-appareils + classement.
- Grilles thématiques (évènement d'un nouveau jeu, Halloween → Spectre…).
- Image de partage générée (carte rétro).
