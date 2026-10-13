import { readableTextColor, TYPE_COLORS, TYPE_LABELS_FR, type PokemonType } from '@pokeneuf/core';
import { TypeIcon } from './TypeIcon';

/** Type chip: coloured pill with the type pictogram, like the type chips of the games. */
export function TypeBadge({ type }: { type: PokemonType }) {
  const background = TYPE_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 border-black py-px pr-2 pl-1 text-[0.65rem] leading-4 font-bold"
      style={{ background, color: readableTextColor(background) }}
    >
      <TypeIcon type={type} size={12} />
      {TYPE_LABELS_FR[type]}
    </span>
  );
}
