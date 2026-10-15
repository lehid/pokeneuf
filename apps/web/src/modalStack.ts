import { useSyncExternalStore } from 'react';

/**
 * The modal dialogs currently open, innermost last. A native modal `<dialog>` makes everything
 * outside of it inert, so a message (the "copied" toast) is only announced by a screen reader if it
 * lives INSIDE the innermost open dialog, or in the page when none is open.
 */
let stack: readonly string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function pushModal(id: string): void {
  stack = [...stack.filter((open) => open !== id), id];
  emit();
}

export function removeModal(id: string): void {
  if (!stack.includes(id)) return;
  stack = stack.filter((open) => open !== id);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The id of the innermost open modal, `null` when the page itself is what the player sees. */
export function useInnermostModal(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => stack[stack.length - 1] ?? null,
    () => null,
  );
}

/**
 * Where the focus goes back to when a dialog is gone: the control that was focused when it opened
 * and, in case that one has disappeared since, the places it would have gone back to itself. The
 * "Oui, abandonner" button is destroyed with its dialog while the result dialog opens in its place:
 * the focus must then fall back to the control that opened the question, not to the page.
 */
const chains = new WeakMap<Element, HTMLElement[]>();

/** The focus fallbacks for a dialog that opens while `active` has the focus. */
export function focusChainFor(active: HTMLElement | null): HTMLElement[] {
  if (active === null) return [];
  const host = active.closest('dialog');
  return [active, ...(host ? (chains.get(host) ?? []) : [])];
}

export function rememberFocusChain(dialog: HTMLDialogElement, chain: HTMLElement[]): void {
  chains.set(dialog, chain);
}

/** Focuses the first place of the chain that is still on the page, else the heading of the page. */
export function restoreFocus(chain: readonly HTMLElement[]): void {
  const target =
    chain.find((element) => element.isConnected && element !== document.body) ??
    document.querySelector<HTMLElement>('[data-page-heading]');
  target?.focus();
}
