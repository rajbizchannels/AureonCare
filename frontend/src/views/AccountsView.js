import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, FileText, TrendingUp, TrendingDown,
  ArrowLeftRight, Receipt,
  Plus, Edit, Search, RefreshCw,
  CheckCircle, XCircle, Clock,
  ToggleLeft, ToggleRight, Send, Printer, X, Check,
  Save, ArrowUpRight, ArrowDownRight,
  Wallet, Activity, Layers, ArrowLeft
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAudit } from '../hooks/useAudit';

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const Toggle = ({ value, onChange, label, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!value)}
    disabled={disabled}
    className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    aria-pressed={value}
  >
    {value
      ? <ToggleRight size={28} className="text-emerald-500 flex-shrink-0" />
      : <ToggleLeft  size={28} className="text-gray-400 flex-shrink-0" />}
    {label && <span className="text-sm">{label}</span>}
  </button>
);

const Badge = ({ status }) => {
  const map = {
    draft:        'bg-gray-100 text-gray-700',
    posted:       'bg-green-100 text-green-700',
    voided:       'bg-red-100 text-red-600',
    reversed:     'bg-purple-100 text-purple-700',
    open:         'bg-blue-100 text-blue-700',
    partial:      'bg-yellow-100 text-yellow-700',
    paid:         'bg-green-100 text-green-700',
    written_off:  'bg-gray-100 text-gray-500',
    disputed:     'bg-orange-100 text-orange-700',
    collections:  'bg-red-100 text-red-700',
    pending:      'bg-yellow-100 text-yellow-700',
    approved:     'bg-blue-100 text-blue-700',
    completed:    'bg-green-100 text-green-700',
    in_progress:  'bg-indigo-100 text-indigo-700',
    discrepancy:  'bg-red-100 text-red-700',
    sent:         'bg-purple-100 text-purple-700',
    cancelled:    'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, color, trend }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-start gap-3">
    <div className={`p-2.5 rounded-lg ${color || 'bg-emerald-100'}`}>
      <Icon size={20} className={color ? '' : 'text-emerald-600'} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-0.5 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend).toFixed(1)}%
        </p>
      )}
    </div>
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[90vh] flex flex-col`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="font-semibold text-gray-900 dark:text-white text-base">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
          <X size={18} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
    </div>
  </div>
);

const FormField = ({ label, required, error, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);

const Input = ({ className = '', ...props }) => (
  <input className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${className}`} {...props} />
);

const Select = ({ className = '', children, ...props }) => (
  <select className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 ${className}`} {...props}>
    {children}
  </select>
);

const Textarea = ({ className = '', ...props }) => (
  <textarea className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 resize-none ${className}`} rows={3} {...props} />
);

const Btn = ({ variant = 'primary', size = 'sm', icon: Icon, children, className = '', ...props }) => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  const sizes = { xs: 'px-2 py-1 text-xs', sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-400',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 focus:ring-gray-300',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon size={size === 'xs' ? 12 : 14} />}
      {children}
    </button>
  );
};

