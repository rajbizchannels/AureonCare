import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, CreditCard } from 'lucide-react';

/**
 * The practice's real subscription, and the plans it can move to.
 *
 * Replaces a hardcoded four-plan array that was disconnected from the database: it showed
 * Free/Starter/Professional/Enterprise regardless of what plans existed, and "Select Plan"
 * changed nothing. Plans now come from the API, the current plan comes from
 * control.subscriptions (authoritative — the legacy organization_settings row is shared by
 * every tenant), and changing plan is prorated by Stripe.
 */
const SubscriptionPlansPanel = ({ theme, api, addNotification }) => {
  const dark = theme === 'dark';
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);   // { plan, preview }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, c] = await Promise.all([
        api.getSubscriptionPlans(),
        api.getCurrentSubscription().catch(() => null),
      ]);
      setPlans(p);
      setCurrent(c);
    } catch (e) {
      setError(e.message || 'Could not load subscription information.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // Ask what the change costs BEFORE committing, so the amount is shown rather than
  // discovered on the next invoice.
  const startChange = async (plan) => {
    setBusy(true);
    setError('');
    try {
      const preview = await api.previewPlanChange(plan.id);
      setPending({ plan, preview });
    } catch (e) {
      setError(e.message || 'Could not price that change.');
    } finally {
      setBusy(false);
    }
  };

  const confirmChange = async () => {
    setBusy(true);
    try {
      const res = await api.changePlan(pending.plan.id, pending.preview.prorationDate);
      addNotification?.(res.message || 'Plan changed.', 'success');
      setPending(null);
      load();
    } catch (e) {
      setError(e.message || 'Could not change the plan.');
    } finally {
      setBusy(false);
    }
  };

  const card = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const money = (v, cur) =>
    v == null ? '—' : `${Number(v).toFixed(2)} ${(cur || 'usd').toUpperCase()}`;
  const limit = (v) => (v == null || Number(v) < 0 ? 'Unlimited' : v);

  if (loading) {
    return <div className={`flex items-center gap-2 ${muted}`}><Loader2 className="w-4 h-4 animate-spin" /> Loading plans…</div>;
  }

  const currentPlanId = current && current.plan_id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-semibold ${text}`}>Subscription</h2>
        {current ? (
          <p className={`mt-1 text-sm ${muted}`}>
            You are on <strong className={text}>{current.plan_display_name || current.plan_name || 'an unnamed plan'}</strong>
            {current.plan_price != null && <> · {money(current.plan_price, current.currency)} / {current.billing_cycle || 'month'}</>}
            {current.status && <> · status <strong className={text}>{current.status}</strong></>}
            {current.current_period_end && <> · renews {new Date(current.current_period_end).toLocaleDateString()}</>}
          </p>
        ) : (
          <p className={`mt-1 text-sm ${muted}`}>No subscription record found for this practice.</p>
        )}
        {current && current.billing_linked === false && (
          <p className={`mt-2 text-sm ${muted}`}>
            This practice is not billed through Stripe, so plan changes are recorded but
            nothing is charged.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {plans.length === 0 ? (
        <p className={muted}>No plans are available. Contact support.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div key={plan.id}
                   className={`border rounded-lg p-6 ${isCurrent ? 'border-blue-500 ' + (dark ? 'bg-blue-500/10' : 'bg-blue-50') : card}`}>
                <h3 className={`text-lg font-bold ${text}`}>{plan.display_name || plan.name}</h3>
                <p className={`mt-1 text-2xl font-semibold ${text}`}>
                  {money(plan.price, plan.currency)}
                  <span className={`text-sm font-normal ${muted}`}> / {plan.billing_cycle || 'month'}</span>
                </p>
                {plan.description && <p className={`mt-2 text-sm ${muted}`}>{plan.description}</p>}

                <ul className={`mt-4 space-y-1 text-sm ${muted}`}>
                  <li>{limit(plan.max_users)} users</li>
                  <li>{limit(plan.max_providers)} providers</li>
                  <li>{limit(plan.max_patients)} patients</li>
                  {plan.trial_days > 0 && <li>{plan.trial_days}-day trial</li>}
                </ul>

                <button
                  onClick={() => startChange(plan)}
                  disabled={isCurrent || busy || !plan.purchasable}
                  className={`mt-5 w-full py-2 rounded-lg font-medium ${
                    isCurrent
                      ? (dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500')
                      : 'bg-blue-600 text-white disabled:opacity-60'
                  }`}
                >
                  {isCurrent ? (
                    <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Current plan</span>
                  ) : !plan.purchasable ? 'Not available' : 'Switch to this plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Proration confirmation — the amount comes from Stripe, not from our arithmetic. */}
      {pending && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-xl border p-6 ${card}`}>
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${text}`}>
              <CreditCard className="w-5 h-5 text-blue-500" />
              Switch to {pending.plan.display_name || pending.plan.name}?
            </h3>

            {pending.preview.prorated ? (
              <>
                <p className={`mt-3 text-sm ${muted}`}>
                  Your current plan is credited for the unused part of this period and the
                  new plan is charged pro rata. This appears on your next invoice.
                </p>
                {pending.preview.lines && pending.preview.lines.length > 0 && (
                  <ul className={`mt-3 text-sm ${muted} space-y-1`}>
                    {pending.preview.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span>{l.description}</span>
                        <span className={text}>{money(l.amount, pending.preview.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className={`mt-3 font-semibold ${text}`}>
                  Due on next invoice: {money(pending.preview.amountDue, pending.preview.currency)}
                </p>
              </>
            ) : (
              <p className={`mt-3 text-sm ${muted}`}>
                This practice is not billed through Stripe, so nothing will be charged.
              </p>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setPending(null)} disabled={busy}
                      className={`px-4 py-2 rounded-lg border ${card} ${text}`}>Cancel</button>
              <button onClick={confirmChange} disabled={busy}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60 flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansPanel;
