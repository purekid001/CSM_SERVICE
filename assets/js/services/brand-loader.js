const pendingLoads = new Map();
let previousFocus = null;
let lockedRegions = [];

/** Returns an idempotent close function; overlapping requests keep the loader open. */
export function showBrandLoader(message = 'กำลังโหลดข้อมูล...') {
  const overlay = document.getElementById('brand-loader');
  const label = document.getElementById('brand-loader-message');
  if (!overlay || !label) return () => {};

  const token = Symbol('brand-loader');
  if (pendingLoads.size === 0) {
    previousFocus = document.activeElement;
    lockedRegions = ['login-screen', 'dashboard-layout']
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .map(element => {
        const original = { element, inert: element.inert, busy: element.getAttribute('aria-busy') };
        element.inert = true;
        element.setAttribute('aria-busy', 'true');
        return original;
      });
  }

  pendingLoads.set(token, message);
  label.textContent = message;
  overlay.hidden = false;
  overlay.focus({ preventScroll: true });

  return () => {
    if (!pendingLoads.delete(token)) return;
    if (pendingLoads.size > 0) {
      label.textContent = Array.from(pendingLoads.values()).at(-1);
      return;
    }

    overlay.hidden = true;
    lockedRegions.forEach(({ element, inert, busy }) => {
      element.inert = inert;
      if (busy === null) element.removeAttribute('aria-busy');
      else element.setAttribute('aria-busy', busy);
    });
    lockedRegions = [];

    if (previousFocus?.isConnected && previousFocus.getClientRects().length) {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  };
}
