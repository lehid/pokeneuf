# LAUNCH.md — Lancement de PokéNeuf (1er novembre 2026)

Ce document est un pas-à-pas pour le propriétaire du dépôt : il ne demande pas de lire le code. Chaque commande, workflow et URL cité existe dans le dépôt (vérifié à la rédaction, le 15/10/2026).

- Dépôt : <https://github.com/lehid/pokeneuf> (onglets *Actions*, *Issues*, *Settings*).
- Site (adresse GitHub Pages par défaut) : <https://lehid.github.io/pokeneuf/>. Dans la suite, `SITE` désigne cette adresse, avec la barre oblique finale.
- Lancement : `LAUNCH_DATE = '2026-11-01'` (`packages/core/src/config.ts`). La grille n° 1 est celle du dimanche 1er novembre 2026 ; le calendrier de difficulté en fait une grille « très difficile » (c’est un dimanche, voir « Décisions » plus bas).
- Heures : **heure de Paris** sauf mention « UTC ». Paris passe à l’heure d’hiver (UTC+1) le dimanche 25/10/2026 à 3 h : la nuit du lancement est donc en UTC+1.

Légende : ☐ à faire par vous · `commande` à lancer dans le dépôt cloné (Node 22, pnpm 10, `pnpm install --frozen-lockfile` fait une fois).

---

## (a) Checklist avant le lancement

### Décisions qui n’appartiennent qu’à vous

| À décider | Pourquoi / comment | Au plus tard |
|---|---|---|
| **Nom : garder « PokéNeuf » ?** | « Pokémon » en toutes lettres est interdit dans le nom, le domaine et le logo (CLAUDE.md). « Poké » seul est plus discret mais reste le début d’un nom de marque : c’est un risque assumé ou non, pas une certitude (je ne suis pas juriste). Le nom vit dans une seule constante, `APP_NAME` (`packages/core/src/config.ts`) ; après un changement : `pnpm assets:build` (icônes, favicon, image de partage), `pnpm lint && pnpm typecheck && pnpm test`. Le préfixe de stockage `STORAGE_PREFIX` (`pokeneuf:v1:`) est gratuit à changer **avant** le lancement, puis impossible sans migration (les joueurs perdraient leurs parties). | ☐ Dim. 18/10 |
| **Adresse du site** | **Recommandé pour le lancement : rester sur `https://lehid.github.io/pokeneuf/`** (rien à faire). Un domaine perso demande de modifier le workflow `deploy.yml` (l’étape *Site address* fixe `VITE_BASE=/pokeneuf/` et `VITE_SITE_URL=https://lehid.github.io/pokeneuf/`) : remplacer par `VITE_BASE=/` et `VITE_SITE_URL=https://votre-domaine/`, déclarer le domaine dans *Settings › Pages › Custom domain* et chez le registrar (DNS), cocher *Enforce HTTPS*. Un déploiement par GitHub Actions ignore un fichier `CNAME`. À faire dans une pull request dédiée, avec les e2e (`pnpm e2e`). Pas de domaine contenant « Pokémon ». | ☐ Dim. 18/10 (sinon : après le lancement) |
| **Éditeur du site** | Voir ci-dessous. | ☐ Mar. 20/10 |
| **Grille n° 1 « très difficile »** | Le dimanche est le jour « très difficile » du calendrier (`weekdayLevels` dans `tools/generator/config/generator.json`), donc la première grille que verront les joueurs l’est. La régénérer à l’identique ne changerait rien (le tirage est déterministe) ; l’alléger demanderait de changer le calendrier et de régénérer les grilles à venir, ce que ce document ne recommande pas à deux semaines du lancement. À connaître plutôt qu’à corriger. | — |

### Mentions légales : `apps/web/src/content/legal.ts`

Cinq champs valent `null` aujourd’hui ; chacun s’affiche en rouge « À compléter » sur `SITE#/legal`. Ne rien inventer.

