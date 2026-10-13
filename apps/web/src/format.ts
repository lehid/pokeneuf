/** National number as shown to the player: `#025`. */
export function formatNumber(id: number): string {
  return `#${String(id).padStart(3, '0')}`;
}
