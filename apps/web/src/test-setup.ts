// jsdom has no <dialog> behaviour: give it the bits our modals rely on, the way browsers do them.
// What matters for the tests that catch real bugs:
//  - `close()` fires its `close` event LATER (a queued task), not synchronously;
//  - showModal() moves the focus into the dialog, and close() gives it back to the previously
//    focused element, but only when the dialog is still in the document (React removes an open
//    dialog before the cleanup runs, and then the browser does not restore anything).
if (typeof HTMLDialogElement !== 'undefined') {
  const previousFocus = new WeakMap<HTMLDialogElement, Element | null>();
  const FOCUSABLE = 'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    previousFocus.set(this, document.activeElement);
    this.setAttribute('open', '');
    const target = this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector(FOCUSABLE);
    (target as HTMLElement | null)?.focus();
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    const previous = previousFocus.get(this);
    if (this.isConnected && previous instanceof HTMLElement && previous.isConnected) {
      previous.focus();
    }
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
}

// jsdom does not implement scrolling; the route changes ask for it.
if (typeof window !== 'undefined') window.scrollTo = () => undefined;
