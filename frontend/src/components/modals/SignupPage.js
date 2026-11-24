import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Loader2, Tag, CreditCard, AlertCircle, Mail, Sparkles } from 'lucide-react';

// Prices in the plan's own currency (the platform catalogue decides it).
const money = (amount, currency) => {
  if (amount == null) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency || 'eur').toUpperCase(), maximumFractionDigits: Number(amount) % 1 ? 2 : 0 }).format(Number(amount)); }
  catch { return `${amount} ${String(currency || '').toUpperCase()}`; }
};

/**
 * Self-serve signup: pick a plan, enter details, then either
 *   - start a FREE TRIAL with no card: we email a confirmation link and the workspace (with
 *     sample data, unless declined) is created when it is clicked; or
 *   - pay on Stripe's hosted Checkout (plans the platform has linked to a Stripe price).
 * Card details are never entered here. Nothing is provisioned before the email is confirmed
 * or Stripe's webhook confirms payment.
 */
const SignupPage = ({ theme = 'light', onBack, onSignIn }) => {
  const dark = theme === 'dark';
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    practiceName: '', firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '', country: '', promoCode: '',
  });
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [withSamples, setWithSamples] = useState(true);
  const [trialSent, setTrialSent] = useState(null); // { email, trialDays }

  const api = require('../../api/apiService').default;

  useEffect(() => {
    let alive = true;
    api.signupPlans()
      .then((p) => { if (alive) { setPlans(p); if (p[0]) setPlanId(p[0].id); } })
      .catch(() => { if (alive) setError('Could not load plans. Please try again shortly.'); })
      .finally(() => { if (alive) setLoadingPlans(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyPromo = async () => {
    setPromoError(''); setPromo(null);
    if (!form.promoCode.trim()) return;
    setCheckingPromo(true);
    try {
      setPromo(await api.checkPromoCode(form.promoCode.trim()));
    } catch (e) {
      setPromoError(e.message || 'That code is not valid.');
    } finally {
      setCheckingPromo(false);
    }
  };

  const submit = async (e, how) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    // Mirrors the server-side policy so the customer is told before a round trip; the
    // server enforces it regardless.
    if (form.password.length < 12) return setError('Password must be at least 12 characters.');
    const chosen = plans.find((p) => p.id === planId);
    const mode = how || (chosen && chosen.can_trial ? 'trial' : 'pay');

    setSubmitting(true);
    if (mode === 'trial') {
      try {
        const out = await api.startTrial({
          practiceName: form.practiceName, email: form.email, password: form.password,
          firstName: form.firstName, lastName: form.lastName, planId,
          country: form.country || undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sampleData: withSamples,
        });
        setTrialSent({ email: form.email, trialDays: out.trialDays });
      } catch (err) {
        setError(err.message || 'Could not start the trial. Please try again.');
      } finally { setSubmitting(false); }
      return;
    }
    try {
      const { checkoutUrl } = await api.startSignup({
        practiceName: form.practiceName,
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        planId,
        country: form.country || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        promoCode: promo ? promo.code : undefined,
      });
      // Leaves our origin entirely — card entry happens on Stripe.
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
      setSubmitting(false);
    }
  };

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const card = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';
  const input = `w-full px-3 py-2 rounded-lg border ${dark ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const selected = plans.find((p) => p.id === planId);

  if (trialSent) {
    return (
      <div className={`min-h-screen ${bg} py-10 px-4`}>
        <div className={`max-w-md mx-auto p-6 rounded-xl border ${card}`} role="status">
          <Mail className="text-blue-600" size={28} />
          <h1 className={`text-2xl font-semibold mt-3 ${text}`}>Check your email</h1>
          <p className={`mt-2 ${muted}`}>We sent a link to <strong className={text}>{trialSent.email}</strong>. Click it and your workspace is ready in seconds — {trialSent.trialDays} days free, no card needed.</p>
          <p className={`mt-3 text-sm ${muted}`}>The link works once, for 24 hours. Nothing there? Check spam, or go back and try again.</p>
          {onSignIn && <button type="button" onClick={onSignIn} className="mt-5 text-blue-600 hover:underline text-sm">Go to sign in</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} py-10 px-4`}>
      <div className="max-w-4xl mx-auto">
        {onBack && (
          <button onClick={onBack} className={`flex items-center gap-2 mb-6 ${muted} hover:underline`}>
            <ArrowLeft size={16} /> Back
          </button>
        )}

        <h1 className={`text-3xl font-semibold ${text}`}>Start your practice on AureonCare</h1>
        <p className={`mt-2 ${muted}`}>
          Your own isolated workspace. Start with a free trial — no card needed — or subscribe straight away.
        </p>

        {error && (
          <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Plans */}
          <section>
            <h2 className={`font-medium mb-3 ${text}`}>Choose a plan</h2>
            {loadingPlans ? (
              <div className={`flex items-center gap-2 ${muted}`}><Loader2 className="animate-spin" size={16} /> Loading plans…</div>
            ) : plans.length === 0 ? (
              <p className={muted}>No plans are available for self-serve signup right now.</p>
            ) : plans.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={`w-full text-left mb-3 p-4 rounded-xl border-2 transition ${
                  planId === p.id ? 'border-blue-500 ring-2 ring-blue-200' : `${card}`
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-semibold ${text}`}>{p.display_name || p.name}</div>
                    {p.description && <div className={`text-sm mt-1 ${muted}`}>{p.description}</div>}
                  </div>
                  <div className={`text-right ${text}`}>
                    <div className="text-xl font-semibold">{money(p.price, p.currency)}</div>
                    <div className={`text-xs ${muted}`}>{p.billing_cycle || 'monthly'}</div>
                  </div>
                </div>
                {p.trial_days > 0 && p.can_trial && (
                  <div className="mt-2 text-xs text-green-600 font-medium">{p.trial_days}-day free trial · no card needed</div>
                )}
                {planId === p.id && <div className="mt-2 flex items-center gap-1 text-blue-600 text-sm"><Check size={14} /> Selected</div>}
              </button>
            ))}
          </section>

          {/* Details */}
          <section>
            <h2 className={`font-medium mb-3 ${text}`}>Your details</h2>
            <form onSubmit={(e) => submit(e)} className={`p-5 rounded-xl border ${card} space-y-3`}>
              <input className={input} placeholder="Practice name" required
                     value={form.practiceName} onChange={set('practiceName')} />
              <div className="grid grid-cols-2 gap-3">
                <input className={input} placeholder="First name" value={form.firstName} onChange={set('firstName')} />
                <input className={input} placeholder="Last name" value={form.lastName} onChange={set('lastName')} />
              </div>
              <input className={input} type="email" placeholder="Work email" required autoComplete="username"
                     value={form.email} onChange={set('email')} />
              <input className={input} type="password" placeholder="Password (12+ characters)" required
                     autoComplete="new-password" value={form.password} onChange={set('password')} />
              <input className={input} type="password" placeholder="Confirm password" required
                     autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />
              <input className={input} maxLength={2} placeholder="Country code (e.g. US)"
                     value={form.country} onChange={set('country')} />

              {selected && selected.can_trial ? (
                <label className={`flex items-start gap-2 text-sm ${muted}`}>
                  <input type="checkbox" className="mt-1" checked={withSamples} onChange={(e) => setWithSamples(e.target.checked)} />
                  <span>Add sample patients, appointments, services and stock so I can explore. You can remove them any time.</span>
                </label>
              ) : null}

              {selected && selected.can_checkout ? (<>
              <div className="flex gap-2">
                <input className={input} placeholder="Coupon code (optional)"
                       value={form.promoCode} onChange={set('promoCode')} />
                <button type="button" onClick={applyPromo} disabled={checkingPromo}
                        className={`px-3 rounded-lg border ${card} ${text} shrink-0`}>
                  {checkingPromo ? <Loader2 className="animate-spin" size={16} /> : 'Apply'}
                </button>
              </div>
              {promo && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Tag size={14} />
                  {promo.percentOff ? `${promo.percentOff}% off` : `${money(promo.amountOff, selected && selected.currency)} off`}
                  {promo.durationInMonths ? ` for ${promo.durationInMonths} months` : promo.duration === 'forever' ? ', forever' : ''}
                  {' '}applied.
                </div>
              )}
              {promoError && <div className="text-sm text-red-600">{promoError}</div>}
              </>) : null}

              {selected && selected.can_trial ? (
                <button type="submit" disabled={submitting || !planId || loadingPlans}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {submitting ? 'Starting…' : `Start ${selected.trial_days}-day free trial — no card`}
                </button>
              ) : null}
              {selected && selected.can_checkout ? (
                <button type={selected.can_trial ? 'button' : 'submit'} onClick={selected.can_trial ? (e) => submit(e, 'pay') : undefined}
                        disabled={submitting || !planId || loadingPlans}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium disabled:opacity-60 ${selected.can_trial ? `border ${card} ${text}` : 'bg-blue-600 text-white'}`}>
                  {submitting && !selected.can_trial ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                  {`Subscribe now — ${money(selected.price, selected.currency)} / ${selected.billing_cycle === 'yearly' ? 'year' : 'month'}`}
                </button>
              ) : null}
              <p className={`text-xs text-center ${muted}`}>
                {selected && selected.can_checkout ? 'Payment is handled by Stripe. Your card details never reach our servers.' : 'No card needed for the trial. Choose a plan inside the app when you are ready.'}
              </p>
              {onSignIn && (
                <p className={`text-sm text-center ${muted}`}>
                  Already have an account?{' '}
                  <button type="button" onClick={onSignIn} className="text-blue-600 hover:underline">Sign in</button>
                </p>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
