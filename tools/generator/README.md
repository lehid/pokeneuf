# @pokeneuf/generator — générateur de grilles

Fabrique les grilles quotidiennes (ROADMAP §3.4). Les **règles** d'une grille valide vivent dans
`@pokeneuf/core` (`checkGrid`, `GRID_RULES`) ; ici : le tirage, les cooldowns, la config, la CLI.

```bash
pnpm data:build                                          # prérequis : dist/memberships.json
pnpm grids:generate --from 2026-11-01 --days 90          # → apps/web/public/grids/ (refuse les dates ≤ aujourd'hui sans --allow-past)
pnpm grids:report                                        # revue avant commit ; code 1 si problème
pnpm grids:stock                                         # code 1 s'il reste moins de 45 jours de grilles
pnpm grids:publish --dir apps/web/dist/grids             # site construit : garde jusqu'à demain (--ahead 1), retire la suite
pnpm grids:immutable --base origin/main                  # code 1 si une grille ≤ aujourd'hui a été modifiée/renommée/supprimée
pnpm score:simulate                                      # scores de joueurs simulés, par niveau, vs la bande visée
pnpm --filter @pokeneuf/generator test
```

## Ce que fait `grids:generate`

- Un fichier par jour, `YYYY-MM-DD.json`, plus `index.json` (n° de grille, date). N° = jours depuis
  `LAUNCH_DATE` + 1. Le fichier ne contient que des **ids de catégories** : le jeu recalcule les
  réponses avec `memberships.json`.
- **Incrémental** : les grilles déjà présentes sont gardées (elles alimentent les cooldowns). Lancer
  `--days 90` puis `--days 120` donne exactement les mêmes fichiers qu'un seul `--days 120`.
  `--force` régénère les dates demandées (résultat identique, tant que l'historique l'est).
