# @pokeneuf/generator — générateur de grilles

Fabrique les grilles quotidiennes (ROADMAP §3.4). Les **règles** d'une grille valide vivent dans
`@pokeneuf/core` (`checkGrid`, `GRID_RULES`) ; ici : le tirage, les cooldowns, la config, la CLI.

```bash
pnpm data:build                                          # prérequis : dist/memberships.json
pnpm grids:generate --from 2026-11-01 --days 90          # → apps/web/public/grids/
pnpm grids:report                                        # revue avant commit ; code 1 si problème
pnpm grids:stock                                         # code 1 s'il reste moins de 30 jours de grilles
pnpm --filter @pokeneuf/generator test
```

## Ce que fait `grids:generate`

- Un fichier par jour, `YYYY-MM-DD.json`, plus `index.json` (n° de grille, date). N° = jours depuis
  `LAUNCH_DATE` + 1. Le fichier ne contient que des **ids de catégories** : le jeu recalcule les
  réponses avec `memberships.json`.
- **Incrémental** : les grilles déjà présentes sont gardées (elles alimentent les cooldowns). Lancer
  `--days 90` puis `--days 120` donne exactement les mêmes fichiers qu'un seul `--days 120`.
  `--force` régénère les dates demandées (résultat identique, tant que l'historique l'est).
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
3. Contrôles : variété de familles, cible de difficulté du jour, puis couplage parfait.
4. Tant que ça échoue, nouveau tirage (400 par palier). Aucune grille invalide n'est jamais publiée :
   si rien ne marche, `GenerationError` liste les causes de rejet.

## Config (`config/generator.json`)

| Clé | Rôle |
|---|---|
| `cooldown.categoryDays` / `pairDays` | 7 et 30 jours (roadmap) |
| `cooldown.minCategoryDays` | plancher du repli, voir plus bas |
| `familyWeights`, `bonusWeight`, `categoryWeights` | fréquence relative des familles et des catégories (la part d'une famille est partagée entre ses catégories) |
| `balanceWindowDays` | rééquilibrage de l'usage sur cette fenêtre (0 = off) |
| `weekdayDifficulty` | plage de difficulté acceptée par jour (`mon`…`sun`), optionnelle |
| `attemptsPerStage` | tirages par palier de cooldown |

**Pourquoi un cooldown « mou ».** 6 catégories par jour × 7 jours = 42 des 58 catégories : le
cooldown de 7 jours de la roadmap est à la limite du faisable. Deux parades :
1. *Rééquilibrage* : une catégorie moins utilisée que sa part reprend du poids. Sans ça, après une
   semaine il ne reste que les catégories les plus rares, qui ne forment plus de grille valide.
2. *Repli* : si aucun tirage ne marche à 7 jours, on essaie 6, puis 5… jusqu'au plancher. Jamais en
   silence : la CLI et `grids:report` comptent les cas (sur 90 jours : 7 jours pour ~1 grille sur
   3, 6 jours pour la plupart des autres). Le cooldown des **paires** n'est jamais relâché.

## Difficulté

Chaque case vaut 1 à 3 réponses et 0 à 80 (échelle log), la grille la moyenne, sur 0–100
(`difficultyOf`). Cibles par défaut : lundi 40–62 … vendredi 52–80, week-end 62–90.

## Revue humaine

`pnpm grids:report` : difficulté par jour de semaine, taille des cases, usage des catégories et des
familles, cooldowns, jours manquants, cohérence de `index.json`. Il rejoue `checkGrid` sur chaque
fichier : il sert aussi de garde-fou quand les catégories ou les données changent.
