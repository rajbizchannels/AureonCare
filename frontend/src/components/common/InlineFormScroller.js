import { useEffect } from 'react';

/**
 * When a click opens an inline form below the fold ("Add location", "Edit", "New rule"…),
 * bring it into view and put the cursor in its first field, instead of leaving people to
 * hunt for it by scrolling.
 *
 * One observer for the whole app rather than a ref in every screen. It acts only when ALL of:
 *   - something was clicked (or Enter/Space on a button) in the last 1.5 s;
 *   - that button is still on the page — so a click that NAVIGATED (and replaced the view,
 *     forms and all) does not jump the new page about;
 *   - the new element is a <form>, or holds two or more fields;
 *   - it did not arrive inside a dialog that is itself just opening (a form toggled open
 *     inside a dialog that was already showing does count);
 *   - it is not already fully visible.
 * A form can opt out with data-no-autoscroll.
 */
const WINDOW_MS = 1500;
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

// True when the form arrived as part of a dialog or overlay that is itself just opening:
// those position themselves. A form toggled open INSIDE a dialog that was already showing
// (e.g. "Change password" in the profile dialog) still gets scrolled to.
function opensWithOverlay(form, added) {
  for (let n = form; n; n = n.parentElement) {
    if (n.hasAttribute && n.hasAttribute('data-no-autoscroll')) return true;
    if (n.getAttribute && (n.getAttribute('role') === 'dialog' || n.getAttribute('aria-modal') === 'true')) return n === added || added.contains(n);
    if (window.getComputedStyle(n).position === 'fixed') return n === added || added.contains(n);
    if (n === document.body) break;
  }
  return false;
}

function fullyVisible(el) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return r.top >= 0 && r.bottom <= vh;
}

function formIn(node) {
  if (!(node instanceof HTMLElement)) return null;
  if (node.tagName === 'FORM') return node;
  const f = node.querySelector('form');
  if (f) return f;
  return node.querySelectorAll(FIELDS).length >= 2 ? node : null;
}

const InlineFormScroller = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    let last = null;   // { at, target }
    const remember = (e) => { last = { at: Date.now(), target: e.target }; };
    const onKey = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('button, a, [role=button], summary')) remember(e);
    };
    let pending = null;
    const settle = (target) => {
      // Wait a frame so the form has its size and any animation has started.
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        if (!target.isConnected || fullyVisible(target)) return;
        const tall = target.getBoundingClientRect().height > (window.innerHeight * 0.8);
        target.scrollIntoView({ behavior: 'smooth', block: tall ? 'start' : 'center' });
        const active = document.activeElement;
        const busy = active && active !== document.body && active.matches && active.matches(FIELDS);
        if (!busy) {
          const first = target.querySelector(FIELDS);
          if (first) { try { first.focus({ preventScroll: true }); } catch (_) { /* old browsers */ } }
        }
      });
    };
    const obs = new MutationObserver((records) => {
      if (!last || Date.now() - last.at > WINDOW_MS) return;
      if (!last.target || !last.target.isConnected) return;   // the click replaced the view
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          const f = formIn(node);
          if (f && !opensWithOverlay(f, node) && !f.contains(last.target)) { last = null; settle(f); return; }
        }
      }
    });
    document.addEventListener('click', remember, true);
    document.addEventListener('keydown', onKey, true);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(pending);
      document.removeEventListener('click', remember, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);
  return null;
};

export default InlineFormScroller;