- **Passé protégé** : toute date ≤ aujourd'hui (Paris) que la commande créerait ou réécrirait est
  refusée (code 2, rien n'est écrit) sauf avec `--allow-past`. Les grilles existantes d'une plage
  qui les recouvre sont simplement gardées. Un jour passé manquant est une décision à prendre
  volontairement, pas un effet de bord. (`--today` sert aux tests.)
- **Déterministe** : graine dérivée de la date (`seedFromDate`), aucune autre source d'aléa. Ne
  jamais changer `hashString` ni le texte de la graine : ça changerait toutes les grilles futures.
- Pas de grille avant `LAUNCH_DATE`. Les fichiers générés ne sont pas formatés par Prettier
  (`.prettierignore`).

## Règles d'une grille (`checkGrid`)

3 lignes × 3 colonnes de 6 catégories distinctes ; aucune paire `exclusiveWith` ; au plus 2
catégories par famille (1 pour les noms : `GRID_RULES.maxByFamily`), au moins 4 familles en tout et 2 par ligne de 3 ; chaque case a de 3 à 80
réponses ; **9 Pokémon différents** peuvent remplir la grille (couplage biparti, Hopcroft–Karp) ;
taille des cases et difficulté cohérentes avec les données.

## Tirage

1. Lignes : 3 catégories tirées au poids (famille, rééquilibrage), hors cooldown.
2. Colonnes : seules les catégories qui font 3 à 80 réponses avec **chacune** des 3 lignes, qui
   peuvent se croiser et dont la paire n'est pas en cooldown.
3. Contrôles : variété de familles, niveau de difficulté accepté ce jour-là, grille jamais publiée
   (même retournée), puis couplage parfait.
4. Tant que ça échoue, nouveau tirage (400 par palier). Aucune grille invalide n'est jamais publiée :
   si rien ne marche, `GenerationError` liste les causes de rejet.

## Config (`config/generator.json`)

| Clé | Rôle |
|---|---|
| `cooldown.categoryDays` / `pairDays` | 7 et 30 jours (roadmap) |
| `cooldown.minCategoryDays` | plancher du repli, voir plus bas |
| `familyWeights`, `bonusWeight`, `categoryWeights` | fréquence relative des familles et des catégories (la part d'une famille est partagée entre ses catégories) |
| `balanceWindowDays` | rééquilibrage de l'usage sur cette fenêtre (0 = off) |
| `weekdayLevels` | niveaux de difficulté acceptés par jour (`mon`…`sun`), optionnels |
| `attemptsPerStage` | tirages par palier de cooldown |

**Pourquoi un cooldown « mou ».** 6 catégories par jour × 7 jours = 42 des 69 catégories : le
cooldown de 7 jours de la roadmap est à la limite du faisable. Deux parades :
1. *Rééquilibrage* : une catégorie moins utilisée que sa part reprend du poids. Sans ça, après une
   semaine il ne reste que les catégories les plus rares, qui ne forment plus de grille valide.
2. *Repli* : si aucun tirage ne marche à 7 jours, on essaie 6, puis 5… jusqu'au plancher. Jamais en
   silence : la CLI et `grids:report` comptent les cas (sur 90 jours : 7 jours pour ~1 grille sur
   3, 6 jours pour la plupart des autres). Le cooldown des **paires** n'est jamais relâché.

## Difficulté

Deux mesures, à ne pas confondre :
- `difficulty` (dans le fichier de grille, 0–100) : la taille des cases seulement (`difficultyOf`, échelle log).
- **Le niveau montré au joueur** (`gridDifficulty` dans `core`) : très facile / facile /
  intermédiaire / difficile / très difficile, d'après la taille des cases (40 %), l'évidence de la
  meilleure réponse de chaque case (30 %) et la part de notoriété que la case contient (30 %).
  Formule et seuils fixes (`DIFFICULTY`), recalculés par le client.

Calendrier par défaut (`weekdayLevels`) : lundi très facile ou facile, mardi facile, mercredi
facile ou intermédiaire, jeudi intermédiaire, vendredi intermédiaire ou difficile, samedi difficile,
dimanche très difficile : **une seule grille très difficile par semaine**. `grids:report` signale
tout écart au calendrier et toute semaine avec plus d'une grille très difficile.

## Revue humaine

`pnpm grids:report` : niveau par jour de semaine, taille des cases, usage des catégories et des
familles, cooldowns, jours manquants, cohérence de `index.json`. Il rejoue `checkGrid` sur chaque
fichier : il sert aussi de garde-fou quand les catégories ou les données changent.

**Grilles déjà publiques** (date ≤ aujourd'hui Paris, `--today` pour les tests). Elles sont de
l'histoire : une correction de données peut déplacer une taille de case sans rendre la grille
injouable. Seuls les **invariants durs** font échouer le rapport (code 1) : catégories connues et
qui peuvent se croiser, au moins 3 réponses par case, 9 Pokémon différents possibles, numéro et date
valides, puzzle jamais publié deux fois (même retourné), plus jours manquants et `index.json`. La
dérive des tailles de cases annoncées, du plafond de 80 réponses, de la difficulté annoncée, de la
variété de familles, du calendrier de niveaux, des cooldowns et de la semaine à une seule grille très
difficile devient un **avertissement** imprimé (`~`), code 0. Les grilles à venir gardent toutes les
règles strictes (`!`, code 1).

## Calibrer le score

`pnpm score:simulate` fait jouer trois profils (casual, regular, fan) sur les grilles publiées et
affiche trouvées / victoires / score moyen par niveau de difficulté, puis les quantiles. Bande
visée : médiane du profil *regular* entre 450 et 600, 99ᵉ centile du *fan* à 700 ou plus (sous 900).
À relancer après tout changement de `SCORING` ou de `POPULARITY_WEIGHTS` (dans `core` et `data`). Les
joueurs simulés ne sont qu'un modèle : à confirmer avec de vraies parties.

## Publication et historique

Le dépôt garde **90 jours d'avance** (`public/grids`) ; le site déployé n'a que le passé, aujourd'hui
et **demain** (date de Paris) :
- `pnpm grids:publish --dir apps/web/dist/grids [--ahead N]` travaille sur la **copie construite** :
  il garde les grilles jusqu'à aujourd'hui + N jours (N = 1 par défaut : demain est en ligne la veille
  au soir, un build de minuit en retard ne laisse donc pas les joueurs sans grille), supprime les
  autres et réécrit `index.json`. Il refuse de toucher `apps/web/public/grids` et un dossier absent.
  Le client ne montre jamais demain : les archives listent les dates strictement passées et la grille
  du jour se charge par la date de Paris (`archiveDates`, `hasNewGrid`).
- Le workflow de déploiement le lance à chaque build, puis rejoue `grids:report` sur le dossier
  publié. Il est déclenché par les pushs sur `main` et par plusieurs crons UTC (soirée, puis 22:03 à
  03:03 UTC : minuit à Paris en heure d'été et d'hiver), plus un `workflow_dispatch` manuel. Après le
  déploiement, il télécharge `grids/<aujourd'hui>.json` et `grids/index.json` depuis le site et ouvre
  une issue `deploy-alert` si l'un manque. Le client réessaie en plus toutes les minutes pendant une
  heure si la grille du jour n'est pas encore là.
- Une grille publiée est de l'**histoire**. `grids:generate` refuse de créer ou réécrire une date
  ≤ aujourd'hui sans `--allow-past`, `pnpm grids:immutable --base origin/main` échoue si une grille
  datée d'aujourd'hui ou avant est modifiée, renommée ou supprimée (CI, pull requests uniquement ;
  les ajouts sont permis), et `grids:report` ne bloque sur ces grilles que pour les invariants durs.
  Une catégorie utilisée par une grille passée ne se supprime donc pas : on la garde dans le
  registre, quitte à ne plus la tirer (`categoryWeights`).
- **Stock** : `pnpm grids:stock` (45 jours, depuis max(aujourd'hui, `LAUNCH_DATE`) pour ne pas
  alerter avant le lancement). Le workflow mensuel `grids-replenish` génère les grilles manquantes
  jusqu'à ~90 jours et ouvre une pull request (sans jamais réécrire une grille existante).

## Équilibrage de la famille des noms et cases triviales

- `familyWindow` (config) plafonne une famille : au plus `max` grilles sur `windowDays` jours
  centrés sur la date en contiennent une catégorie (`name` : 2 sur 5). Sans cela, les catégories
  d'orthographe, qui croisent tout, remplissaient les colonnes que rien d'autre ne pouvait remplir
  (64 % des grilles, pour un poids de 0,1). Le plafond cède, comme le cooldown de catégorie, au
  dernier palier si aucune grille valide n'existe.
- Une case où un critère implique l'autre (toutes les réponses d'une catégorie, ex. légendaire ×
  « 500+ de stats ») n'est jamais tirée.