- ☐ `publisherName` : nom ou pseudonyme.
- ☐ `publisherStatus` : par exemple `'Particulier'`.
- ☐ `publisherAddress` : adresse postale, **ou** `'Adresse communiquée à l’hébergeur'` si vous restez anonyme (particulier non professionnel : l’anonymat vis-à-vis du public est permis par la LCEN, art. 6, si l’hébergeur détient votre identité).
- ☐ `publicationDirector` : en général vous-même.
- ☐ `contactEmail` : une adresse lue régulièrement (un alias dédié plutôt que votre adresse personnelle).
- ☐ **Hébergeur, à revérifier le jour du lancement** : la page cite « GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis » (`fr.legal.sections.host.text` dans `apps/web/src/i18n/fr.ts`). Contrôler que cette raison sociale et cette adresse sont toujours celles publiées par GitHub dans ses conditions et mentions légales. La LCEN (art. 6, III) liste pour l’hébergeur le nom, l’adresse **et le numéro de téléphone** ; le texte actuel n’a pas de téléphone, et GitHub n’en publie peut-être pas : décider (avec un avis juridique si besoin) si c’est acceptable. Ce point n’a pas été tranché dans le code.
- ☐ Après modification : `pnpm test` (les tests de la page légale acceptent des champs remplis), puis, une fois en ligne, ouvrir `SITE#/legal` : plus aucun « À compléter ».
- ☐ Vérifier aussi dans les outils du navigateur (Application › Cookies) qu’aucun cookie n’est posé : la page promet « aucun cookie » (`fr.legal.sections.privacy`).

### Réglages GitHub que vous seul pouvez faire

À faire dès que possible (lundi 19/10), car chacun peut bloquer le lancement.

- ☐ **Pages** : *Settings › Pages › Build and deployment › Source : GitHub Actions* (le workflow `deploy.yml` ne publie pas sans cela).
- ☐ **Actions activées** : *Settings › Actions › General › Actions permissions*. Les workflows utilisent `actions/*` et `pnpm/action-setup` (tiers) : ne pas restreindre aux seules actions de GitHub, ou autoriser `pnpm/action-setup@*`.
- ☐ **Création de pull requests par les workflows** : *Settings › Actions › General › Workflow permissions › Allow GitHub Actions to create and approve pull requests*. Sans cela, le dernier pas du workflow `Replenish grids` échoue (voir (d)).
- ☐ **Vérification obligatoire sur `main`** : *Settings › Branches* (ou *Rules › Rulesets*) : exiger le contrôle d’état `check` (job `check` du workflow `CI`). C’est ce qui rend la règle « une grille publiée ne change jamais » bloquante : l’étape *Published grids are untouched* (`pnpm grids:immutable`) est dans ce job. Exiger aussi une pull request avant fusion.
- ☐ **Issues activées** (*Settings › General › Features › Issues*) : les alertes automatiques et les signalements de joueurs passent par les issues.
- ☐ **Notifications** : *Watch › Custom › Issues* sur le dépôt, et dans vos réglages personnels de notifications, *Actions : failed workflows only*, pour être prévenu(e) par e-mail d’un déploiement qui échoue ou d’une nouvelle issue `deploy-alert`.
- ☐ **Libellés** (*Issues › Labels*) :
  - `deploy-alert` : créé automatiquement par le workflow de déploiement au premier incident (rien à faire ; vous pouvez le créer d’avance, couleur `B60205`) ;
  - `grids-stock` : créé automatiquement par `Grid stock` ;
  - `data-error` : **à créer à la main** (par exemple couleur `FBCA04`), il sert à trier les signalements d’erreurs de données. Vérifier son orthographe exacte dans `.github/ISSUE_TEMPLATE/` une fois le formulaire « signaler une erreur » fusionné (cette fonctionnalité arrive dans une autre pull request).
- ☐ **Répétition** : *Actions › Deploy to GitHub Pages › Run workflow* (branche `main`) ; les trois jobs `build`, `deploy`, `verify` doivent passer au vert et `SITE` doit s’ouvrir. Avant le 01/11 le job `verify` indique « Before the launch (2026-11-01): no grid expected » : c’est normal.

### Calendrier

