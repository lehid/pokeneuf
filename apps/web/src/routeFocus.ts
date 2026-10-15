/**
 * After a change of page (the hash changed), the focus must go to the new page's heading, as a
 * page load would do, and the screen reader reads where it is. But not on the first load, and not
 * when the heading appears later for another reason: so a route change raises a flag, and the first
 * page heading that appears takes it.
 */
let pending = false;

export function requestRouteFocus(): void {
  pending = true;
}

/** Was a focus move requested? Reading it clears it. */
export function takeRouteFocus(): boolean {
  const was = pending;
  pending = false;
  return was;
}
