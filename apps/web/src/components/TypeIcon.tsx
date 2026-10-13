import { TYPE_ICON_PATHS, type PokemonType } from '@pokeneuf/core';

/** The home-made pictogram of a type, in the current text colour. */
export function TypeIcon({ type, size = 14 }: { type: PokemonType; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      data-type-icon={type}
    >
      <path d={TYPE_ICON_PATHS[type]} />
    </svg>
  );
}