| Date | À faire |
|---|---|
| Jeu. 15/10 → dim. 18/10 | ☐ Décisions du tableau ci-dessus (nom, adresse du site, éditeur). |
| Lun. 19/10 | ☐ Tous les réglages GitHub ci-dessus. ☐ Lancer la répétition de déploiement. |
| Mar. 20/10 | ☐ Compléter `legal.ts` (pull request, CI verte, fusion). |
| Mer. 21/10 | ☐ Relire les premières grilles : `pnpm data:build && pnpm grids:report` doit finir par « No problem found. » (au 15/10 : 90 grilles, n° 1 du 01/11/2026 au n° 90 du 29/01/2027). ☐ Premier passage de la matrice d’appareils (e) avec `SITE?demo` (la grille de démonstration marche avant le lancement). |
| Ven. 23/10 | ☐ **Gel** : plus de nouvelle fonctionnalité. Tout ce qui reste à fusionner l’est maintenant. |
| Dim. 25/10 | Passage à l’heure d’hiver. Rien à faire : les crons du déploiement couvrent minuit en été comme en hiver. |
| Lun. 26/10 | ☐ Deuxième répétition : *Run workflow* sur `deploy.yml`, vérifier que `verify` est vert. ☐ Lancer à la main *Actions › Grid stock › Run workflow* : il doit réussir (90 jours de stock). |
| Mer. 28/10 | ☐ Dernier passage d’appareils (matrice (e) complète, y compris lecteur d’écran). Les anomalies bloquantes se corrigent avant le 30. |
| Jeu. 29/10 | ☐ En local : `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, puis `pnpm e2e`. ☐ Aucune issue `deploy-alert` ni `grids-stock` ouverte. |
| Ven. 30/10 | ☐ **Go / no-go** : `SITE#/legal` sans « À compléter », `SITE#/faq` et `SITE#/changelog` lisibles, aucun workflow rouge dans *Actions*. |
| Sam. 31/10, matin | ☐ La grille n° 1 est en ligne depuis 0 h 03 (voir (b)) : ouvrir `SITE` + `grids/2026-11-01.json`. S’il manque, il reste plus de 24 h pour corriger. |
| Sam. 31/10, soir | Procédure (b). |

---

## (b) Nuit du lancement : samedi 31/10 → dimanche 01/11

### Ce qui est prévu, heure par heure

Le workflow `Deploy to GitHub Pages` (`.github/workflows/deploy.yml`) tourne sur chaque push sur `main`, à la demande, et selon trois crons UTC. Le site déployé contient les grilles du passé, d’aujourd’hui **et de demain** (heure de Paris) : la grille de demain est en ligne avant minuit, mais le jeu ne l’affiche qu’à minuit (heure de Paris, calculée par le navigateur du joueur). Le client ne dépend donc pas d’un déploiement à minuit pile.

| Cron (UTC) | Heure de Paris (UTC+1) cette nuit-là | Rôle |
|---|---|---|
| `47 19 * * *` | sam. 31/10 à 20 h 47 | Build du soir. Aujourd’hui = 31/10, demain = 01/11 : la grille n° 1 est incluse. |
| `3 22,23,0,1,2,3 * * *` | 23 h 03, **00 h 03** (dim. 01/11), 01 h 03, 02 h 03, 03 h 03, 04 h 03 | Builds de minuit. Celui de **00 h 03** est le premier dont « aujourd’hui » est le 01/11 : son job `verify` contrôle que le site en ligne sert bien la grille n° 1. Les suivants sont le filet de sécurité si celui-là a été retardé ou sauté (GitHub peut décaler les crons de plusieurs minutes). |
| `23 7,13 * * *` | 08 h 23 et 14 h 23 | Builds de jour. |

La grille n° 1 est en réalité en ligne depuis le build de **00 h 03 le samedi 31/10** (premier build dont « demain » est le 01/11), mais personne ne la voit avant minuit : avant le 01/11, le jeu affiche « Le jeu ouvre le 1er novembre 2026. Revenez ce jour-là ! ».

### Procédure

