import { readableTextColor, TYPE_COLORS, TYPE_LABELS_FR, type PokemonType } from '@pokeneuf/core';

export function TypeBadge({ type }: { type: PokemonType }) {
  const background = TYPE_COLORS[type];
  return (
    <span
      className="inline-block rounded-sm border-2 border-black px-1.5 py-px text-[0.65rem] leading-4 font-bold"
      style={{ background, color: readableTextColor(background) }}
    >
      {TYPE_LABELS_FR[type]}
    </span>
  );
}
