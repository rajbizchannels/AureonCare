// How many API requests are in flight, and who to tell when that changes.
//
// WHY THIS EXISTS. The app has around 846 buttons. Adding a spinner to each one is not a
// plan — the first attempt at this wired up BusyButton and reached exactly one component,
// so for almost everything a click still produced no visible change until the response
// arrived, and on a slow connection that is indistinguishable from a click that missed.
//
// Every request in the app goes through one function: authenticatedFetch in apiService.js.
// Counting there covers every button, including the ones nobody would think to look for,
// and costs one increment per request.
//
// Deliberately NOT React state or context: apiService is a plain module imported by
// non-component code, and threading a provider through it would mean touching every
// caller — which is the thing this avoids.

let inFlight = 0;
const listeners = new Set();

// Requests that should not raise the indicator. Polling and background refreshes are not a
// click, and a bar that flickers every few seconds on its own teaches people to ignore it,
// which costs the feedback they actually need.
const QUIET = [/\/notifications(\?|$)/, /\/health(\?|$)/, /\/auth\/refresh/];

const isQuiet = (url) => QUIET.some((re) => re.test(String(url || '')));

const notify = () => {
  for (const fn of listeners) {
    try { fn(inFlight); } catch (err) { console.error('[activity] listener failed:', err); }
  }
};

/** Call when a request starts. Returns the function to call when it settles. */
export const trackRequest = (url) => {
  if (isQuiet(url)) return () => {};
  inFlight += 1;
  notify();
  let done = false;
  return () => {
    // Guarded: a double call would drive the count negative and leave the indicator stuck
    // on for the rest of the session.
    if (done) return;
    done = true;
    inFlight = Math.max(0, inFlight - 1);
    notify();
  };
};

/** Subscribe to the count. Returns an unsubscribe function. */
export const onActivityChange = (fn) => {
  listeners.add(fn);
  // Guarded like the calls in notify(). It was not, and that made subscribing itself
  // throw: the exception escaped into whoever called this — a component's useEffect —
  // instead of staying with the listener that caused it.
  try { fn(inFlight); } catch (err) { console.error('[activity] listener failed:', err); }
  return () => listeners.delete(fn);
};

export const getInFlight = () => inFlight;

/** For tests, so one case cannot leak a stuck counter into the next. */
export const __resetActivity = () => {
  inFlight = 0;
  notify();
};