1. ☐ **Sam. 31/10, vers 21 h** (après le build de 20 h 47) : dans *Actions*, le dernier run de `Deploy to GitHub Pages` est vert. Ouvrir `SITE` : message « Le jeu ouvre le 1er novembre 2026 ». Ouvrir `SITE` + `grids/2026-11-01.json` : un JSON avec `"id": 1` et `"date": "2026-11-01"`. Ouvrir `SITE` + `grids/index.json` : la dernière date listée est `2026-11-01` (le job `verify` refuse tout ce qui dépasse « demain »).
   - Avant le 01/11, `verify` ne regarde que « rien après demain » et ne contrôle pas la grille n° 1 : **ces trois ouvertures à la main sont la seule vérification**.
2. ☐ **Dim. 01/11, 00 h 00 → 00 h 05** : ouvrir `SITE` (navigation privée pour partir d’un navigateur vierge) : le titre doit être « Grille n° 1 » avec la date « dimanche 1er novembre », une difficulté « Très difficile », et les 9 cases vides. Si la page était ouverte avant minuit, elle réessaie toute seule chaque minute pendant une heure.
3. ☐ **Dim. 01/11, 00 h 03 → ~00 h 15** : dans *Actions*, le run de 00 h 03 doit passer `build`, `deploy`, `verify`, `notify` au vert. Ouvrir le job `verify` : dernière ligne « OK: https://lehid.github.io/pokeneuf serves the grid of 2026-11-01. ». Ouvrir `SITE` + `grids/index.json` : dernière date `2026-11-02` (la grille de demain).
4. ☐ Jouer une partie complète sur votre téléphone, partager le résultat, vérifier le texte (matrice (e)).
5. ☐ *Issues* : aucune issue `deploy-alert` ouverte. Si une l’était avant (échec ancien), elle se ferme toute seule après un déploiement réussi (« Deployed and verified again »).

### Si la grille n° 1 n’est pas en ligne

La question est toujours : le fichier existe-t-il sur le site ? Ouvrir `SITE` + `grids/2026-11-01.json` (sur un autre appareil ou en navigation privée, avec un `?x=1` ajouté à la fin pour contourner le cache).

1. **Le fichier est là mais la page n’affiche rien de neuf** : problème d’affichage chez vous (cache, service worker). Recharger sans cache (Ctrl/Cmd + Maj + R), ou effacer les données du site. Le jeu ne met jamais les grilles en cache (`NetworkOnly`).
2. **Le fichier est absent** : lire les journaux.
   - *Actions › Deploy to GitHub Pages*, ouvrir le dernier run (rouge ou absent ?).
   - Ouvrir le job en échec, puis l’étape en rouge, lire les dernières lignes. Messages typiques :
     - `No grid for 2026-11-01 in the build: the stock ran out` : le fichier de grille manque dans le dépôt (`apps/web/public/grids/`) ; vérifier avec `pnpm grids:stock`. Ne rien régénérer pour le passé (voir (f)).
     - une erreur de `pnpm grids:report` : une grille du site publié ne passe pas les invariants durs (voir `tools/generator/README.md`, « Revue humaine »).
     - échec du job `deploy` avec un message du type « Failed to create deployment (status: 404) … Ensure GitHub Pages has been enabled » : *Settings › Pages › Source* n’est pas sur GitHub Actions.
     - `verify` rouge avec « HTTP 404 (attempt …) » : le CDN de GitHub Pages est lent ; le job réessaie 12 fois à 25 s d’écart (~5 min).
   - Aucun run du tout depuis plusieurs heures : les crons de GitHub sont « au mieux » ; passer à l’étape 3.
3. **Relancer le déploiement** : *Actions › Deploy to GitHub Pages › Run workflow* (menu *Branch : main* › *Run workflow*), ou sur un run rouge *Re-run failed jobs*. Un seul déploiement à la fois (le suivant attend, aucun n’est annulé en cours de route). Compter ~5 à 10 minutes.
4. **Toujours rien** : ouvrir l’issue `deploy-alert` créée par le workflow (elle contient le lien du run en échec), puis corriger la cause (pull request vers `main`, qui redéploie à sa fusion). Pendant ce temps, les joueurs voient « Pas de grille aujourd’hui, revenez demain. » et la page retente toutes les minutes pendant une heure ; une fois en ligne, un simple rechargement suffit.

