import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

/**
 * Landing page after Stripe Checkout.
 *
 * It only WATCHES — provisioning is driven by Stripe's signed webhook, not by the browser
 * arriving here. That is deliberate: a customer who closes the tab still gets their
 * workspace, and someone who guesses this URL gets nothing.
 */
const SignupCompletePage = ({ theme = 'light', intentId, onSignIn }) => {
  const dark = theme === 'dark';
  const [state, setState] = useState('waiting'); // waiting | ready | failed | timeout
  const api = require('../../api/apiService').default;

  useEffect(() => {
    if (!intentId) { setState('failed'); return; }
    let alive = true;
    let tries = 0;

    const poll = async () => {
      if (!alive) return;
      try {
        const s = await api.signupStatus(intentId);
        if (!alive) return;
        if (s.ready) return setState('ready');
        if (s.status === 'failed') return setState('failed');
      } catch {
        // A transient error should not end the wait — keep polling.
      }
      // Provisioning builds a whole schema; give it up to ~2 minutes before giving up.
      if (++tries > 60) return setState('timeout');
      setTimeout(poll, 2000);
    };
    poll();
    return () => { alive = false; };
  }, [intentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
      <div className="max-w-md text-center">
        {state === 'waiting' && (
          <>
            <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
            <h1 className={`mt-4 text-2xl font-semibold ${text}`}>Setting up your workspace…</h1>
            <p className={`mt-2 ${muted}`}>
              Payment received. We are creating your practice — this usually takes a few seconds.
            </p>
          </>
        )}

        {state === 'ready' && (
          <>
            <CheckCircle className="mx-auto text-green-600" size={40} />
            <h1 className={`mt-4 text-2xl font-semibold ${text}`}>Your workspace is ready</h1>
            <p className={`mt-2 ${muted}`}>Sign in with the email and password you just chose.</p>
            <button onClick={onSignIn} className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
              Sign in
            </button>
          </>
        )}

        {(state === 'failed' || state === 'timeout') && (
          <>
            <AlertCircle className="mx-auto text-amber-600" size={40} />
            <h1 className={`mt-4 text-2xl font-semibold ${text}`}>
              {state === 'timeout' ? 'This is taking longer than usual' : 'We could not finish setting up'}
            </h1>
            <p className={`mt-2 ${muted}`}>
              Your payment went through. Please contact support with this reference and we will
              finish the setup — you will not be charged twice.
            </p>
            <code className={`mt-3 inline-block px-3 py-1.5 rounded ${dark ? 'bg-gray-800' : 'bg-gray-200'} ${text} text-sm`}>
              {intentId || 'unknown'}
            </code>
          </>
        )}
      </div>
    </div>
  );
};

export default SignupCompletePage;
