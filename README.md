# PokéNeuf

Jeu web quotidien : une grille 3×3 à remplir avec des Pokémon (Gén 1 à 4) qui vérifient à la fois le critère de la ligne et celui de la colonne.

Projet de fan non officiel, non affilié à Nintendo, Game Freak ou The Pokémon Company.

- Spécification et plan par phases : [ROADMAP.md](ROADMAP.md)
- Règles pour Claude Code : [CLAUDE.md](CLAUDE.md)
- Lancement (checklist datée, nuit du 1er novembre, routine, retour arrière) : [LAUNCH.md](LAUNCH.md)

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

- **Ce qui est en ligne** : les grilles du passé, d'aujourd'hui **et de demain** (heure de Paris). Les
  grilles plus lointaines restent dans le dépôt, hors du site (`pnpm grids:publish --ahead 1`).
- **Déploiements de nuit** : en plus des pushs, le workflow tourne plusieurs fois par jour (cron UTC :
  19 h 47, de 22 h 03 à 3 h 03, 7 h 23 et 13 h 23) pour couvrir minuit à Paris en heure d'été (22 h UTC)
  comme d'hiver (23 h UTC). Les déclencheurs planifiés de GitHub peuvent être en retard ou sautés : d'où
  la redondance. Chaque build est idempotent et vérifie `grids:report` avant publication.
- **Relancer à la main** : *Actions › Deploy to GitHub Pages › Run workflow* (`workflow_dispatch`), par
  exemple si la grille du jour manque.
- **Alerte** : après chaque déploiement, une vérification télécharge `grids/<aujourd'hui>.json` et
  `grids/index.json` depuis le site en ligne. En cas d'échec, une issue `deploy-alert` est ouverte (ou
  commentée), puis fermée au prochain déploiement réussi.
- **Stock de grilles** : `grids-stock` (hebdomadaire) alerte sous 45 jours ; `grids-replenish`
  (mensuel, ou à la demande) ouvre une pull request qui complète à ~90 jours. Une pull request ouverte
  par un workflow ne lance pas la CI toute seule : la fermer puis la rouvrir. Il faut aussi cocher
  *Settings › Actions › General › Allow GitHub Actions to create and approve pull requests*.
  GitHub désactive les workflows planifiés après 60 jours sans activité sur le dépôt ; fusionner la pull
  request mensuelle compte comme activité.
- **Grilles publiées = historique** : la CI (`grids:immutable`) refuse qu'une pull request modifie,
  renomme ou supprime une grille datée d'aujourd'hui ou avant. Pour que ce soit bloquant, le job `check`
  du workflow CI (qui contient l'étape *Published grids are untouched*) doit être une vérification
  requise (protection de branche).

## Signalements d'erreurs de données

Le jeu propose « Signaler une erreur » dans la définition d'une catégorie, dans la liste des réponses
d'une case et dans la FAQ. C'est un simple lien vers le formulaire d'issue GitHub
`.github/ISSUE_TEMPLATE/erreur-donnee.yml`, prérempli avec la grille, la case et le Pokémon : le site
n'envoie rien, ne contient aucun traceur, et la personne décide sur GitHub d'envoyer ou non. Le
formulaire pose le label `data-error` (à créer une fois dans *Issues › Labels* s'il n'existe pas).

**Traiter une issue `data-error`** (pas à pas : [docs/fix-data.md](docs/fix-data.md)) :

1. Vérifier dans une source indépendante (les conventions du jeu, comme les types actuels et les
   évolutions relatives à la Gén 1–4, ne sont pas des erreurs).
2. Corriger dans `packages/data/data/overrides.json` ou `packages/data/data/manual/*.json` (jamais
   dans `dist/`), **et** ajouter le golden fact dans `packages/data/src/golden-facts.ts`.
3. `pnpm data:build`, puis `pnpm lint && pnpm typecheck && pnpm test`, puis `pnpm grids:report`.
4. PR avec `Closes #N` ; entrée de changelog si la correction se voit.

**Grilles déjà publiées.** Une grille datée d'aujourd'hui ou avant ne change jamais (CLAUDE.md,
`pnpm grids:immutable`) : on ne régénère pas, on ne modifie pas, on n'utilise pas `--allow-past`. Son
fichier ne contient que des ids de catégories, donc la correction se répercute sur les réponses
acceptées (archives comprises) mais jamais sur la grille elle-même. `grids:report` ne tolère que des
avertissements de dérive de taille ; s'il échoue (case publiée sous 3 réponses, moins de 9 Pokémon
possibles), la correction n'est pas fusionnée telle quelle (voir [docs/fix-data.md](docs/fix-data.md)).
**Grilles à venir.** Si une correction change sensiblement leurs réponses, les régénérer avec
`pnpm grids:generate --from <après-demain> --days N --force`, uniquement pour des dates > aujourd'hui
(demain est déjà en ligne), jusqu'à la fin du stock, puis `pnpm grids:report`.

Autres checklists : [docs/add-category.md](docs/add-category.md) (ajouter ou modifier une catégorie).

## Contenu et mentions légales

- **À faire avant le lancement : compléter `apps/web/src/content/legal.ts`** (éditeur, statut, adresse, directeur de la publication, contact). Chaque champ `null` s'affiche en rouge « À compléter » sur la page `#/legal`.
- Les nouveautés se rédigent dans `apps/web/src/content/changelog.md` (Markdown restreint : titres, listes, **gras**, `code`, liens) ; elles s'affichent sur `#/changelog`.
- La FAQ (`#/faq`) génère les définitions des catégories depuis le registre et les chiffres du score depuis `SCORING` : rien à recopier à la main.
- Application installable (PWA) : seul le *shell* est mis en cache hors-ligne ; les grilles viennent toujours du réseau. `VITE_SITE_URL` (posé par le workflow de déploiement) donne l'adresse absolue des aperçus de lien.