---

## (c) Première semaine : routine quotidienne (~5 min)

Chaque matin, après le build de 08 h 23 :

- ☐ *Actions* : les runs `Deploy to GitHub Pages` des dernières 24 h sont verts (ou, au pire, un seul rouge suivi d’un vert).
- ☐ *Issues* : aucune issue ouverte avec le libellé `deploy-alert`. Si oui : ouvrir le run du lien, appliquer (b).
- ☐ Ouvrir `SITE` : bonne grille du jour (n° = jours depuis le 01/11 + 1 ; le 02/11 c’est la n° 2), jouable.
- ☐ Issues libellées **`data-error`** : une erreur de données signalée par un joueur. Ne **pas** toucher à `packages/data/dist/` ni aux fichiers de `apps/web/public/grids/`. Procédure (`packages/data/README.md`, « Corriger une donnée ») : entrée dans `packages/data/data/overrides.json` (ou une liste de `packages/data/data/manual/`), « golden fact » correspondant dans `packages/data/src/golden-facts.ts`, `pnpm data:build`, `pnpm test`, entrée dans `apps/web/src/content/changelog.md`, pull request. Une grille ne stocke que des identifiants de catégories : corriger une donnée ne modifie aucun fichier de grille.
- ☐ Pull requests Dependabot (hebdomadaires) : fusionner si la CI est verte, sinon les laisser.

Chaque lundi : l’e-mail ou l’issue de `Grid stock` (lundi 06 h 17 UTC, soit 07 h 17 Paris en hiver). Une issue `grids-stock` signifie « moins de 45 jours de grilles » : voir (d).

À J+1, J+3 et J+7, passez en revue : `SITE#/archives` (la grille de la veille y figure, les stats ne bougent pas quand on rejoue une archive), et la page `SITE#/changelog` (version 1.0). Aucune statistique de visites n’est collectée (pas de traceur).

---

## (d) Plan « propriétaire absent »

Le site ne se maintient pas tout seul indéfiniment. Trois mécanismes à connaître.

### 1. Le déploiement quotidien dépend des crons

Le site ne contient que « jusqu’à demain » : chaque jour, un build planifié (voir (b)) publie la grille suivante. Si GitHub **désactive les workflows planifiés**, le site s’arrête au plus tard le lendemain, faute de nouvelle grille.

- Règle GitHub : sur un dépôt public, les workflows planifiés sont désactivés après **60 jours sans activité** sur le dépôt. Ils portent alors un bandeau dans l’onglet *Actions* et un bouton *Enable workflow*.
- Ce qui compte comme activité n’est pas garanti par ce dépôt. Le workflow `grids-replenish` part du principe que **fusionner** la pull request mensuelle en est une ; ne comptez que sur ce qu’un humain fait : une fusion ou un push.
- ☐ **Avant une absence de plus de 6 semaines** : fusionner au moins une pull request dans les 50 jours qui précèdent la date la plus éloignée de votre absence (même un commit de documentation), et noter dans votre agenda de vérifier *Actions* à cette date.
- ☐ **Au retour** (ou si le site est muet) : *Actions*, pour chaque workflow planifié (`Deploy to GitHub Pages`, `Grid stock`, `Replenish grids`), cliquer *Enable workflow* s’il est désactivé, puis lancer `Deploy to GitHub Pages` à la main.

### 2. Les grilles : `grids-replenish` et sa limite

