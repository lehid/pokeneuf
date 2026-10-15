# Corriger une donnée (`fix-data`)

Checklist pour traiter une issue `data-error` (formulaire « Erreur de donnée », voir le README) ou
toute erreur repérée à la main : une réponse refusée ou acceptée à tort, un type, une évolution, un
Méga, un starter mal classé.

Règle d'or (CLAUDE.md) : **on ne modifie jamais `packages/data/dist/` à la main**. Une correction
passe par `data/overrides.json` ou `data/manual/*.json`, **plus** un golden fact.

## 1. Comprendre et vérifier

1. Lire l'issue : grille, case, Pokémon, ce qui est faux, ce qui serait juste, source éventuelle.
2. Vérifier soi-même, dans une source indépendante de celle qu'on corrige (Poképédia, Bulbapedia,
   Serebii, ou `pnpm --filter @pokeneuf/data crosscheck` pour comparer PokéAPI et Showdown).
   Rappel des conventions du jeu, qui ne sont **pas** des erreurs :
   - types **actuels** (Fée incluse) ; talents actuels, cachés compris ;
   - évolutions **relatives à la Gén 1–4** (Colossinge est un stade final) ; pas de formes régionales ;
   - les catégories de nom ne valent que pour le nom français.
3. Si c'est une définition de catégorie discutable et non une donnée fausse, voir
   `docs/add-category.md` (définition dans `packages/core/src/categories.ts`).
4. Si l'issue n'a pas lieu d'être, répondre en citant la définition affichée en jeu et fermer.

## 2. Choisir où corriger

| Cas | Où |
|---|---|
| Un champ d'une fiche est faux (types, stats, taille, évolution…) | `packages/data/data/overrides.json` |
| Une liste maintenue à la main (starters, fossiles, pseudo-légendaires, Méga, Gmax, « les plus connus », alias de recherche) | `packages/data/data/manual/<liste>.json` |
| Une catégorie calculée à tort pour tout un groupe | le prédicat dans `packages/core/src/categories.ts` |

Entrée d'`overrides.json` (les objets fusionnent, les tableaux et scalaires remplacent) :

```json
{
  "overrides": [
    {
      "id": 123,
      "reason": "Pourquoi, avec la source (lien) et la date de vérification",
      "set": { "types": ["bug", "flying"] }
    }
  ]
}
```

Les listes de `data/manual/` sont des tableaux d'ids nationaux (`"ids": [...]`), `aliases.json`
associe un id à des graphies supplémentaires pour la recherche.

## 3. Ajouter le golden fact

Dans `packages/data/src/golden-facts.ts`, **écrit à la main d'après la connaissance du jeu, jamais
recopié depuis `dist/`** :

```ts
// [id national, chemin dans la fiche, valeur attendue]
export type GoldenFact = [id: number, path: string, expected: unknown];

[123, 'types', ['bug', 'flying']],
[123, 'abilities.1.slug', 'steadfast'],   // chemin pointé, indices numériques pour les tableaux
[133, 'evolution.methods', ['stone']],
```

- Un fait = un test. Le chemin doit exister dans la fiche (un test détecte les fautes de frappe).
- Mettre le fait près des autres faits du même Pokémon et, si utile, un commentaire sur la règle
  (`// not Alolan Sandshrew's Ice Stone`).
- Pour une catégorie, ajouter ou ajuster aussi ses exemples dans
  `packages/data/src/category-facts.ts` (≥ 3 membres, ≥ 3 non-membres).

## 4. Reconstruire et tester

```bash
pnpm data:build                  # régénère dist/pokedex.json et dist/memberships.json
pnpm lint && pnpm typecheck && pnpm test
pnpm grids:report                # aucune grille publiée ne doit casser un invariant dur
```

- `pnpm test` fait échouer les golden facts, le snapshot des tailles de catégories et le contrôle
  croisé si quelque chose a bougé sans que tu l'aies voulu.
- Si une taille de catégorie change, mettre à jour le snapshot **en lisant le diff** :
  `pnpm --filter @pokeneuf/data exec vitest run categories -u`.

## 5. Effet sur les grilles déjà publiées

Une grille publiée (date ≤ aujourd'hui, heure de Paris) est de l'histoire : son fichier
`apps/web/public/grids/AAAA-MM-JJ.json` ne bouge **jamais** (ni modification, ni renommage, ni
suppression ; `pnpm grids:immutable` le vérifie en CI). Ne pas utiliser `--allow-past`.

Mais le fichier ne contient que les ids des catégories : les réponses acceptées sont **recalculées
par le jeu** à partir de `memberships.json`. Une correction de donnée s'applique donc aussi aux
archives. Conséquences à contrôler avec `pnpm grids:report` :

- la taille annoncée d'une case ou la difficulté dérive : **avertissement** (`~`), c'est attendu ;
- une case publiée tombe à moins de 3 réponses, ou 9 Pokémon différents ne peuvent plus remplir la
  grille : **échec** (code 1). La correction ne doit alors pas être fusionnée telle quelle. Écrire le
  constat dans l'issue et trancher (retarder la correction, ou l'accepter en connaissance de cause en
  documentant l'exception) ; ne jamais « réparer » en éditant la grille.

Pour les grilles **à venir** (date strictement après aujourd'hui), si une catégorie corrigée change
de façon sensible leurs réponses, les régénérer :

```bash
# démarrer APRÈS-DEMAIN au plus tôt : la grille de demain est déjà en ligne la veille au soir
pnpm grids:generate --from <après-demain> --days <jusqu'à la dernière grille du dépôt> --force
pnpm grids:report
```

`--force` n'est autorisé que pour des dates > aujourd'hui. Régénérer jusqu'à la fin du stock : les
cooldowns dépendent de l'historique, donc des grilles plus tardives gardées telles quelles
pourraient ne plus s'enchaîner proprement.

## 6. Clore

1. Entrée dans `apps/web/src/content/changelog.md` si la correction est visible des joueurs.
2. Branche, PR avec : l'issue (`Closes #N`), la source, le fichier corrigé, le golden fact, le
   résultat de `pnpm grids:report`.
3. Remercier la personne qui a signalé, sans révéler d'information personnelle.
