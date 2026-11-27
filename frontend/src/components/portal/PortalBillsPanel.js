import React, { useEffect, useState } from 'react';
import { Receipt, Loader2, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

/**
 * Patient portal → Bills: the patient's own invoices and, when the practice takes card payments,
 * "Pay now" — a secure Stripe page in the practice's own Stripe account.
 */
const PortalBillsPanel = ({ theme, api, patientId, addNotification }) => {
  const dark = theme === 'dark';
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.portalGetInvoices(patientId).then(setData).catch(() => setData({ invoices: [], cardPayments: false }));
  }, [api, patientId]);

  const pay = async (inv) => {
    setBusy(inv.id);
    try {
      const { url } = await api.portalPayInvoice(patientId, inv.id);
      window.location.assign(url);
    } catch (e) {
      addNotification?.('alert', e.message);
      setBusy(null);
    }
  };

  if (!data) return <div className={muted}><Loader2 className="w-4 h-4 inline animate-spin" /> Loading…</div>;
  const owed = data.invoices.filter((i) => Number(i.balanceDue) > 0 && i.status !== 'paid');
  const cur = data.currency || undefined;

  return (
    <div className="space-y-4" data-testid="portal-bills">
      <h2 className={`text-xl font-semibold flex items-center gap-2 ${text}`}><Receipt className="w-5 h-5" /> Bills</h2>
      {owed.length ? (
        <p className={`text-sm ${muted}`}>
          You owe {formatCurrency(owed.reduce((n, i) => n + Number(i.balanceDue), 0), cur)}.
          {data.cardPayments ? ' You can pay by card below; the payment goes straight to your practice.' : ' Ask your practice how to pay.'}
        </p>
      ) : <p className={`text-sm ${muted}`}>Nothing to pay.</p>}
      <div className={`rounded-xl border divide-y ${dark ? 'border-slate-700 divide-slate-700' : 'border-gray-200 divide-gray-200'}`}>
        {data.invoices.length === 0 ? <p className={`p-4 text-sm ${muted}`}>No bills yet.</p> : data.invoices.map((i) => (
          <div key={i.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`font-medium ${text}`}>{i.invoiceNumber}</p>
              <p className={`text-xs ${muted}`}>{formatDate(i.issueDate)}{i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''} · {String(i.status || '').replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${Number(i.balanceDue) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {Number(i.balanceDue) > 0 ? `${formatCurrency(i.balanceDue, cur)} due` : `${formatCurrency(i.totalAmount, cur)} paid`}
              </span>
              {data.cardPayments && Number(i.balanceDue) > 0 && i.status !== 'paid' ? (
                <button type="button" onClick={() => pay(i)} disabled={!!busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
                  {busy === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Pay now
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalBillsPanel;
