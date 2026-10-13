import { describe, expect, it } from 'vitest';
import { POKEDEX_COLORS, POKEMON_TYPES } from './pokedex';
import { RARITY_TIERS } from './scoring';
import {
  BLACK,
  cellBackground,
  cellTextColor,
  cellTextContrast,
  contrastRatio,
  POKEDEX_COLOR_SWATCHES,
  RARITY_COLORS,
  readableTextColor,
  relativeLuminance,
  TYPE_COLORS,
  TYPE_ICON_PATHS,
  TYPE_LABELS_FR,
  WCAG_AA,
  WHITE,
} from './theme';

describe('palette', () => {
  it('has a #RRGGBB colour and a French label for each of the 18 types', () => {
    expect(Object.keys(TYPE_COLORS).sort()).toEqual([...POKEMON_TYPES].sort());
    expect(Object.keys(TYPE_LABELS_FR).sort()).toEqual([...POKEMON_TYPES].sort());
    for (const color of Object.values(TYPE_COLORS)) expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('uses the community palette of ROADMAP §2.5', () => {
    expect(TYPE_COLORS.fire).toBe('#EE8130');
    expect(TYPE_COLORS.water).toBe('#6390F0');
    expect(TYPE_COLORS.fairy).toBe('#D685AD');
    expect(TYPE_LABELS_FR.electric).toBe('Électrik');
    expect(TYPE_LABELS_FR.dark).toBe('Ténèbres');
    expect(TYPE_LABELS_FR.fairy).toBe('Fée');
  });

  it('has a distinct colour per type, and a swatch per Pokédex colour', () => {
    expect(new Set(Object.values(TYPE_COLORS)).size).toBe(18);
    expect(Object.keys(POKEDEX_COLOR_SWATCHES).sort()).toEqual([...POKEDEX_COLORS].sort());
  });
});

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', WHITE)).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('rejects anything but #RRGGBB', () => {
    expect(() => relativeLuminance('red')).toThrow(/#RRGGBB/);
    expect(() => relativeLuminance('#fff')).toThrow(/#RRGGBB/);
  });
});

describe('readableTextColor', () => {
  it('picks black on light and white on dark', () => {
    expect(readableTextColor('#FFFFFF')).toBe(BLACK);
    expect(readableTextColor('#F7D02C')).toBe(BLACK);
    expect(readableTextColor(BLACK)).toBe(WHITE);
    expect(readableTextColor('#735797')).toBe(WHITE);
  });

  it('always meets WCAG AA on a single colour, over the whole RGB cube', () => {
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          expect(contrastRatio(readableTextColor(hex), hex), hex).toBeGreaterThanOrEqual(WCAG_AA);
        }
      }
    }
  });

  it('meets WCAG AA on every type colour', () => {
    for (const type of POKEMON_TYPES) {
      const background = TYPE_COLORS[type];
      expect(contrastRatio(readableTextColor(background), background), type).toBeGreaterThanOrEqual(
        WCAG_AA,
      );
    }
  });

  it('maximises the worst contrast over several colours', () => {
    const colors = ['#F7D02C', '#735797']; // yellow and ghost purple
    const chosen = readableTextColor(colors);
    const other = chosen === BLACK ? WHITE : BLACK;
    const worst = (text: string) => Math.min(...colors.map((c) => contrastRatio(text, c)));
    expect(worst(chosen)).toBeGreaterThanOrEqual(worst(other));
  });
});

describe('cellBackground', () => {
  it('is a flat colour for one type', () => {
    expect(cellBackground(['fire'])).toBe('#EE8130');
  });

  it('is a diagonal gradient from the first to the second type', () => {
    expect(cellBackground(['grass', 'poison'])).toBe(
      'linear-gradient(135deg, #7AC74C 0%, #A33EA1 100%)',
    );
  });

  it('refuses a Pokémon without type', () => {
    expect(() => cellBackground([])).toThrow();
  });
});

describe('cell text', () => {
  it('is readable on every single-type cell', () => {
    for (const type of POKEMON_TYPES)
      expect(cellTextContrast([type]), type).toBeGreaterThanOrEqual(WCAG_AA);
  });

  it('takes the worst of the two colours for a two-type cell', () => {
    const types = ['electric', 'ghost'] as const;
    const text = cellTextColor(types);
    const expected = Math.min(
      contrastRatio(text, TYPE_COLORS.electric),
      contrastRatio(text, TYPE_COLORS.ghost),
    );
    expect(cellTextContrast(types)).toBeCloseTo(expected, 10);
  });

  it('flags the gradients where text cannot be read directly (the UI then needs a plate)', () => {
    expect(cellTextContrast(['electric', 'ghost'])).toBeLessThan(WCAG_AA);
    expect(cellTextContrast(['ground', 'steel'])).toBeGreaterThanOrEqual(WCAG_AA);
  });
});

describe('type pictograms', () => {
  it('has one drawing per type, made of valid path commands on a 24×24 grid', () => {
    expect(Object.keys(TYPE_ICON_PATHS).sort()).toEqual([...POKEMON_TYPES].sort());
    for (const type of POKEMON_TYPES) {
      const path = TYPE_ICON_PATHS[type];
      expect(path, type).toMatch(/^M[MmLlHhVvCcSsAaZz0-9\s.,-]+$/);
      expect(path.endsWith('Z'), type).toBe(true);
      const numbers = (path.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      expect(numbers.length, type).toBeGreaterThan(6);
    }
  });

  it('gives every type a different drawing', () => {
    expect(new Set(Object.values(TYPE_ICON_PATHS)).size).toBe(POKEMON_TYPES.length);
  });
});

describe('rarity colours', () => {
  it('has one readable colour per tier, matching the tiers of the scoring module', () => {
    expect(Object.keys(RARITY_COLORS)).toEqual([...RARITY_TIERS]);
    for (const color of Object.values(RARITY_COLORS)) {
      expect(contrastRatio(readableTextColor(color), color)).toBeGreaterThanOrEqual(WCAG_AA);
    }
  });
});