- `Replenish grids` (`.github/workflows/grids-replenish.yml`) tourne le 1er de chaque mois à 05 h 41 UTC et ouvre une **pull request** « chore: replenish grids from … » qui complète le stock à ~90 jours à partir de demain. Il ne réécrit jamais une grille existante.
- Calendrier réel : le 01/11/2026 (jour du lancement) il n’ajoute qu’**une grille** (30/01/2027) ; le 01/12/2026 il ajoute les grilles du 31/01 au 01/03/2027 ; puis chaque mois.
- **Limite connue** : une pull request ouverte par un workflow ne déclenche pas la CI (règle GitHub). Si le contrôle `check` est obligatoire (voir (a)), la pull request reste **bloquée tant que vous ne l’avez pas fermée puis rouverte** (ou poussé un commit vide sur sa branche) pour lancer la CI. Il faut aussi : relire le rapport de `grids:report` (dans les journaux du run), puis fusionner. Tant qu’une pull request « replenish » est ouverte, le workflow n’en crée pas d’autre.
- ☐ **Avant une absence** : *Actions › Replenish grids › Run workflow*, champ `days` à `366` (maximum), fermer/rouvrir la pull request, relire, fusionner : le stock passe à environ un an. Les grilles futures restent lisibles dans le dépôt public (choix assumé, ROADMAP §3.1).

### 3. Si rien n’est fait : le stock s’épuise le 29/01/2027

État au 15/10/2026 : la dernière grille est celle du **vendredi 29/01/2027** (n° 90).

| Date | Ce qui se passe |
|---|---|
| lundi 21/12/2026, 07 h 17 | Première alerte hebdomadaire possible, si la pull request du 01/12 n’a pas été fusionnée : il reste moins de 45 jours (39). Une issue `grids-stock` (« Grid stock below 45 days ») s’ouvre. |
| vendredi 29/01/2027, 00 h 03 | Les builds échouent : « tomorrow » (30/01) n’a pas de grille (« No grid for 2027-01-30 in the build »). Une issue `deploy-alert` s’ouvre. Les joueurs ont encore la grille du 29/01 (publiée la veille). |
| samedi 30/01/2027 | Pas de grille : le jeu affiche « Pas de grille aujourd’hui, revenez demain. » |

Pour réparer :
- si la date de demain est encore dans le futur : *Actions › Replenish grids › Run workflow*, relire, fusionner la pull request (les grilles ajoutées commencent à « demain ») ;
- si le trou touche déjà le jour même (aujourd’hui n’a pas de grille) : `pnpm data:build`, `pnpm grids:generate --from <aujourd’hui, AAAA-MM-JJ> --days 90 --allow-past`, `pnpm grids:report`, pull request, fusion. `--allow-past` est ici volontaire : il crée la grille d’un jour qui n’en avait pas (il ne réécrit rien). Puis relancer `Deploy to GitHub Pages` (b).

---

## (e) Matrice de tests sur appareils (à remplir)

Pour chaque ligne : cocher ☑ quand le résultat attendu est constaté, sinon noter le problème dans la colonne. Avant le 01/11, utiliser `SITE?demo` (grille de démonstration, sauvegardée à part : elle ne touche pas la vraie partie du jour). À refaire après le lancement avec la vraie grille.

Appareils : **iPhone Safari** (iOS à jour), **Android Chrome**, **Firefox desktop**, **Chrome desktop**. Largeur de référence : 375 px.

