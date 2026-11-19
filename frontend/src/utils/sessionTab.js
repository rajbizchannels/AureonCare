/**
 * Session policy helpers (SEC-40, option b).
 *
 *   - Reloading a tab keeps you signed in — after the SERVER confirms who the session
 *     belongs to (nothing is trusted from browser storage).
 *   - A new browser session (a reopened browser, or a restored tab with no live
 *     AureonCare tab) starts signed out, on the server as well as on screen.
 *   - A new tab while another AureonCare tab is open shows the sign-in page and leaves the
 *     other tab's session alone.
 *   - Tabs tell each other when someone signs in or out, so no tab can show one person
 *     while the shared session cookie belongs to another.
 *
 * "Reload of this tab" is detected with a timestamp in sessionStorage — which is per-tab
 * and survives a reload — written at page load and again on `pagehide`. A reload finds a
 * timestamp from moments ago; a restored browser finds an old one (or none).
 */

const TAB_KEY = 'aureoncare.tabLastSeen';
const CHANNEL = 'aureoncare-session';
export const RELOAD_WINDOW_MS = 45 * 1000;

// A per-page-load id, so a tab ignores its own broadcasts and replies reach the asker.
export const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const read = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/** True when this page load is a reload (or same-tab return) of a tab that was just open. */
export function wasThisTabReloaded(now = Date.now()) {
  const ts = Number(read(TAB_KEY));
  return ts > 0 && now - ts >= 0 && now - ts < RELOAD_WINDOW_MS;
}

export function markTabAlive(now = Date.now()) { write(TAB_KEY, String(now)); }

/** Keep the marker fresh for the next reload. Call once, AFTER wasThisTabReloaded(). */
export function installTabMarker() {
  markTabAlive();
  try { window.addEventListener('pagehide', () => markTabAlive()); } catch { /* no window */ }
}

let channel = null;
function getChannel() {
  if (channel) return channel;
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    channel = new BroadcastChannel(CHANNEL);
  } catch { channel = null; }
  return channel;
}

/** Post a message to the other AureonCare tabs of this browser. */
export function broadcast(message) {
  const ch = getChannel();
  if (!ch) return;
  try { ch.postMessage({ ...message, from: TAB_ID }); } catch { /* ignore */ }
}

/** Listen to the other tabs. Returns an unsubscribe function. */
export function onTabMessage(handler) {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e) => { if (e && e.data && e.data.from !== TAB_ID) handler(e.data); };
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

/**
 * Is another tab of this browser signed in right now? Signed-in tabs answer a ping (see
 * AppContext). Without BroadcastChannel this answers false, i.e. the safe choice: treat
 * the load as a new browser session.
 */
export function anotherSignedInTab(timeoutMs = 300) {
  const ch = getChannel();
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    const nonce = Math.random().toString(36).slice(2);
    const done = (v) => { ch.removeEventListener('message', listener); clearTimeout(timer); resolve(v); };
    const listener = (e) => {
      const d = e && e.data;
      if (d && d.type === 'pong' && d.nonce === nonce) done(true);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    ch.addEventListener('message', listener);
    broadcast({ type: 'ping', nonce });
  });
}
