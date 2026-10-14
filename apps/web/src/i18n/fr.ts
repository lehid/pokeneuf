/** All French UI strings. Never hard-code UI text in components. */
export const fr = {
  tagline: 'Chaque jour, une grille 3×3 à remplir avec les bons Pokémon.',
  ogTagline: 'Une grille 3×3 à remplir, chaque jour.',
  ogDetails: 'Générations 1 à 4 · gratuit · sans pub',
  gridTitle: (n: number) => `Grille n° ${n}`,
  demoGrid: 'Grille de démonstration',
  gridDate: (isoDate: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${isoDate}T12:00:00Z`)),

  difficultyLabel: 'Difficulté',
  difficulty: {
    veryEasy: 'Très facile',
    easy: 'Facile',
    medium: 'Intermédiaire',
    hard: 'Difficile',
    veryHard: 'Très difficile',
  },
  difficultyAria: (level: string, index: number, total: number) =>
    `Difficulté de la grille : ${level} (${index} sur ${total})`,

  archivesButton: 'Archives',
  archivesTitle: 'Archives',
  archivesIntro:
    'Rejouez les grilles passées. Une archive ne compte ni dans vos stats ni dans votre série.',
  backToArchives: '← Archives',
  archiveLabel: 'Archive',
  archiveStatus: {
    unplayed: 'Non jouée',
    inProgress: 'En cours',
    dailyDone: 'Terminée en daily',
    archiveDone: 'Terminée en archive',
  },
  archiveFound: (found: number) => `${found}/9 trouvés`,
  archiveRowLabel: (n: number, date: string, status: string) =>
    `Grille n° ${n}, ${date} : ${status}`,
  archiveAction: { unplayed: 'Jouer', inProgress: 'Reprendre', done: 'Voir' },
  pagePrevious: 'Précédent',
  pageNext: 'Suivant',
  pageOf: (page: number, pages: number) => `Page ${page} sur ${pages}`,
  paginationLabel: 'Pagination des archives',
  archivesEmpty: 'Pas encore d’archive : les grilles passées apparaîtront ici dès demain.',
  archiveNote:
    'Terminée après le jour de la grille, cette partie est une archive : elle ne compte ni dans les stats ni dans la série.',
  gridUnavailable: 'Cette grille n’est pas disponible.',
  gridUnavailableTitle: 'Grille introuvable',

  loading: 'Chargement de la grille…',
  noGridTitle: 'Pas de grille aujourd’hui',
  noGrid: 'Pas de grille aujourd’hui, revenez demain.',
  noGridRetry: 'La page se met à jour toute seule si la grille arrive.',
  notLaunched: (date: string) => `Le jeu ouvre le ${date}. Revenez ce jour-là !`,
  launchDate: (isoDate: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${isoDate}T12:00:00Z`)),
  tryDemo: 'Essayer la grille de démonstration',
  loadError: 'Impossible de charger la grille du jour.',
  retry: 'Réessayer',
  newGridTitle: 'Nouvelle grille\u00A0!',
  newGridText: 'Un nouveau jour a commencé : la grille du jour a changé.',
  newGridPlay: 'Jouer la nouvelle grille',
  newGridLater: 'Plus tard',
  backToToday: 'Grille du jour',
  disclaimer:
    'Projet de fan non officiel, non affilié à Nintendo, Game Freak ou The Pokémon Company.',

  lives: (left: number, max: number) => `${left} vie${left > 1 ? 's' : ''} sur ${max}`,
  errorsLabel: 'Erreurs',
  rulesButton: 'Règles',
  abandonButton: 'Abandonner',
  resultButton: 'Résultat',
  boardLabel: 'Grille de jeu',
  cornerLabel: 'Lignes et colonnes',
  rowHeader: (label: string) => `Ligne : ${label}`,
  colHeader: (label: string) => `Colonne : ${label}`,
  emptyCell: (row: string, col: string) => `Case vide, ${row} et ${col}`,
  filledCell: (name: string, number: string, row: string, col: string) =>
    `${name}, ${number}, ${row} et ${col}`,
  unfoundCell: (row: string, col: string) =>
    `Case non trouvée, ${row} et ${col}. Voir les réponses`,
  reviewHint: 'Touchez une case pour voir toutes les bonnes réponses.',

  definition: 'Définition',
  close: 'Fermer',

  guessTitle: (row: string, col: string) => `${row} × ${col}`,
  guessLabel: 'Nom ou numéro du Pokémon',
  guessPlaceholder: 'Nom, nom anglais ou n°…',
  noResult: 'Aucun Pokémon trouvé.',
  alreadyUsed: 'déjà utilisé',

  announceCorrect: (name: string) => `Correct : ${name}.`,
  announceWrong: (name: string, left: number) =>
    `Raté : ${name} ne convient pas. ${left === 0 ? 'Plus de vie.' : `Il reste ${left} vie${left > 1 ? 's' : ''}.`}`,

  rulesTitle: 'Comment jouer',
  rules: [
    'Remplissez les 9 cases avec un Pokémon qui correspond à la ligne ET à la colonne.',
    'Chaque Pokémon ne peut être utilisé qu’une seule fois.',
    '3 erreurs maximum : à la troisième, la partie est perdue.',
    'Touchez un intitulé pour lire sa définition exacte.',
    'Générations 1 à 4 seulement (493 Pokémon), avec les types actuels (Fée incluse).',
  ],
  hideRules: 'Ne plus afficher',
  play: 'Jouer',

  abandonTitle: 'Abandonner\u00A0?',
  abandonQuestion: 'Voulez-vous vraiment abandonner ?',
  abandonYes: 'Oui, abandonner',
  abandonNo: 'Continuer à jouer',

  endWon: 'Bravo, grille complète\u00A0!',
  endLost: 'Perdu…',
  endAbandoned: 'Partie abandonnée',
  endFound: (found: number, errors: number) =>
    `${found}/9 trouvés · ${errors} erreur${errors > 1 ? 's' : ''}`,
  endScore: 'Score',
  titleLabel: 'Titre',
  titles: {
    curious: 'Curieux',
    trainer: 'Dresseur',
    expert: 'Expert',
    champion: 'Champion',
    legend: 'Légende',
  },
  bestTitle: 'Meilleur titre',
  scoreOutOf: (score: number, max: number) => `${score}/${max}`,
  scoreLabel: 'Score',
  streakLabel: (n: number) => `Série de ${n} jour${n > 1 ? 's' : ''}`,
  rarestAnswer: 'Réponse la plus rare',
  rarityEstimated: 'Rareté estimée',
  rarity: {
    common: 'Commun',
    uncommon: 'Peu commun',
    rare: 'Rare',
    veryRare: 'Très rare',
  },
  cellRarity: (tier: string) => `rareté estimée : ${tier}`,
  share: 'Partager',
  copied: 'Résultat copié dans le presse-papiers.',
  shared: 'Résultat partagé.',
  shareFailed: 'Impossible de partager ou de copier le résultat.',
  statsButton: 'Stats',
  statsTitle: 'Statistiques',
  statsPlayed: 'Parties',
  statsWinRate: 'Victoires',
  statsAverage: 'Score moyen',
  statsBest: 'Meilleur score',
  statsStreak: 'Série',
  statsMaxStreak: 'Meilleure série',
  statsDistribution: 'Répartition des scores',
  statsBucket: (from: number, to: number) => `${from} à ${to}`,
  statsEmpty: 'Aucune partie terminée pour l’instant.',
  seeSolutions: 'Voir les solutions',

  solutionsTitle: 'Bonnes réponses',
  solutionsSorted: 'Du plus connu au plus rare.',
  solutionsCount: (n: number) => `${n} réponse${n > 1 ? 's' : ''} possible${n > 1 ? 's' : ''}`,
  footer: {
    nav: 'Informations',
    faq: 'FAQ',
    changelog: 'Nouveautés',
    legal: 'Mentions légales',
    archives: 'Archives',
    source: 'Code source',
  },
  backToGame: '← Retour au jeu',
  homeLink: 'Retour à la grille du jour',

  familyLabels: {
    type: 'Types',
    generation: 'Générations',
    evolution: 'Évolution',
    status: 'Statut',
    form: 'Formes',
    stats: 'Statistiques de base',
    color: 'Couleur du Pokédex',
    shape: 'Silhouette',
    size: 'Taille',
    name: 'Nom',
  },

  faq: {
    title: 'Questions fréquentes',
    intro:
      'Les règles, les définitions de chaque catégorie, le calcul du score et l’origine des données.',
    toc: 'Sommaire',
    sections: {
      play: {
        title: 'Comment jouer ?',
        paragraphs: [
          'Chaque jour, une nouvelle grille de 3 lignes et 3 colonnes apparaît à minuit, heure de Paris. Chaque case attend un Pokémon qui répond à la fois au critère de sa ligne et à celui de sa colonne.',
          'Touchez une case, tapez un nom (français ou anglais) ou un numéro de Pokédex, puis choisissez dans la liste. Un Pokémon ne peut servir qu’une fois dans la grille. À la troisième erreur, la partie est perdue.',
          'Il n’y a qu’une partie par grille : pas de nouvel essai. Vous pouvez abandonner à tout moment, ou rejouer les grilles passées depuis les archives.',
        ],
      },
      categories: {
        title: 'Que veut dire chaque catégorie ?',
        intro: (count: number) =>
          `Voici les ${count} catégories qui peuvent apparaître. Cette liste est générée à partir du jeu lui-même : c’est exactement la définition utilisée pour valider vos réponses. Dans le jeu, touchez un intitulé pour la lire.`,
        inGame:
          'Toutes les définitions s’entendent « parmi les Pokémon du jeu » (générations 1 à 4).',
      },
      score: {
        title: 'Comment est calculé le score ?',
        main: (rules: { base: number; bonus: number; penalty: number; max: number }) =>
          `Chaque bonne réponse rapporte ${rules.base} points, plus jusqu’à ${rules.bonus} points selon sa rareté : plus la réponse est rare parmi toutes celles possibles pour la case, plus elle rapporte. Chaque erreur retire ${rules.penalty} points. Le score est compris entre 0 et ${rules.max}.`,
        paragraphs: [
          'Le bonus de rareté n’est pas proportionnel : une réponse un peu moins courante rapporte déjà l’essentiel du bonus, et le haut du classement reste atteignable sans viser l’obscur à chaque case.',
          'Le score donne aussi un titre :',
        ],
        titleLine: (title: string, from: number) =>
          `${title} : à partir de ${from} point${from > 1 ? 's' : ''}`,
      },
      rarity: {
        title: 'Que signifie la rareté estimée ?',
        paragraphs: [
          'Le site n’a pas de serveur et ne sait donc pas ce que les autres joueurs répondent : la rareté est une estimation de la notoriété d’un Pokémon (sa génération, s’il est un starter, un légendaire, un stade final, et une liste de Pokémon emblématiques établie à la main). Ce n’est pas un pourcentage de joueurs.',
          'Pour chaque case, les réponses possibles sont classées du Pokémon le plus connu au plus obscur, et la rareté dépend de la place de votre réponse dans ce classement :',
        ],
        tierRules: [
          'parmi le quart des réponses les plus connues de la case',
          'entre 25 % et 50 % du classement',
          'entre 50 % et 75 % du classement',
          'parmi le quart des réponses les plus obscures',
        ],
      },
      streak: {
        title: 'À quoi servent la série et les statistiques ?',
        paragraphs: [
          'La série compte les jours de suite où vous avez terminé la grille du jour, gagnée ou perdue. Un jour sans partie, ou une partie abandonnée, remet la série à zéro.',
          'Une partie ne compte dans la série et les statistiques que si elle se termine le jour de sa grille (heure de Paris). Une partie finie après minuit, ou depuis les archives, ne compte pas.',
          'Tout reste dans votre navigateur : effacer les données du site efface vos statistiques et votre série.',
        ],
      },
      data: {
        title: 'D’où viennent les données ?',
        paragraphs: [
          'Les fiches (types, statistiques, taille, évolutions…) viennent de PokéAPI, complétées et corrigées à la main là où c’est nécessaire (starters, fossiles, légendaires, Méga-évolutions, Pokémon les plus connus…). Les noms affichés sont les noms français officiels ; la recherche accepte aussi les noms anglais et les numéros.',
          'Une erreur, une définition discutable ? Signalez-la depuis le dépôt du projet : chaque correction est ajoutée aux données, avec un test pour ne pas la perdre.',
        ],
      },
      generations: {
        title: 'Pourquoi seulement les générations 1 à 4 ?',
        text: (count: number) =>
          `Le jeu couvre les ${count} premiers Pokémon (numéros 1 à ${count}, de Kanto à Sinnoh) : assez pour des grilles variées, assez peu pour que chacun puisse en connaître la plupart. Les générations suivantes pourront être ajoutées plus tard.`,
      },
      types: {
        title: 'Quels types sont utilisés ?',
        paragraphs: [
          'Les types actuels, ceux des jeux récents, type Fée inclus : Mélofée est de type Fée, Marill est Eau/Fée et Togepi est Fée. Ils peuvent donc différer de ce que vous avez connu dans les premières versions des jeux.',
        ],
      },
      evolutions: {
        title: 'Comment sont comptées les évolutions ?',
        paragraphs: [
          'Les évolutions sont comptées parmi les Pokémon du jeu uniquement. Un « stade final » est un Pokémon qui n’évolue en aucun Pokémon des générations 1 à 4 : Colossinge est donc un stade final ici, même si Courrousinge existe dans une génération plus récente.',
          'Les formes régionales (Alola, Galar, Hisui) n’existent pas dans le jeu. Les Méga-évolutions et formes Gigamax ne sont pas des entrées à part : « a une Méga-évolution » est simplement un critère possible.',
        ],
      },
    },
  },

  legal: {
    title: 'Mentions légales',
    todo: 'À compléter',
    sections: {
      publisher: {
        title: 'Éditeur du site',
        labels: {
          name: 'Nom ou pseudonyme de l’éditeur',
          status: 'Statut (particulier, association…)',
          address: 'Adresse (ou mention de l’hébergeur si l’éditeur reste anonyme)',
          director: 'Directeur de la publication',
          contact: 'Adresse de contact',
        },
        contactIssues: 'Suivi des demandes et signalements',
      },
      host: {
        title: 'Hébergeur',
        text: 'Le site est hébergé par GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.',
        link: 'Site de GitHub',
      },
      affiliation: {
        title: 'Propriété intellectuelle et non-affiliation',
        paragraphs: [
          'Ce site est un projet de fan, gratuit, sans publicité et non officiel. Il n’est ni affilié à, ni approuvé, ni sponsorisé par Nintendo, Game Freak, Creatures Inc. ou The Pokémon Company.',
          'Pokémon et les noms des Pokémon sont des marques de leurs propriétaires respectifs. Le site n’utilise aucune image officielle : les pictogrammes et les couleurs sont dessinés pour ce projet.',
          'Les données de référence proviennent de PokéAPI.',
        ],
      },
      privacy: {
        title: 'Données personnelles',
        paragraphs: [
          'Le site ne dépose aucun cookie, n’utilise aucun traceur ni aucune publicité, et ne vous demande aucun compte.',
          'Votre progression, vos statistiques et vos préférences sont enregistrées uniquement dans le stockage local de votre navigateur. Elles ne sont jamais envoyées à un serveur et vous pouvez les effacer à tout moment depuis les réglages de votre navigateur.',
          'Comme pour tout site web, l’hébergeur peut journaliser l’adresse IP des visites dans ses journaux techniques, selon sa propre politique de confidentialité.',
        ],
      },
    },
  },

  changelog: {
    title: 'Nouveautés',
    intro: 'Ce qui change dans le jeu, version après version.',
  },
} as const;