| # | Test | Résultat attendu | iPhone Safari | Android Chrome | Firefox desktop | Chrome desktop |
|---|---|---|---|---|---|---|
| 1 | Ouvrir `SITE` en navigation privée | Page chargée sans erreur, pas de défilement horizontal à 375 px, règles affichées au premier lancement (« Comment jouer »). | ☐ | ☐ | ☐ | ☐ |
| 2 | Règles : « Ne plus afficher », recharger | La fenêtre des règles ne réapparaît plus. | ☐ | ☐ | ☐ | ☐ |
| 3 | Taper `electhor`, puis `Zapdos`, puis `145` dans la recherche d’une case | Chaque fois, Électhor est proposé (accents et langue sans importance) ; la liste affiche nom français, nom anglais, numéro, types. | ☐ | ☐ | ☐ | ☐ |
| 4 | Mauvaise réponse | La case reste vide, la vie diminue (« 2 vies sur 3 »), message « Raté : … ne convient pas ». | ☐ | ☐ | ☐ | ☐ |
| 5 | Bonne réponse | La case se verrouille (couleurs de types, nom, numéro), palier de rareté « rareté estimée : … ». Le Pokémon n’est plus sélectionnable ailleurs (« déjà utilisé »). | ☐ | ☐ | ☐ | ☐ |
| 6 | Recharger la page en cours de partie | La partie reprend au même état. | ☐ | ☐ | ☐ | ☐ |
| 7 | Toucher un intitulé de ligne ou de colonne | La définition exacte s’affiche et se ferme. | ☐ | ☐ | ☐ | ☐ |
| 8 | Abandonner | Confirmation « Voulez-vous vraiment abandonner ? », puis résultat « Partie abandonnée » et solutions consultables. | ☐ | ☐ | ☐ | ☐ |
| 9 | Fin de partie (gagnée ou perdue) | Score sur 900, titre, « x/9 trouvés », réponse la plus rare, série de jours. | ☐ | ☐ | ☐ | ☐ |
| 10 | Bouton **Partager** | iPhone/Android : la feuille de partage native s’ouvre. Firefox desktop (pas de partage natif) : toast « Résultat copié dans le presse-papiers. » ; Chrome desktop : l’un ou l’autre. Coller le texte : `PokéNeuf #N — score/900` (et ` 🔥 série` à partir d’un jour), trois lignes de carrés colorés, une dernière ligne `https://lehid.github.io/pokeneuf/`. **Aucun nom de Pokémon.** | ☐ | ☐ | ☐ | ☐ |
| 11 | Mode sombre : basculer le thème du système | La page suit le thème du système (pas de bouton) ; texte lisible, couleur de la barre du navigateur cohérente. | ☐ | ☐ | ☐ | ☐ |
| 12 | Clavier (desktop) | Tab atteint les cases dans l’ordre ; Entrée ouvre la recherche ; flèches haut/bas parcourent les suggestions, Entrée valide, Échap ferme ; le focus revient sur la case. Un focus visible partout. | — | — | ☐ | ☐ |
| 13 | Lecteur d’écran (VoiceOver iOS, TalkBack Android, NVDA avec Firefox) | Cases annoncées « Case vide, [ligne] et [colonne] » puis « [Nom], [numéro], … » ; en-têtes « Ligne : … », « Colonne : … » ; vies « 2 vies sur 3 » ; difficulté « Difficulté de la grille : Difficile (4 sur 5) » ; la recherche annonce « n Pokémon trouvés… Flèches haut et bas pour choisir, Entrée pour valider. » ; la bonne ou mauvaise réponse est annoncée (« Correct : … », « Raté : … »). Rien de lu deux fois ni de caractère décoratif lu à voix haute. | ☐ | ☐ | ☐ (NVDA) | — |
| 14 | Texte agrandi (iOS Taille du texte, Android Taille de la police ~130 %) | Rien de coupé, la grille reste jouable. | ☐ | ☐ | — | — |
| 15 | **Installer** l’application | iPhone : Partager › *Sur l’écran d’accueil*. Android : menu › *Installer l’application*. Chrome desktop : icône d’installation dans la barre d’adresse. Firefox desktop : pas d’installation (normal). Icône « PokéNeuf », ouverture plein écran sans barre d’adresse, écran de démarrage vert clair. | ☐ | ☐ | — | ☐ |
| 16 | **Hors ligne** : visiter `SITE`, puis couper le réseau (mode avion) et rouvrir l’application | La coquille se charge ; `#/faq` s’ouvre ; le jeu dit qu’il ne peut pas charger la grille et propose « Réessayer » (jamais une grille périmée). Réseau rétabli puis « Réessayer » : la grille arrive. | ☐ | ☐ | ☐ | ☐ |
| 17 | Pages `#/faq`, `#/changelog`, `#/legal` | Contenu lisible ; la FAQ liste les 69 catégories et le score ; **mentions légales sans « À compléter »** ; pied de page présent sur toutes les pages. | ☐ | ☐ | ☐ | ☐ |
| 18 | Page 404 : ouvrir `SITE` + `n-importe-quoi`, puis `SITE` + `faq` | « Page introuvable » avec lien de retour ; `…/faq` redirige vers `#/faq`. | ☐ | ☐ | ☐ | ☐ |
| 19 | Aperçu de lien : coller `SITE` dans iMessage/WhatsApp/Discord | Titre « PokéNeuf — la grille du jour », description et image de partage. (Les messageries mettent l’aperçu en cache.) | ☐ | ☐ | — | — |
| 20 | Après minuit (post-lancement) : laisser l’onglet ouvert au-delà de 00 h 00 | Au retour au premier plan, la fenêtre « Nouvelle grille ! » propose la nouvelle grille ; « Plus tard » conserve l’actuelle. | ☐ | ☐ | ☐ | ☐ |
| 21 | Archives (à partir du 02/11) | La grille de la veille est listée « Non jouée » ; la rejouer ne change ni les statistiques ni la série. | ☐ | ☐ | ☐ | ☐ |

