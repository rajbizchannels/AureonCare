import React, { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * A button that shows it is working.
 *
 * THE PROBLEM. Most buttons in this app fired an async handler and changed nothing on
 * screen until it came back. On a slow connection a save looks exactly like a click that
 * missed: nothing moves, so people click again. For a form that posts, that is a duplicate
 * record; for a payment, a duplicate payment. Several screens had a hand-rolled `busy`
 * state and several did not, so the behaviour varied button to button.
 *
 * WHAT THIS DOES. Wraps the click: while the handler's promise is pending the button is
 * disabled, the cursor becomes `wait`, a spinner replaces the icon and the label can change
 * ("Save" → "Saving…"). It resolves on both success and failure, so a rejected promise
 * leaves the button usable rather than stuck.
 *
 * `onClick` may be sync; the button simply does not enter the busy state, which is right —
 * a spinner that appears and vanishes in the same frame is worse than none.
 *
 * Deliberately NOT a global overlay. Blocking the whole screen for a one-field save makes
 * the app feel heavier, and tells the user nothing about which action is in flight.
 */
const BusyButton = React.forwardRef(({
  onClick,
  children,
  busyLabel,
  icon = null,
  busy: busyProp,
  disabled = false,
  className = '',
  type = 'button',
  spinnerClassName = 'w-4 h-4',
  ...rest
}, ref) => {
  const [running, setRunning] = useState(false);
  // Survives the component unmounting mid-request — setting state on an unmounted
  // component is a warning in the console and, for a modal that closes on success, it
  // happened on every single save.
  const alive = useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);

  const handle = useCallback(async (event) => {
    if (!onClick) return;
    const result = onClick(event);
    // Only a thenable is worth a spinner.
    if (!result || typeof result.then !== 'function') return;
    setRunning(true);
    try {
      await result;
    } catch (error) {
      // Caught, not rethrown. A rejection escaping here is an UNHANDLED promise rejection:
      // a console error in the browser, and enough to kill the test worker outright. The
      // handler owns reporting its own failure — every caller in this app already does so
      // through a notification — so this only has to stop the rejection and restore the
      // button. Logged rather than swallowed, so a handler that forgot to report is still
      // visible to whoever opens the console.
      console.error('[BusyButton] click handler failed:', error);
    } finally {
      // Both paths: a failed save must not leave the button disabled forever, which would
      // force a page reload to try again.
      if (alive.current) setRunning(false);
    }
  }, [onClick]);

  // `busy` lets a caller drive the state from outside — for a submit button whose work is
  // kicked off by the form's onSubmit rather than by this click.
  const isBusy = busyProp === undefined ? running : busyProp;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      onClick={handle}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={`${className} ${isBusy ? 'cursor-wait' : ''} disabled:opacity-60`}
    >
      {isBusy
        ? <Loader2 className={`${spinnerClassName} animate-spin`} aria-hidden="true" />
        : icon}
      {isBusy && busyLabel ? busyLabel : children}
    </button>
  );
});

BusyButton.displayName = 'BusyButton';

export default BusyButton;
