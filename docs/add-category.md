# Ajouter ou modifier une catégorie (`add-category`)

Une catégorie est un critère de ligne ou de colonne (« Type Feu », « Gén 3 », « Évolue par pierre »…).
Le registre est `packages/core/src/categories.ts` ; tout le reste (jeu, FAQ, générateur, rareté)
le lit.

## Avant de commencer

- Une catégorie doit se **définir en une phrase sans ambiguïté** et se vérifier sur les données
  (`Pokemon` dans `packages/core`). Si elle demande une donnée absente de `pokedex.json`, ajouter
  d'abord le champ au pipeline (`packages/data`) ou une liste dans `data/manual/`.
- Visée : 20 à 200 membres sur les 493 espèces. En dessous : catégorie `bonus` (tirage rare). Au-delà
  ou en deçà sans être `bonus` : exception motivée dans `SIZE_EXCEPTIONS`
  (`packages/data/src/categories.test.ts`).

## Checklist

1. **Entrée dans le registre** (`packages/core/src/categories.ts`) :
   - `id` en kebab-case, **préfixé par sa famille** (`stat-speed-100`, `name-has-k`) ;
   - `family` parmi `CATEGORY_FAMILIES` ;
   - `label.fr` / `label.en` ;
   - `definition.fr` : ce qui compte exactement, cas limites compris. Les définitions d'évolution
     précisent « parmi les Pokémon du jeu (Gén 1 à 4) » (`IN_GAME`). C'est ce que voit le joueur en
     touchant l'en-tête, et la FAQ la reprend automatiquement : rien à recopier ;
   - `predicate` : fonction pure sur la fiche ;
   - `exclusiveWith` : familles avec lesquelles elle ne se croise jamais (souvent la sienne : deux
     générations ne se rencontrent pas) ;
   - `bonus: true` si elle a moins de ~20 membres.
2. **Faits à la main** (`packages/data/src/category-facts.ts`) : au moins 3 membres et 3 non-membres,
   écrits d'après la connaissance du jeu, pas depuis le build.
3. **Reconstruire** : `pnpm data:build` (écrit `dist/memberships.json`). Le build échoue si la
   catégorie n'a aucun membre.
4. **Snapshot des tailles** : `pnpm --filter @pokeneuf/data exec vitest run categories -u`, puis relire
   le diff : seule la nouvelle ligne doit apparaître. Mettre à jour le nombre de catégories cité dans
   `packages/data/README.md` et `tools/generator/src/config.ts` (commentaire).
5. **Poids dans le générateur** (`tools/generator/config/generator.json`) : sans réglage, la famille
   partage son poids entre ses catégories (`familyWeights`). Ajuster `categoryWeights["<id>"]` pour
   la rendre plus ou moins fréquente, `bonusWeight` s'applique aux catégories `bonus`. Lancer
   `pnpm grids:report` pour vérifier qu'un tirage reste faisable (cooldowns de 7 jours et 30 jours
   par paire : plus il y a de catégories, plus c'est facile).
6. **Tests et lint** : `pnpm lint && pnpm typecheck && pnpm test`. Les tests du registre vérifient
   les ids uniques et préfixés, les libellés et définitions, les exclusions symétriques, les faits
   (3 membres, 3 non-membres) et les tailles. Le nombre de catégories est borné à 75 dans
   `packages/core/src/categories.test.ts` : relever la borne en connaissance de cause.
7. **Famille nouvelle** (rare) : l'ajouter à `CATEGORY_FAMILIES`, lui dessiner un picto dans
   `FamilyIcon` (maison, pas d'icône officielle), un libellé dans `fr.familyLabels`, et un poids dans
   `familyWeights`. Les couleurs viennent de `packages/core/theme` uniquement.
8. **Changelog** (`apps/web/src/content/changelog.md`) si les joueurs vont la voir.

## Pourquoi un id n'est jamais réutilisé ni renommé

Un fichier de grille ne contient **que des ids de catégories**. Renommer ou recycler un id changerait
le sens de toutes les grilles déjà jouées, des archives, des parties sauvegardées dans les
navigateurs et des mesures du générateur (cooldowns, historique « puzzle jamais publié deux fois »).
Une catégorie qu'une grille publiée utilise n'est **jamais retirée du registre** (`grids:report`
échouerait : catégorie inconnue). Pour la rendre plus rare, baisser son poids dans le générateur
(`categoryWeights["<id>"]`, strictement positif, par exemple `0.05`).

## Effet sur les grilles déjà publiées

- **Ajouter** une catégorie ne touche aucune grille existante : elle n'apparaîtra que dans les
  grilles générées ensuite.
- **Modifier le prédicat ou la définition** d'une catégorie existante déplace ses réponses partout, y
  compris dans les archives (le jeu recalcule les réponses depuis `memberships.json`). Les fichiers
  de grille ne changent pas (`pnpm grids:immutable`), mais `pnpm grids:report` doit rester vert :
  tailles de cases et difficulté qui dérivent = avertissements ; moins de 3 réponses dans une case
  ou moins de 9 Pokémon possibles = échec, la modification ne doit pas être fusionnée telle quelle.
  Préférer une **nouvelle** catégorie à la modification d'une ancienne dont le sens change.
- Les grilles à venir (dates > aujourd'hui) peuvent être régénérées pour intégrer la nouveauté :
  `pnpm grids:generate --from <après-demain> --days <jusqu'à la fin du stock> --force`, jamais sur une
  date ≤ aujourd'hui, jamais avec `--allow-past`.
