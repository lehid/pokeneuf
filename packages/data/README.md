# @pokeneuf/data — pipeline Pokédex

Construit `dist/pokedex.json` (493 espèces, Gén 1–4) à partir des CSV de
[PokeAPI](https://github.com/PokeAPI/pokeapi), épinglés sur un commit. ROADMAP §3.3.

```bash
pnpm data:build                       # télécharge (cache .cache/), construit, valide, écrit dist/
pnpm --filter @pokeneuf/data crosscheck   # compare avec Pokémon Showdown (source indépendante)
pnpm --filter @pokeneuf/data test
```

`data:build` écrit aussi `dist/memberships.json` (voir « Catégories » plus bas).

Le build est reproductible : mêmes CSV + mêmes listes manuelles = même fichier, octet pour octet.
`dist/` et `.cache/` ne sont pas versionnés et **ne se modifient jamais à la main**.

## Où est quoi

| Fichier | Rôle |
|---|---|
| `src/config.ts` | `PINNED_SHA` (PokeAPI), `SHOWDOWN_SHA`, liste des CSV lus |
| `src/build.ts` | `buildPokedex(tables, options)` : fonction pure, sans I/O |
| `src/schema.ts` | schéma Zod + invariants croisés (évolutions réciproques, stades, ids contigus…) |
| `src/pipeline.ts`, `src/cli.ts` | téléchargement → build → validation → écriture |
| `data/manual/*.json` | listes manuelles : starters, fossiles, pseudo-légendaires, Méga, Gmax, alias |
| `data/overrides.json` | corrections appliquées par-dessus PokeAPI, avant validation |
| `src/golden-facts.ts` | assertions écrites à la main (le filet anti-régression) |
| `src/crosscheck.ts` | contrôle croisé PokeAPI ↔ Showdown |

Les types des entrées (`Pokemon`, `Evolution`…) vivent dans `@pokeneuf/core` ; le schéma Zod est
vérifié à la compilation comme identique à ces types.

## Corriger une donnée

1. Ne touche pas à `dist/`. Ajoute une entrée à `data/overrides.json` :
   `{ "id": 123, "reason": "pourquoi, avec la source", "set": { "types": ["bug"] } }`
   (les objets fusionnent, les tableaux et scalaires remplacent), ou édite la liste concernée dans
   `data/manual/`.
2. Ajoute le **golden fact** correspondant dans `src/golden-facts.ts`.
3. `pnpm data:build`, puis `pnpm test`.
4. Entrée de changelog si la correction est visible. Pas à pas complet : [docs/fix-data.md](../../docs/fix-data.md).

## Changer de version des sources

Modifier `PINNED_SHA` (ou `SHOWDOWN_SHA`) dans `src/config.ts`, lancer `pnpm data:build`, lire le
rapport, puis `pnpm test` : les golden facts, le contrôle Méga/Gmax et le contrôle croisé disent ce
qui a bougé. Le changement de commit est une décision, jamais un effet de bord.

## Choix de modélisation à connaître

- **Évolutions relatives au périmètre** (`MAX_GEN`) : une évolution vers une espèce hors périmètre
  est ignorée. Colossinge est donc `isFinal`, et Sneasel n'est pas « ramifié ». `stage`, `isFinal`
  et `branched` sont calculés après ce filtre.
- **`evolution.methods`** = comment CE Pokémon évolue (union de ses évolutions), pas comment on
  l'obtient. Référence : les jeux actuels, donc Magnéton vaut `['stone', 'other']` (Pierre Foudre
  ou lieu). Les lignes d'évolution propres aux formes régionales (Alola, Galar, Hisui) sont ignorées.
  Une condition intrinsèque (sexe, heure, personnalité, Attaque/Défense) reste `level` ; un objet,
  une attaque, un lieu, un équipier ou la beauté donnent `other`.
- **`evolutionAddedInGen`** = génération de la plus récente des deux espèces du lien
  (Magnézone → 4, Pikachu → 2 à cause de Pichu).
- **Types actuels** (Fée incluse), talents actuels (cachés marqués `isHidden`), formes par défaut
  uniquement.
- **Méga** : les 57 espèces Gén 1–4 qui en ont une dans les jeux actuels (44 classiques + 13 de
  *Légendes Z-A*). Pour ne garder que les classiques, retirer les 13 de `data/manual/mega.json` : le
  recoupement avec PokeAPI (`forms.ts`) le signalera, il faudra alors adapter son test en connaissance de cause.
- **Starters** = les 12 lignées complètes (36 Pokémon), pas seulement les 12 de départ.

## Catégories et memberships (phase 2)

Le registre vit dans `@pokeneuf/core` (`CATEGORIES`, 69 catégories, 10 familles ; `CATEGORIES.length` et `CATEGORY_FAMILIES` font foi). `data:build`
évalue chaque prédicat sur chaque Pokémon et écrit `dist/memberships.json` : un bitset hexadécimal
par catégorie (1 bit par n° national). Le jeu et le générateur lisent ce fichier avec
`new Memberships(file)` : `isValid(pokemonId, ligne, colonne)`, `answersFor(ligne, colonne)`, `size(cat)`.
Le build échoue si une catégorie n'a aucun membre.

- **Tailles** : une catégorie ordinaire a entre 20 et 200 membres ; les exceptions sont listées avec
  leur raison dans `src/categories.test.ts` (Spectre 18, Dragon 19, monotype 258, double type 235).
  Les catégories rares par nature sont marquées `bonus: true` (moins de 20 membres, tirage rare).
  Un snapshot fige toutes les tailles : le changer, c'est changer le jeu.
- **Ajouter ou modifier une catégorie** : entrée dans `packages/core/src/categories.ts` (id préfixé par
  sa famille, définition française visible en jeu), ≥ 3 faits positifs et ≥ 3 négatifs dans
  `src/category-facts.ts`, mise à jour du snapshot de tailles, `pnpm data:build`, `pnpm test`.
  Un id n'est jamais réutilisé ni renommé : les grilles déjà générées le référencent.
- **Définitions** : celles des catégories d'évolution précisent « parmi les Pokémon du jeu (Gén 1 à 4) ».
  Les catégories de nom ne valent que pour le français. Les talents (cachés marqués `isHidden`) sont dans
  `pokedex.json`, mais aucune catégorie de talent n’existe en v1.
