import { RARITY_COLORS, readableTextColor, type RarityTier } from '@pokeneuf/core';
import { fr } from '../i18n/fr';

/** Estimated rarity of an answer: a coloured tag, the same colours as the shared squares. */
export function RarityChip({ tier, compact = false }: { tier: RarityTier; compact?: boolean }) {
  const background = RARITY_COLORS[tier];
  return (
    <span
      className={`inline-block border-2 border-black font-bold ${
        compact ? 'px-1 text-[0.6rem] leading-4' : 'px-1.5 text-xs leading-5'
      }`}
      style={{ background, color: readableTextColor(background) }}
      data-tier={tier}
      title={fr.cellRarity(fr.rarity[tier])}
    >
      {fr.rarity[tier]}
    </span>
  );
}
