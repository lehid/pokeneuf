import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import { shareCells, shareText } from './share';
import { worldGrid as grid, worldSolution } from './test-world';

const URL = 'https://example.org/pokeneuf/';

describe('shareText', () => {
  const cells = [
    'common',
    'uncommon',
    'common',
    'veryRare',
    'common',
    'missed',
    'common',
    'rare',
    'empty',
  ] as const;

  it('follows the format of the roadmap', () => {
    expect(
      shareText({
        appName: 'PokéNeuf',
        gridId: 42,
        score: 684,
        maxScore: 900,
        streak: 12,
        cells,
        url: URL,
      }),
    ).toBe(['PokéNeuf #42 — 684/900 🔥 12', '🟩🟨🟩', '🟪🟩❌', '🟩🟧⬛', URL].join('\n'));
  });

  it('leaves the flame out when there is no streak', () => {
    const text = shareText({
      appName: 'PokéNeuf',
      gridId: 1,
      score: 0,
      maxScore: 900,
      streak: 0,
      cells,
      url: URL,
    });
    expect(text.split('\n')[0]).toBe('PokéNeuf #1 — 0/900');
  });

  it('has no Pokémon name and no category: only the title, squares and the link', () => {
    const text = shareText({
      appName: 'PokéNeuf',
      gridId: 42,
      score: 684,
      maxScore: 900,
      streak: 3,
      cells,
      url: URL,
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(5);
    for (const line of lines.slice(1, 4)) expect([...line]).toHaveLength(3);
    expect(lines[4]).toBe(URL);
  });
});

describe('shareCells', () => {
  const found = (n: number, status: GameState['status']): GameState => ({
    ...newGame(grid),
    status,
    cells: worldSolution.map((id, i) => (i < n ? id : null)),
  });
  const tiers = Array(9).fill('rare') as ('rare' | null)[];

  it('shows the rarity of each found cell', () => {
    expect(shareCells(found(9, 'won'), tiers)).toEqual(Array(9).fill('rare'));
  });

  it('marks the cells a lost game missed with ❌ and an abandoned game with ⬛', () => {
    const t = tiers.map((tier, i) => (i < 4 ? tier : null));
    expect(shareCells(found(4, 'lost'), t)).toEqual([
      ...Array(4).fill('rare'),
      ...Array(5).fill('missed'),
    ]);
    expect(shareCells(found(4, 'abandoned'), t)).toEqual([
      ...Array(4).fill('rare'),
      ...Array(5).fill('empty'),
    ]);
  });
});
