import { useCallback, useRef, useState } from 'react';

/**
 * Track whether an async action is in flight, for buttons a form submits rather than clicks.
 *
 * BusyButton covers the common case by wrapping onClick. A `type="submit"` button is
 * driven by the form's onSubmit instead, so its busy state has to come from the handler.
 * This is that, in one place, because the alternative is each form growing its own
 * `const [saving, setSaving] = useState(false)` with its own try/finally — which is how
 * some screens ended up never clearing the flag on failure, leaving the button dead until
 * a reload.
 *
 *   const { submitting, run } = useSubmitting();
 *   <form onSubmit={run(async (e) => { e.preventDefault(); await api.save(...); })}>
 *   <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
 *
 * `run` also guards against a second submit while the first is in flight — double-clicking
 * Save on a slow connection is how a single appointment becomes two.
 */
export const useSubmitting = () => {
  const [submitting, setSubmitting] = useState(false);
  // A ref as well as state: state updates are batched, so two clicks in the same tick
  // would both see `submitting === false` and both go through.
  const inFlight = useRef(false);
  const alive = useRef(true);

  const run = useCallback((handler) => async (...args) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    try {
      return await handler(...args);
    } finally {
      inFlight.current = false;
      if (alive.current) setSubmitting(false);
    }
  }, []);

  // Callers that unmount on success (a modal closing) would otherwise set state on an
  // unmounted component.
  const dispose = useCallback(() => { alive.current = false; }, []);

  return { submitting, run, dispose };
};

export default useSubmitting;
