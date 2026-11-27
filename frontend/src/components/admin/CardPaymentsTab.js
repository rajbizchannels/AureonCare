import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../api/apiService';

/**
 * Settings → Card payments: the practice connects ITS OWN Stripe account so patients can pay
 * invoices by card. Payments are charged on the practice's account (its name is on the patient's
 * statement, the money goes to its Stripe balance); AureonCare only records them on the invoice.
 */
const CardPaymentsTab = ({ theme, addNotification }) => {
  const dark = theme === 'dark';
  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-gray-200'}`;
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const call = useCallback(async (path, method = 'GET') => {
    const r = await apiFetch(`/card-payments${path}`, { method });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
    return body;
  }, []);

  useEffect(() => {
    let back = false;
    try { back = new URLSearchParams(window.location.search).has('card_payments'); } catch { /* no URL */ }
    // Back from Stripe's onboarding page: re-read the account so the status is current.
    (back ? call('/refresh', 'POST') : call('')).then(setS).catch((e) => setError(e.message));
    if (back) {
      try {
        const p = new URLSearchParams(window.location.search); p.delete('card_payments');
        const q = p.toString();
        window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
      } catch { /* ignore */ }
    }
  }, [call]);

  const run = async (what, fn) => {
    setBusy(what); setError('');
    try { await fn(); } catch (e) { setError(e.message); addNotification?.('alert', e.message); } finally { setBusy(''); }
  };
  const connect = () => run('connect', async () => { const { url } = await call('/connect', 'POST'); window.location.assign(url); });
  const refresh = () => run('refresh', async () => setS(await call('/refresh', 'POST')));
  const disconnect = () => {
    if (!window.confirm('Stop taking card payments in AureonCare? Your Stripe account, its payments and payouts are not affected.')) return;
    run('disconnect', async () => { setS(await call('', 'DELETE')); addNotification?.('success', 'Card payments are switched off.'); });
  };

  if (!s && !error) return <div className={muted}><Loader2 className="w-4 h-4 inline animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4 max-w-3xl" data-testid="card-payments">
      <div>
        <h2 className={`text-xl font-semibold flex items-center gap-2 ${text}`}><CreditCard className="w-5 h-5" /> Card payments</h2>
        <p className={`mt-1 text-sm ${muted}`}>
          Patients pay invoices by card on a secure Stripe page — from a link you send or from their patient portal.
          The payment is made to <strong>your own Stripe account</strong>: your practice name is on the patient’s card statement,
          the money goes to your Stripe balance, and you handle refunds in your Stripe dashboard. The payment is recorded on the invoice automatically.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{error}</div> : null}

      {s && (
        <div className={card}>
          {!s.platformConfigured ? (
            <p className={`text-sm ${muted}`}>Card payments are not available on this AureonCare installation yet.</p>
          ) : !s.connected ? (
            <>
              <p className={`text-sm ${text}`}>Connect a Stripe account to start. You can sign in to an existing Stripe account or open a new one; Stripe asks for your business and bank details.</p>
              <button type="button" onClick={connect} disabled={!!busy} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
                {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Connect Stripe
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                {s.ready ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
                <div>
                  <p className={`font-medium ${text}`}>{s.ready ? 'Patients can pay by card' : 'Finish setting up with Stripe'}</p>
                  <p className={`text-sm ${muted}`}>
                    {s.ready
                      ? (s.payoutsEnabled ? 'Payouts to your bank are on.' : 'Stripe has not switched on payouts yet — check your Stripe dashboard.')
                      : (s.detailsSubmitted ? 'Stripe is reviewing your details. This usually takes a few minutes.' : 'Stripe still needs some details before you can take payments.')}
                  </p>
                  <p className={`text-xs mt-1 ${muted}`}>Stripe account {s.accountId}{s.feeBps ? ` · AureonCare fee ${(s.feeBps / 100).toFixed(2)}% per payment` : ''}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!s.ready ? (
                  <button type="button" onClick={connect} disabled={!!busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
                    {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continue in Stripe
                  </button>
                ) : null}
                <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${dark ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-800'}`}>
                  Stripe dashboard <ExternalLink className="w-3 h-3" />
                </a>
                <button type="button" onClick={refresh} disabled={!!busy} className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${dark ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-800'}`}>
                  {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
                </button>
                <button type="button" onClick={disconnect} disabled={!!busy} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:underline">Disconnect</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className={card}>
        <h3 className={`font-semibold ${text}`}>How patients pay</h3>
        <ul className={`mt-2 text-sm list-disc pl-5 space-y-1 ${muted}`}>
          <li>Under Billing → Invoices, choose <em>Pay link</em> on a sent invoice and send the link to the patient (email, WhatsApp or SMS).</li>
          <li>Patients signed in to the portal see what they owe and can pay there.</li>
          <li>The Stripe page shows only “Invoice INV-…” and the amount — never the care given.</li>
        </ul>
      </div>
    </div>
  );
};

export default CardPaymentsTab;