---

## (f) Retour arrière

### Un mauvais déploiement (code)

Toute modification passe par `main`, et **les crons redéploient `main` à chaque exécution** : un mauvais commit sur `main` revient donc tout seul en ligne même si vous « annulez » un run. La vraie réparation est toujours un commit sur `main`.

1. Sur GitHub, ouvrir la pull request fusionnée fautive › bouton **Revert** : GitHub crée une pull request d’annulation. La fusionner (CI verte) : le push sur `main` relance `Deploy to GitHub Pages`.
2. En attendant (urgence) : *Actions › Deploy to GitHub Pages*, choisir un run **vert** déclenché par un push antérieur au commit fautif › *Re-run all jobs* : il reconstruit ce commit-là. C’est provisoire (le prochain cron redéploie `main`) : à faire en même temps que l’étape 1.
3. Vérifier ensuite comme en (b) : run vert, `verify` vert, `SITE` jouable.

### Les grilles publiées sont de l’histoire

Règle : **une grille datée d’aujourd’hui ou avant (heure de Paris) ne se modifie, ne se renomme et ne se supprime jamais.** La CI le vérifie sur les pull requests (`pnpm grids:immutable --base origin/main`) et `pnpm grids:generate` refuse de créer ou réécrire ces dates sans `--allow-past`.

- Une grille « mal équilibrée » mais jouable reste : c’est un avertissement du rapport, pas un incident.
- Une réponse fausse dans une grille publiée est une erreur de **données** : correction par `overrides.json` + golden fact (voir (c)), jamais en éditant le fichier de la grille.
- On ne supprime pas une catégorie utilisée par une grille passée (`packages/core/src/categories.ts`) ; on la garde et on réduit son poids (`categoryWeights` dans `tools/generator/config/generator.json`).
- Les grilles futures (date après aujourd’hui) peuvent être régénérées (`--force`), mais celle de **demain** est déjà en ligne : évitez-le.

### À ne surtout pas faire

- Pas de `git push --force` sur `main`, pas de réécriture d’historique.
- Pas de `--allow-past` ni de `--force` sur une date publiée ; pas de renommage ou suppression d’un fichier de `apps/web/public/grids/`.
- Ne pas contourner le contrôle `check` obligatoire pour faire passer une pull request qui échoue sur `grids:immutable`.
- Ne pas modifier `LAUNCH_DATE` après le lancement (le numéro d’une grille = jours depuis cette date + 1 : tout serait renuméroté), ni `hashString` ou le texte de la graine du générateur (toutes les grilles futures changeraient).
- Ne pas changer `STORAGE_PREFIX` ni le schéma du stockage local sans migration et test (les joueurs perdraient parties, statistiques et série).
- Ne pas éditer `packages/data/dist/` à la main ; ne pas publier de grille au-delà de demain (le déploiement l’interdit déjà : `grids:publish --ahead 1`).
- Ne pas annuler un run de déploiement en cours : le site pourrait rester à moitié publié. Laissez-le finir, relancez ensuite.
- Pas de cache long sur les grilles (CDN, service worker) : elles doivent rester `no-cache` / `NetworkOnly`.