const Table = ({ headers, children, empty, theme }) => (
  <div className={`overflow-x-auto rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
    <table className="w-full text-sm">
      <thead className={`text-xs ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
        <tr>{headers.map((h, i) => <th key={i} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
      </thead>
      <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700 bg-slate-800' : 'divide-gray-100 bg-white'}`}>
        {children}
      </tbody>
    </table>
    {empty && <div className={`text-center py-12 text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{empty}</div>}
  </div>
);

// ─── Sub-forms ────────────────────────────────────────────────────────────────

const AccountForm = ({ accounts, onSave, onClose, initial }) => {
  const [form, setForm] = useState({
    accountName: initial?.accountName || '',
    accountType: initial?.accountType || 'asset',
    accountSubtype: initial?.accountSubtype || '',
    parentAccountId: initial?.parentAccountId || '',
    normalBalance: initial?.normalBalance || 'debit',
    currency: initial?.currency || 'USD',
    description: initial?.description || '',
    openingBalance: initial?.openingBalance || 0,
    linkedToAr: initial?.linkedToAr || false,
    linkedToAp: initial?.linkedToAp || false,
    linkedToBilling: initial?.linkedToBilling || false,
    linkedToClaims: initial?.linkedToClaims || false,
    isActive: initial?.isActive !== false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const normalBalanceDefault = { asset: 'debit', contra_asset: 'credit', liability: 'credit', contra_liability: 'debit', equity: 'credit', revenue: 'credit', contra_revenue: 'debit', expense: 'debit' };

  const validate = () => {
    const e = {};
    if (!form.accountName.trim()) e.accountName = 'Account name is required';
    if (!form.accountType) e.accountType = 'Account type is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Account Name" required error={errors.accountName}>
          <Input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} placeholder="e.g. Checking Account" />
        </FormField>
        <FormField label="Account Type" required error={errors.accountType}>
          <Select value={form.accountType} onChange={e => {
            const t = e.target.value;
            setForm(f => ({ ...f, accountType: t, normalBalance: normalBalanceDefault[t] || 'debit' }));
          }}>
            {['asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_revenue'].map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Account Subtype">
          <Input value={form.accountSubtype} onChange={e => setForm(f => ({ ...f, accountSubtype: e.target.value }))} placeholder="e.g. current_asset" />
        </FormField>
        <FormField label="Normal Balance" required>
          <Select value={form.normalBalance} onChange={e => setForm(f => ({ ...f, normalBalance: e.target.value }))}>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </Select>
        </FormField>
        <FormField label="Parent Account">
          <Select value={form.parentAccountId} onChange={e => setForm(f => ({ ...f, parentAccountId: e.target.value }))}>
            <option value="">— None —</option>
            {accounts.filter(a => a.id !== initial?.id).map(a => (
              <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Currency">
          <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {['USD','EUR','GBP','CAD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
      </div>
      {!initial && (
        <FormField label="Opening Balance">
          <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} />
        </FormField>
      )}
      <FormField label="Description">
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Account description..." />
      </FormField>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 dark:text-slate-400">Module Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          <Toggle value={form.linkedToAr} onChange={v => setForm(f => ({ ...f, linkedToAr: v }))} label="Link to Accounts Receivable" />
          <Toggle value={form.linkedToAp} onChange={v => setForm(f => ({ ...f, linkedToAp: v }))} label="Link to Accounts Payable" />
          <Toggle value={form.linkedToBilling} onChange={v => setForm(f => ({ ...f, linkedToBilling: v }))} label="Link to Billing Module" />
          <Toggle value={form.linkedToClaims} onChange={v => setForm(f => ({ ...f, linkedToClaims: v }))} label="Link to RCM/Claims" />
        </div>
      </div>
      {initial && (
        <Toggle value={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} label="Account is Active" />
      )}
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : initial ? 'Update Account' : 'Create Account'}</Btn>
      </div>
    </form>
  );
};

const JournalEntryForm = ({ accounts, onSave, onClose }) => {
  const [form, setForm] = useState({ entryDate: new Date().toISOString().split('T')[0], description: '', entryType: 'manual', referenceType: '', referenceNumber: '', notes: '' });
  const [lines, setLines] = useState([{ accountId: '', entryType: 'debit', amount: '', description: '' }, { accountId: '', entryType: 'credit', amount: '', description: '' }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const totalDebit  = lines.filter(l => l.entryType === 'debit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredit = lines.filter(l => l.entryType === 'credit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => setLines(l => [...l, { accountId: '', entryType: 'debit', amount: '', description: '' }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, field, val) => setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: val } : line));

  const validate = () => {
    const e = {};
    if (!form.entryDate) e.entryDate = 'Entry date is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (lines.length < 2) e.lines = 'At least 2 lines required';
    if (!isBalanced) e.balance = 'Debits and credits must balance';
    for (const l of lines) { if (!l.accountId || !l.amount) { e.lines = 'All lines need an account and amount'; break; } }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try { await onSave({ ...form, lines }); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Entry Date" required error={errors.entryDate}>
          <Input type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
        </FormField>
        <FormField label="Entry Type">
          <Select value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))}>
            {['manual','adjusting','closing','reversing','auto_billing','auto_rcm','auto_payment'].map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description" required error={errors.description} className="col-span-2">
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Journal entry description" />
        </FormField>
        <FormField label="Reference Type">
          <Select value={form.referenceType} onChange={e => setForm(f => ({ ...f, referenceType: e.target.value }))}>
            <option value="">None</option>
            {['claim','payment','invoice','patient','appointment'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Reference #">
          <Input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Optional reference" />
        </FormField>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600 dark:text-slate-400">Journal Lines</p>
          <button type="button" onClick={addLine} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            <Plus size={12} /> Add Line
          </button>
        </div>
        {errors.lines && <p className="text-xs text-red-500">{errors.lines}</p>}
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <Select value={line.accountId} onChange={e => updateLine(i, 'accountId', e.target.value)}>
                <option value="">Select account…</option>
                {accounts.filter(a => a.isActive).map(a => (
                  <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Select value={line.entryType} onChange={e => updateLine(i, 'entryType', e.target.value)}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </Select>
            </div>
            <div className="col-span-3">
              <Input type="number" step="0.01" min="0" placeholder="Amount" value={line.amount} onChange={e => updateLine(i, 'amount', e.target.value)} />
            </div>
            <div className="col-span-1">
              {lines.length > 2 && (
                <button type="button" onClick={() => removeLine(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <div className={`flex gap-6 text-sm px-2 py-1.5 rounded-lg ${isBalanced ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <span>Debit: <strong className="text-green-700">{formatCurrency(totalDebit)}</strong></span>
          <span>Credit: <strong className="text-red-600">{formatCurrency(totalCredit)}</strong></span>
          {isBalanced
            ? <span className="text-green-600 flex items-center gap-1"><CheckCircle size={13} />Balanced</span>
            : <span className="text-red-600">Not balanced (diff: {formatCurrency(Math.abs(totalDebit - totalCredit))})</span>}
        </div>
      </div>

      <FormField label="Notes"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving || !isBalanced}>{saving ? 'Saving…' : 'Create Entry'}</Btn>
      </div>
    </form>
  );
};

const ARForm = ({ accounts, onSave, onClose }) => {
  const [form, setForm] = useState({ arType: 'patient', patientName: '', payerName: '', originalAmount: '', dueDate: '', serviceDate: '', notes: '', accountId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.originalAmount || !form.dueDate) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="AR Type" required>
          <Select value={form.arType} onChange={e => setForm(f => ({ ...f, arType: e.target.value }))}>
            <option value="patient">Patient</option>
            <option value="insurance">Insurance</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        {form.arType === 'patient'
          ? <FormField label="Patient Name"><Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} /></FormField>
          : <FormField label="Payer Name"><Input value={form.payerName} onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))} /></FormField>}
        <FormField label="Original Amount" required>
          <Input type="number" step="0.01" min="0" value={form.originalAmount} onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} placeholder="0.00" />
        </FormField>
        <FormField label="Due Date" required>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <FormField label="Service Date">
          <Input type="date" value={form.serviceDate} onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))} />
        </FormField>
        <FormField label="GL Account" className="col-span-2">
          <Select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">Select account…</option>
            {accounts.filter(a => a.linkedToAr).map(a => (
              <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : 'Create AR Record'}</Btn>
      </div>
    </form>
  );
};

