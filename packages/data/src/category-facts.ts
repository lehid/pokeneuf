/**
 * Hand-written facts about the categories, checked against the real Pokédex and the shipped
 * `dist/memberships.json` (ROADMAP phase 2: at least 3 positive and 3 negative facts per category).
 * Written from game knowledge, never from the build output. Numbers are national Pokédex numbers.
 *
 * Reminders: current types (Fairy included), evolutions relative to Gen 1-4, abilities of the
 * current games (hidden ones count), Mega Evolutions of the current games.
 *
 * Handy numbers: 1 Bulbizarre · 4 Salamèche · 7 Carapuce · 25 Pikachu · 133 Évoli · 143 Ronflex.
 */
export interface CategoryFact {
  /** Members, by national number. */
  in: number[];
  /** Non-members. */
  out: number[];
}

export const CATEGORY_FACTS: Record<string, CategoryFact> = {
  // --- Types (18) -----------------------------------------------------------------------------
  'type-normal': { in: [16, 19, 39, 133, 143, 493], out: [1, 4, 7, 25] },
  'type-fire': { in: [4, 6, 37, 59, 157], out: [1, 7, 25, 92] },
  'type-water': { in: [7, 54, 130, 183, 260], out: [4, 25, 74, 92] },
  'type-electric': { in: [25, 81, 135, 466, 479], out: [1, 4, 7, 95] },
  'type-grass': { in: [1, 43, 152, 254, 470], out: [4, 7, 25, 95] },
  'type-ice': { in: [124, 131, 144, 471, 361], out: [1, 4, 6, 25] },
  'type-fighting': { in: [56, 66, 106, 447, 448], out: [1, 25, 143, 150] },
  'type-poison': { in: [1, 23, 41, 92, 109], out: [4, 7, 25, 143] },
  'type-ground': { in: [27, 50, 74, 95, 445], out: [1, 4, 7, 25] },
  'type-flying': { in: [6, 16, 41, 142, 249], out: [1, 4, 7, 25] },
  'type-psychic': { in: [63, 122, 150, 196, 280], out: [4, 7, 25, 143] },
  'type-bug': { in: [10, 13, 123, 214, 292], out: [1, 4, 7, 25] },
  'type-rock': { in: [74, 95, 138, 142, 299], out: [1, 4, 7, 25] },
  'type-ghost': { in: [92, 94, 200, 292, 479], out: [1, 4, 7, 25] },
  'type-dragon': { in: [147, 149, 371, 445, 483], out: [4, 7, 25, 130] },
  'type-dark': { in: [197, 215, 228, 248, 359, 491], out: [1, 4, 7, 25] },
  'type-steel': { in: [81, 208, 212, 376, 448], out: [1, 4, 7, 25] },
  'type-fairy': { in: [35, 39, 122, 175, 183, 282], out: [1, 4, 25, 133] },
  'type-mono': { in: [4, 7, 25, 133, 143, 150], out: [1, 6, 94, 448] },
  'type-dual': { in: [1, 6, 94, 183, 448], out: [4, 7, 25, 133] },

  // --- Generations ----------------------------------------------------------------------------
  'gen-1': { in: [1, 25, 150, 151], out: [152, 172, 252, 387] },
  'gen-2': { in: [152, 172, 249, 251], out: [1, 25, 252, 387] },
  'gen-3': { in: [252, 280, 384, 386], out: [1, 152, 250, 387] },
  'gen-4': { in: [387, 448, 462, 493], out: [1, 152, 252, 386] },

  // --- Evolution (relative to Gen 1-4) --------------------------------------------------------
  'evo-base': { in: [1, 4, 133, 172, 447], out: [2, 3, 25, 132] },
  'evo-middle': { in: [2, 5, 25, 64, 281], out: [1, 3, 26, 132] },
  'evo-final': { in: [3, 6, 26, 57, 448, 462], out: [1, 2, 83, 132] }, // Colossinge: Annihilape is Gen 9
  'evo-none': { in: [83, 115, 128, 132, 150], out: [1, 25, 26, 143] }, // Ronflex has Goinfrex
  'evo-stone': { in: [25, 37, 58, 90, 133], out: [3, 26, 64, 129] },
  'evo-trade': { in: [64, 67, 75, 93, 125], out: [1, 25, 66, 133] },
  'evo-friendship': { in: [42, 172, 175, 447], out: [1, 25, 129, 143] },
  'evo-stage-3': { in: [3, 6, 9, 26, 157, 248], out: [1, 2, 25, 133, 150] },
  'evo-baby': { in: [172, 175, 439, 440, 447], out: [1, 25, 26, 133] },
  'evo-gen4': { in: [122, 143, 448, 462, 468], out: [1, 25, 26, 133, 196] },

  // --- Status ---------------------------------------------------------------------------------
  'status-legendary': { in: [144, 150, 249, 384, 486, 488], out: [25, 149, 151, 251] },
  'status-mythical': { in: [151, 251, 385, 491, 493], out: [1, 25, 150, 249] },
  'status-starter': { in: [1, 6, 157, 258, 395], out: [25, 37, 133, 172] },
  'status-fossil': { in: [138, 142, 345, 410, 411], out: [1, 25, 74, 143] },
  'status-pseudo': { in: [149, 248, 373, 376, 445], out: [25, 147, 246, 443] },

  // --- Forms ----------------------------------------------------------------------------------
  'form-mega': { in: [3, 6, 26, 36, 150, 448], out: [1, 7, 25, 133, 143] },
  'form-gmax': { in: [6, 12, 25, 133, 143], out: [1, 4, 150, 448] },

  // --- Stats ----------------------------------------------------------------------------------
  'stat-total-500': { in: [6, 130, 143, 150, 248, 445], out: [1, 4, 25, 129, 133] },
  'stat-total-300': { in: [10, 129, 172, 292, 298], out: [1, 25, 133, 150] },
  'stat-attack-100': { in: [68, 127, 150, 445, 448], out: [1, 7, 25, 133] },
  'stat-speed-100': { in: [6, 65, 135, 291, 445], out: [1, 25, 133, 143] },

  // --- Colour, shape, size --------------------------------------------------------------------
  'color-red': { in: [4, 6, 98, 129, 250], out: [1, 7, 25, 143] },
  'color-blue': { in: [7, 9, 130, 131, 382], out: [1, 4, 25, 143] },
  'color-green': { in: [1, 2, 3, 123, 252], out: [4, 7, 25, 143] },
  'color-yellow': { in: [25, 26, 135, 145], out: [1, 4, 7, 150] },
  'color-purple': { in: [19, 48, 94, 190, 301], out: [1, 6, 25, 133] },
  'color-brown': { in: [13, 59, 107, 185, 287], out: [1, 6, 25, 150] },
  'shape-quadruped': { in: [1, 58, 59, 133, 128], out: [16, 23, 100, 129] },
  'shape-wings': { in: [16, 21, 22, 41, 142, 12, 193], out: [1, 100, 129, 133, 6] }, // bug-wings count, Charizard does not
  'shape-upright': { in: [4, 64, 160, 240, 312, 68, 65, 282], out: [1, 25, 133, 129] }, // humanoids count too
  'size-height-2m': { in: [95, 130, 143, 321, 384], out: [1, 25, 92, 133] },
  'size-height-50cm': { in: [7, 98, 182, 270, 343], out: [1, 4, 6, 150] }, // Bulbizarre is 70 cm

  // --- Names (French, accents ignored) --------------------------------------------------------
  'name-starts-c': { in: [7, 8, 10, 57, 83], out: [1, 25, 133, 6] },
  'name-short': { in: [122, 133, 151, 172, 250], out: [1, 25, 29, 150] }, // M. Mime has 5 letters
  'name-starts-vowel': { in: [13, 86, 133, 134, 224, 310], out: [1, 25, 150, 193] }, // Évoli: É is E; Yanma: Y is not a vowel
  'name-ends-a': { in: [19, 86, 216, 281, 315, 384], out: [1, 25, 133, 150] },
  'name-long': { in: [1, 50, 108, 160, 273, 418], out: [6, 25, 133, 150] },
  'name-has-k': { in: [9, 96, 158, 283, 352, 401], out: [1, 6, 133, 150] },
  'name-has-y': { in: [11, 116, 193, 246, 300, 382], out: [1, 25, 133, 150] },
  'name-has-x': { in: [37, 95, 143, 178, 194, 386], out: [1, 25, 133, 150] },
  'name-has-z': { in: [1, 65, 212, 298, 384, 401, 474], out: [6, 25, 133, 150] }, // Porygon-Z
  'name-has-ou': { in: [16, 70, 174, 255, 387, 406], out: [1, 25, 133, 150] },
  'name-has-ch': { in: [4, 66, 172, 293, 340, 412], out: [1, 6, 133, 150] },
  'name-double-letter': { in: [1, 72, 149, 229, 307, 427], out: [6, 25, 133, 250] }, // Ho-Oh: the dash separates the two O
  'name-same-ends': { in: [29, 63, 121, 154, 213, 250, 334], out: [1, 25, 133, 150] }, // Nidoran♀, Ho-Oh
};

/**
 * Whole cells whose complete answer list is known by heart. `rows` × `cols` → exact answers.
 */
export const CELL_FACTS: { row: string; col: string; answers: number[] }[] = [
  { row: 'type-fire', col: 'gen-1', answers: [4, 5, 6, 37, 38, 58, 59, 77, 78, 126, 136, 146] },
  { row: 'type-dragon', col: 'gen-1', answers: [147, 148, 149] },
  { row: 'type-fairy', col: 'gen-1', answers: [35, 36, 39, 40, 122] },
  {
    row: 'status-starter',
    col: 'type-fire',
    answers: [4, 5, 6, 155, 156, 157, 255, 256, 257, 390, 391, 392],
  },
  {
    row: 'status-legendary',
    col: 'type-psychic',
    answers: [150, 249, 380, 381, 480, 481, 482, 488],
  },
  { row: 'evo-baby', col: 'gen-4', answers: [406, 433, 438, 439, 440, 446, 447, 458] },
  { row: 'gen-1', col: 'gen-2', answers: [] },
  { row: 'type-electric', col: 'type-steel', answers: [81, 82, 462] },
];