const APForm = ({ accounts, onSave, onClose }) => {
  const [form, setForm] = useState({ apType: 'vendor', vendorName: '', vendorReference: '', invoiceAmount: '', invoiceDate: '', dueDate: '', expenseCategory: '', department: '', notes: '', accountId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendorName.trim() || !form.invoiceAmount || !form.invoiceDate || !form.dueDate) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="AP Type" required>
          <Select value={form.apType} onChange={e => setForm(f => ({ ...f, apType: e.target.value }))}>
            <option value="vendor">Vendor</option>
            <option value="refund">Refund</option>
            <option value="employee">Employee</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        <FormField label="Vendor Name" required>
          <Input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="Vendor or payee name" />
        </FormField>
        <FormField label="Vendor Invoice #">
          <Input value={form.vendorReference} onChange={e => setForm(f => ({ ...f, vendorReference: e.target.value }))} />
        </FormField>
        <FormField label="Invoice Amount" required>
          <Input type="number" step="0.01" min="0" value={form.invoiceAmount} onChange={e => setForm(f => ({ ...f, invoiceAmount: e.target.value }))} placeholder="0.00" />
        </FormField>
        <FormField label="Invoice Date" required>
          <Input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
        </FormField>
        <FormField label="Due Date" required>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <FormField label="Expense Category">
          <Input value={form.expenseCategory} onChange={e => setForm(f => ({ ...f, expenseCategory: e.target.value }))} placeholder="e.g. Medical Supplies" />
        </FormField>
        <FormField label="Department">
          <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Radiology" />
        </FormField>
        <FormField label="GL Account" className="col-span-2">
          <Select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">Select account…</option>
            {accounts.filter(a => a.linkedToAp || a.accountType === 'liability').map(a => (
              <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : 'Create AP Record'}</Btn>
      </div>
    </form>
  );
};

const ReconciliationForm = ({ accounts, onSave, onClose }) => {
  const [form, setForm] = useState({ accountId: '', reconciliationType: 'bank', periodStart: '', periodEnd: '', statementBalance: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.accountId || !form.periodStart || !form.periodEnd || form.statementBalance === '') return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Account" required>
          <Select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">Select account…</option>
            {accounts.filter(a => a.isActive).map(a => (
              <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type" required>
          <Select value={form.reconciliationType} onChange={e => setForm(f => ({ ...f, reconciliationType: e.target.value }))}>
            {['bank','insurance','patient','vendor'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Period Start" required>
          <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
        </FormField>
        <FormField label="Period End" required>
          <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
        </FormField>
        <FormField label="Statement Balance" required className="col-span-2">
          <Input type="number" step="0.01" value={form.statementBalance} onChange={e => setForm(f => ({ ...f, statementBalance: e.target.value }))} placeholder="Balance per bank/payer statement" />
        </FormField>
      </div>
      <FormField label="Notes"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : 'Start Reconciliation'}</Btn>
      </div>
    </form>
  );
};

const StatementForm = ({ onSave, onClose }) => {
  const [form, setForm] = useState({ statementType: 'patient', recipientName: '', recipientEmail: '', statementDate: new Date().toISOString().split('T')[0], periodStart: '', periodEnd: '', dueDate: '', previousBalance: 0, charges: 0, payments: 0, adjustments: 0, notes: '' });
  const [saving, setSaving] = useState(false);
  const currentBalance = parseFloat(form.previousBalance) + parseFloat(form.charges) - parseFloat(form.payments) - parseFloat(form.adjustments);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.statementDate || !form.periodStart || !form.periodEnd) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Statement Type" required>
          <Select value={form.statementType} onChange={e => setForm(f => ({ ...f, statementType: e.target.value }))}>
            {['patient','insurance','vendor','internal'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Statement Date" required>
          <Input type="date" value={form.statementDate} onChange={e => setForm(f => ({ ...f, statementDate: e.target.value }))} />
        </FormField>
        <FormField label="Recipient Name">
          <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} />
        </FormField>
        <FormField label="Recipient Email">
          <Input type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} />
        </FormField>
        <FormField label="Period Start" required>
          <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
        </FormField>
        <FormField label="Period End" required>
          <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
        </FormField>
        <FormField label="Due Date">
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <div />
        {['previousBalance','charges','payments','adjustments'].map(field => (
          <FormField key={field} label={field.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}>
            <Input type="number" step="0.01" min="0" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
          </FormField>
        ))}
      </div>
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-sm">
        <span className="font-medium">Current Balance: </span>
        <span className={currentBalance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{formatCurrency(currentBalance)}</span>
      </div>
      <FormField label="Notes"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : 'Create Statement'}</Btn>
      </div>
    </form>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',       icon: LayoutDashboard },
  { id: 'accounts',   label: 'Chart of Accts', icon: BookOpen },
  { id: 'journal',    label: 'Journal',        icon: FileText },
  { id: 'ar',         label: 'Receivables',    icon: TrendingUp },
  { id: 'ap',         label: 'Payables',       icon: TrendingDown },
  { id: 'reconcile',  label: 'Reconciliation', icon: ArrowLeftRight },
  { id: 'statements', label: 'Statements',     icon: Receipt },
];

export default function AccountsView({ theme, api, user, addNotification, setCurrentModule }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Data
  const [accounts,        setAccounts]        = useState([]);
  const [journalEntries,  setJournalEntries]  = useState([]);
  const [receivables,     setReceivables]     = useState([]);
  const [payables,        setPayables]        = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [statements,      setStatements]      = useState([]);
  const [dashboard,       setDashboard]       = useState(null);

  // Modals
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showJEForm,      setShowJEForm]      = useState(false);
  const [showARForm,      setShowARForm]      = useState(false);
  const [showAPForm,      setShowAPForm]      = useState(false);
  const [showRecForm,     setShowRecForm]     = useState(false);
  const [showStmForm,     setShowStmForm]     = useState(false);
  const [editingAccount,  setEditingAccount]  = useState(null);

  // Filters & search
  const [acctSearch,      setAcctSearch]      = useState('');
  const [acctTypeFilter,  setAcctTypeFilter]  = useState('');
  const [jeSearch,        setJeSearch]        = useState('');
  const [jeStatusFilter,  setJeStatusFilter]  = useState('');
  const [arSearch,        setArSearch]        = useState('');
  const [arStatusFilter,  setArStatusFilter]  = useState('');
  const [apSearch,        setApSearch]        = useState('');
  const [apStatusFilter,  setApStatusFilter]  = useState('');

  // Toggles
  const [showInactiveAccts, setShowInactiveAccts] = useState(false);
  const [showVoidedJE,      setShowVoidedJE]      = useState(false);

  const { logViewAccess, logCreate, logUpdate } = useAudit();

  useEffect(() => {
    logViewAccess('AccountsView', { module: 'Accounts' });
  }, [logViewAccess]);

  const userRole = user?.role || 'doctor';
  const can = useCallback((resource, action) => {
    if (userRole === 'admin') return true;
    const roleMap = {
      billing_manager: { chart_of_accounts: { view:true,create:true,edit:true }, accounts_receivable: { view:true,create:true,edit:true }, accounts_payable: { view:true,create:true,edit:true }, journal_entries: { view:true }, reconciliation: { view:true }, statements: { view:true,create:true } },
      doctor: { chart_of_accounts: { view:true }, accounts_receivable: { view:true }, accounts_payable: { view:true }, journal_entries: { view:true }, reconciliation: { view:true }, statements: { view:true } },
    };
    const rolePerm = roleMap[userRole] || {};
    return rolePerm[resource]?.[action] === true;
  }, [userRole]);

  const fetchData = useCallback(async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': {
          const [dash, accts] = await Promise.all([api.getAccountsDashboard(), api.getAccounts()]);
          setDashboard(dash);
          setAccounts(accts);
          break;
        }
        case 'accounts':
          setAccounts(await api.getAccounts());
          break;
        case 'journal': {
          const [jes, journalAccts] = await Promise.all([api.getJournalEntries(), api.getAccounts()]);
          setJournalEntries(jes);
          setAccounts(journalAccts);
          break;
        }
        case 'ar':
          setReceivables(await api.getAccountReceivables());
          break;
        case 'ap':
          setPayables(await api.getAccountPayables());
          break;
        case 'reconcile': {
          const [recs, accs] = await Promise.all([api.getReconciliations(), api.getAccounts()]);
          setReconciliations(recs);
          setAccounts(accs);
          break;
        }
        case 'statements':
          setStatements(await api.getAccountStatements());
          break;
        default: break;
      }
    } catch (err) {
      console.error('Error loading accounts data:', err);
      addNotification('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [api, addNotification]);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateAccount = async (form) => {
    try {
      const created = await api.createAccount(form);
      setAccounts(prev => [...prev, created]);
      setShowAccountForm(false);
      logCreate('Account', form, { module: 'Accounts' });
      addNotification('success', `Account ${created.accountNumber} created`);
    } catch (err) { addNotification('error', err.message || 'Failed to create account'); }
  };

  const handleUpdateAccount = async (form) => {
    try {
      const updated = await api.updateAccount(editingAccount.id, form);
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      setEditingAccount(null);
      logUpdate('Account', editingAccount, form, { module: 'Accounts' });
      addNotification('success', 'Account updated');
    } catch (err) { addNotification('error', err.message || 'Failed to update account'); }
  };

  const handleToggleAccount = async (acct) => {
    try {
      const updated = await api.updateAccount(acct.id, { isActive: !acct.isActive });
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      addNotification('success', `Account ${updated.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) { addNotification('error', 'Failed to toggle account status'); }
  };

  const handleCreateJE = async (form) => {
    try {
      const created = await api.createJournalEntry(form);
      setJournalEntries(prev => [created, ...prev]);
      setShowJEForm(false);
      logCreate('JournalEntry', form, { module: 'Accounts' });
      addNotification('success', `Journal entry ${created.entryNumber} created`);
    } catch (err) { addNotification('error', err.message || 'Failed to create journal entry'); }
  };

  const handlePostJE = async (id) => {
    try {
      const updated = await api.postJournalEntry(id);
      setJournalEntries(prev => prev.map(je => je.id === id ? updated : je));
      addNotification('success', 'Journal entry posted');
    } catch (err) { addNotification('error', err.message || 'Failed to post journal entry'); }
  };

  const handleVoidJE = async (id) => {
    if (!window.confirm('Void this journal entry? This action reverses all account balance changes.')) return;
    try {
      const updated = await api.voidJournalEntry(id);
      setJournalEntries(prev => prev.map(je => je.id === id ? updated : je));
      addNotification('success', 'Journal entry voided');
    } catch (err) { addNotification('error', err.message || 'Failed to void journal entry'); }
  };

  const handleCreateAR = async (form) => {
    try {
      const created = await api.createAccountReceivable(form);
      setReceivables(prev => [created, ...prev]);
      setShowARForm(false);
      logCreate('AccountReceivable', form, { module: 'Accounts' });
      addNotification('success', `AR record ${created.arNumber} created`);
    } catch (err) { addNotification('error', err.message || 'Failed to create AR record'); }
  };

  const handleCreateAP = async (form) => {
    try {
      const created = await api.createAccountPayable(form);
      setPayables(prev => [created, ...prev]);
      setShowAPForm(false);
      logCreate('AccountPayable', form, { module: 'Accounts' });
      addNotification('success', `AP record ${created.apNumber} created`);
    } catch (err) { addNotification('error', err.message || 'Failed to create AP record'); }
  };

  const handleApproveAP = async (id) => {
    try {
      const updated = await api.updateAccountPayable(id, { status: 'approved' });
      setPayables(prev => prev.map(ap => ap.id === id ? updated : ap));
      addNotification('success', 'AP record approved');
    } catch (err) { addNotification('error', 'Failed to approve AP record'); }
  };

  const handleCreateRec = async (form) => {
    try {
      const created = await api.createReconciliation(form);
      setReconciliations(prev => [created, ...prev]);
      setShowRecForm(false);
      addNotification('success', `Reconciliation ${created.reconciliationNumber} started`);
    } catch (err) { addNotification('error', err.message || 'Failed to start reconciliation'); }
  };

  const handleCompleteRec = async (id) => {
    try {
      const updated = await api.updateReconciliation(id, { status: 'completed' });
      setReconciliations(prev => prev.map(r => r.id === id ? updated : r));
      addNotification('success', 'Reconciliation completed');
    } catch (err) { addNotification('error', 'Failed to complete reconciliation'); }
  };

  const handleCreateStatement = async (form) => {
    try {
      const created = await api.createAccountStatement(form);
      setStatements(prev => [created, ...prev]);
      setShowStmForm(false);
      addNotification('success', `Statement ${created.statementNumber} created`);
    } catch (err) { addNotification('error', err.message || 'Failed to create statement'); }
  };

  const handleSendStatement = async (id) => {
    try {
      const updated = await api.sendAccountStatement(id);
      setStatements(prev => prev.map(s => s.id === id ? updated : s));
      addNotification('success', 'Statement marked as sent');
    } catch (err) { addNotification('error', 'Failed to send statement'); }
  };

  // ── Filtered data ─────────────────────────────────────────────────────────────

  const filteredAccounts = accounts.filter(a => {
    if (!showInactiveAccts && !a.isActive) return false;
    if (acctTypeFilter && a.accountType !== acctTypeFilter) return false;
    if (acctSearch) {
      const q = acctSearch.toLowerCase();
      return a.accountName?.toLowerCase().includes(q) || a.accountNumber?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredJE = journalEntries.filter(je => {
    if (!showVoidedJE && je.status === 'voided') return false;
    if (jeStatusFilter && je.status !== jeStatusFilter) return false;
    if (jeSearch) {
      const q = jeSearch.toLowerCase();
      return je.entryNumber?.toLowerCase().includes(q) || je.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredAR = receivables.filter(r => {
    if (arStatusFilter && r.status !== arStatusFilter) return false;
    if (arSearch) {
      const q = arSearch.toLowerCase();
      return r.arNumber?.toLowerCase().includes(q) || r.patientName?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredAP = payables.filter(p => {
    if (apStatusFilter && p.status !== apStatusFilter) return false;
    if (apSearch) {
      const q = apSearch.toLowerCase();
      return p.apNumber?.toLowerCase().includes(q) || p.vendorName?.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Tab renderers ─────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total AR" value={formatCurrency(dashboard?.totalAR || 0)} sub={`${dashboard?.arCount || 0} open records`} icon={TrendingUp} color="bg-blue-100 text-blue-600" />
        <StatCard label="Total AP" value={formatCurrency(dashboard?.totalAP || 0)} sub={`${dashboard?.apCount || 0} pending`} icon={TrendingDown} color="bg-red-100 text-red-600" />
        <StatCard label="Cash Balance" value={formatCurrency(dashboard?.cashBalance || 0)} icon={Wallet} color="bg-green-100 text-green-600" />
        <StatCard label="Draft Entries" value={dashboard?.draftJournalEntries || 0} sub="pending posting" icon={FileText} color="bg-yellow-100 text-yellow-600" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><Activity size={16} />Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Journal Entry', icon: FileText, tab: 'journal', form: () => setShowJEForm(true) },
              { label: 'New AR Record',     icon: TrendingUp, tab: 'ar',     form: () => setShowARForm(true) },
              { label: 'New AP Record',     icon: TrendingDown, tab: 'ap',   form: () => setShowAPForm(true) },
              { label: 'New Statement',     icon: Receipt, tab: 'statements', form: () => setShowStmForm(true) },
            ].map(a => (
              <button key={a.label} onClick={() => { setActiveTab(a.tab); setTimeout(() => a.form(), 200); }}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-sm ${
                  theme === 'dark'
                    ? 'border-slate-600 text-slate-300 hover:border-emerald-500 hover:bg-emerald-900/20'
                    : 'border-gray-200 text-gray-700 hover:border-emerald-400 hover:bg-emerald-50'
                }`}>
                <a.icon size={16} className="text-emerald-500" />{a.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><BookOpen size={16} />Account Summary</h3>
          <div className="space-y-2">
            {['asset','liability','equity','revenue','expense'].map(type => {
              const typeAccts = accounts.filter(a => a.accountType === type && a.isActive);
              const total = typeAccts.reduce((s, a) => s + parseFloat(a.currentBalance || 0), 0);
              return (
                <div key={type} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                  <span className={`text-sm capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{type}s ({typeAccts.length})</span>
                  <span className={`text-sm font-semibold ${type === 'expense' || type === 'liability' ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><Layers size={16} />Module Integrations</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'RCM / Claims',       count: accounts.filter(a => a.linkedToClaims).length,  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
            { label: 'Billing',            count: accounts.filter(a => a.linkedToBilling).length, color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'Accounts Receivable',count: accounts.filter(a => a.linkedToAr).length,      color: 'bg-green-100 text-green-700 border-green-200' },
            { label: 'Accounts Payable',   count: accounts.filter(a => a.linkedToAp).length,      color: 'bg-red-100 text-red-700 border-red-200' },
          ].map(b => (
            <div key={b.label} className={`px-4 py-2 rounded-full border text-sm font-medium ${b.color}`}>
              {b.label}: {b.count} accounts
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderChartOfAccounts = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder="Search accounts…" value={acctSearch} onChange={e => setAcctSearch(e.target.value)} />
        </div>
        <Select className="w-44" value={acctTypeFilter} onChange={e => setAcctTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {['asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_revenue'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
          ))}
        </Select>
        <Toggle value={showInactiveAccts} onChange={setShowInactiveAccts} label="Show Inactive" />
        {can('chart_of_accounts','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowAccountForm(true)}>New Account</Btn>
        )}
      </div>

      <Table theme={theme} headers={['#','Account Name','Type','Subtype','Balance','Integrations','Status','Actions']}
        empty={filteredAccounts.length === 0 ? 'No accounts found' : null}>
        {filteredAccounts.map(acct => (
          <tr key={acct.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{acct.accountNumber}</td>
            <td className="px-4 py-3">
              <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{acct.accountName}</div>
              {acct.parentName && <div className="text-xs text-gray-400">↳ {acct.parentName}</div>}
            </td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{acct.accountType?.replace(/_/g,' ')}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{acct.accountSubtype?.replace(/_/g,' ') || '—'}</td>
            <td className="px-4 py-3 text-sm font-medium">
              <span className={parseFloat(acct.currentBalance) < 0 ? 'text-red-600' : theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                {formatCurrency(acct.currentBalance || 0)}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-1 flex-wrap">
                {acct.linkedToAr      && <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">AR</span>}
                {acct.linkedToAp      && <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">AP</span>}
                {acct.linkedToBilling && <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Billing</span>}
                {acct.linkedToClaims  && <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">RCM</span>}
              </div>
            </td>
            <td className="px-4 py-3">
              <Toggle value={acct.isActive} onChange={() => can('chart_of_accounts','edit') && handleToggleAccount(acct)} disabled={acct.isSystem} />
            </td>
            <td className="px-4 py-3">
              {can('chart_of_accounts','edit') && !acct.isSystem && (
                <Btn variant="ghost" size="xs" icon={Edit} onClick={() => setEditingAccount(acct)} />
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderJournal = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder="Search journal entries…" value={jeSearch} onChange={e => setJeSearch(e.target.value)} />
        </div>
        <Select className="w-36" value={jeStatusFilter} onChange={e => setJeStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['draft','posted','voided','reversed'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Toggle value={showVoidedJE} onChange={setShowVoidedJE} label="Show Voided" />
        {can('journal_entries','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowJEForm(true)}>New Entry</Btn>
        )}
      </div>

      <Table theme={theme} headers={['Entry #','Date','Type','Description','Debit','Credit','Ref','Status','Actions']}
        empty={filteredJE.length === 0 ? 'No journal entries found' : null}>
        {filteredJE.map(je => (
          <tr key={je.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{je.entryNumber}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(je.entryDate)}</td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{je.entryType?.replace(/_/g,' ')}</td>
            <td className={`px-4 py-3 text-sm max-w-48 truncate ${theme === 'dark' ? 'text-slate-300' : ''}`}>{je.description}</td>
            <td className="px-4 py-3 text-sm font-medium text-green-600">{formatCurrency(je.totalDebit)}</td>
            <td className="px-4 py-3 text-sm font-medium text-red-500">{formatCurrency(je.totalCredit)}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{je.referenceNumber || '—'}</td>
            <td className="px-4 py-3"><Badge status={je.status} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                {je.status === 'draft' && can('journal_entries','approve') && (
                  <Btn variant="success" size="xs" icon={Check} onClick={() => handlePostJE(je.id)}>Post</Btn>
                )}
                {['draft','posted'].includes(je.status) && can('journal_entries','delete') && (
                  <Btn variant="ghost" size="xs" icon={XCircle} onClick={() => handleVoidJE(je.id)} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderAR = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder="Search AR records…" value={arSearch} onChange={e => setArSearch(e.target.value)} />
        </div>
        <Select className="w-36" value={arStatusFilter} onChange={e => setArStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['open','partial','paid','written_off','disputed','collections'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        {can('accounts_receivable','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowARForm(true)}>New AR Record</Btn>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Current', key: 'current' }, { label: '1-30 Days', key: 'days1_30' },
          { label: '31-60 Days', key: 'days31_60' }, { label: '61-90 Days', key: 'days61_90' },
          { label: '91-120 Days', key: 'days91_120' }, { label: '120+ Days', key: 'days120Plus' },
        ].map(b => {
          const total = filteredAR.filter(r => r.agingBucket === b.key || (!r.agingBucket && b.key === 'current'))
            .reduce((s, r) => s + parseFloat(r.balanceDue || 0), 0);
          return (
            <div key={b.key} className={`rounded-lg border p-3 text-center ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{b.label}</p>
              <p className={`font-bold text-sm mt-1 ${theme === 'dark' ? 'text-white' : ''}`}>{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      <Table theme={theme} headers={['AR #','Type','Patient/Payer','Original','Paid','Balance','Due Date','Aging','Status','Actions']}
        empty={filteredAR.length === 0 ? 'No AR records found' : null}>
        {filteredAR.map(ar => (
          <tr key={ar.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{ar.arNumber}</td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : ''}`}>{ar.arType}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{ar.patientName || ar.payerName || '—'}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatCurrency(ar.originalAmount)}</td>
            <td className="px-4 py-3 text-sm text-green-500">{formatCurrency(ar.paidAmount || 0)}</td>
            <td className="px-4 py-3 text-sm font-medium text-red-500">{formatCurrency(ar.balanceDue || 0)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(ar.dueDate)}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{ar.agingBucket?.replace(/_/g,' ') || 'current'}</td>
            <td className="px-4 py-3"><Badge status={ar.status} /></td>
            <td className="px-4 py-3">
              {can('accounts_receivable','edit') && (
                <Btn variant="ghost" size="xs" icon={Edit} onClick={() => {}} />
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderAP = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder="Search AP records…" value={apSearch} onChange={e => setApSearch(e.target.value)} />
        </div>
        <Select className="w-36" value={apStatusFilter} onChange={e => setApStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['pending','approved','partial','paid','voided','disputed'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        {can('accounts_payable','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowAPForm(true)}>New AP Record</Btn>
        )}
      </div>

      <Table theme={theme} headers={['AP #','Type','Vendor','Invoice Amt','Balance','Invoice Date','Due Date','Status','Actions']}
        empty={filteredAP.length === 0 ? 'No AP records found' : null}>
        {filteredAP.map(ap => (
          <tr key={ap.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{ap.apNumber}</td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : ''}`}>{ap.apType}</td>
            <td className={`px-4 py-3 text-sm font-medium ${theme === 'dark' ? 'text-white' : ''}`}>{ap.vendorName}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatCurrency(ap.invoiceAmount)}</td>
            <td className="px-4 py-3 text-sm font-medium text-red-500">{formatCurrency(ap.balanceDue || 0)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(ap.invoiceDate)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(ap.dueDate)}</td>
            <td className="px-4 py-3"><Badge status={ap.status} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                {ap.status === 'pending' && can('accounts_payable','approve') && (
                  <Btn variant="success" size="xs" icon={Check} onClick={() => handleApproveAP(ap.id)}>Approve</Btn>
                )}
                {can('accounts_payable','edit') && (
                  <Btn variant="ghost" size="xs" icon={Edit} onClick={() => {}} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderReconciliation = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{reconciliations.length} reconciliation(s)</div>
        {can('reconciliation','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowRecForm(true)}>Start Reconciliation</Btn>
        )}
      </div>

      <Table theme={theme} headers={['Rec #','Account','Type','Period','Statement Bal','System Bal','Discrepancy','Status','Actions']}
        empty={reconciliations.length === 0 ? 'No reconciliations found' : null}>
        {reconciliations.map(rec => (
          <tr key={rec.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{rec.reconciliationNumber}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{rec.accountName}</td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : ''}`}>{rec.reconciliationType}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-400' : ''}`}>{formatDate(rec.periodStart)} – {formatDate(rec.periodEnd)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatCurrency(rec.statementBalance)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatCurrency(rec.systemBalance)}</td>
            <td className="px-4 py-3 text-sm font-medium">
              <span className={Math.abs(parseFloat(rec.discrepancyAmount || 0)) < 0.01 ? 'text-green-500' : 'text-red-500'}>
                {formatCurrency(rec.discrepancyAmount || 0)}
              </span>
            </td>
            <td className="px-4 py-3"><Badge status={rec.status} /></td>
            <td className="px-4 py-3">
              {rec.status === 'in_progress' && can('reconciliation','approve') && (
                <Btn variant="success" size="xs" icon={CheckCircle} onClick={() => handleCompleteRec(rec.id)}>Complete</Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderStatements = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{statements.length} statement(s)</div>
        {can('statements','create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowStmForm(true)}>New Statement</Btn>
        )}
      </div>

      <Table theme={theme} headers={['Stmt #','Type','Recipient','Period','Prev Bal','Charges','Payments','Balance','Status','Actions']}
        empty={statements.length === 0 ? 'No statements found' : null}>
        {statements.map(s => (
          <tr key={s.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{s.statementNumber}</td>
            <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : ''}`}>{s.statementType}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{s.patientName || s.payerName || s.recipientName || '—'}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-400' : ''}`}>{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatCurrency(s.previousBalance)}</td>
            <td className="px-4 py-3 text-sm text-red-500">{formatCurrency(s.charges)}</td>
            <td className="px-4 py-3 text-sm text-green-500">{formatCurrency(s.payments)}</td>
            <td className={`px-4 py-3 text-sm font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{formatCurrency(s.currentBalance)}</td>
            <td className="px-4 py-3"><Badge status={s.status} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                {s.status === 'draft' && can('statements','edit') && (
                  <Btn variant="primary" size="xs" icon={Send} onClick={() => handleSendStatement(s.id)}>Send</Btn>
                )}
                {can('statements','export') && (
                  <Btn variant="ghost" size="xs" icon={Printer} onClick={() => {}} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const tabContent = {
    overview:   renderOverview,
    accounts:   renderChartOfAccounts,
    journal:    renderJournal,
    ar:         renderAR,
    ap:         renderAP,
    reconcile:  renderReconciliation,
    statements: renderStatements,
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b px-6 py-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentModule && setCurrentModule('dashboard')}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            >
              <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
            <div>
              <h2 className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <BookOpen className="text-emerald-500" size={24} />
                Accounts Management
              </h2>
              <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                Chart of accounts · journal entries · AR/AP · reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(activeTab)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 p-1 rounded-xl mt-4 w-fit ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={`flex items-center justify-center h-48 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
            <RefreshCw size={24} className="animate-spin mr-2" /> Loading…
          </div>
        ) : tabContent[activeTab]?.()}
      </div>

      {/* Modals */}
      {showAccountForm && (
        <Modal title="New Account" onClose={() => setShowAccountForm(false)}>
          <AccountForm accounts={accounts} onSave={handleCreateAccount} onClose={() => setShowAccountForm(false)} />
        </Modal>
      )}
      {editingAccount && (
        <Modal title={`Edit Account — ${editingAccount.accountNumber}`} onClose={() => setEditingAccount(null)}>
          <AccountForm accounts={accounts} initial={editingAccount} onSave={handleUpdateAccount} onClose={() => setEditingAccount(null)} />
        </Modal>
      )}
      {showJEForm && (
        <Modal title="New Journal Entry" wide onClose={() => setShowJEForm(false)}>
          <JournalEntryForm accounts={accounts} onSave={handleCreateJE} onClose={() => setShowJEForm(false)} />
        </Modal>
      )}
      {showARForm && (
        <Modal title="New Accounts Receivable Record" onClose={() => setShowARForm(false)}>
          <ARForm accounts={accounts} onSave={handleCreateAR} onClose={() => setShowARForm(false)} />
        </Modal>
      )}
      {showAPForm && (
        <Modal title="New Accounts Payable Record" onClose={() => setShowAPForm(false)}>
          <APForm accounts={accounts} onSave={handleCreateAP} onClose={() => setShowAPForm(false)} />
        </Modal>
      )}
      {showRecForm && (
        <Modal title="Start Reconciliation" onClose={() => setShowRecForm(false)}>
          <ReconciliationForm accounts={accounts} onSave={handleCreateRec} onClose={() => setShowRecForm(false)} />
        </Modal>
      )}
      {showStmForm && (
        <Modal title="New Statement" onClose={() => setShowStmForm(false)}>
          <StatementForm onSave={handleCreateStatement} onClose={() => setShowStmForm(false)} />
        </Modal>
      )}
    </div>
  );
}
