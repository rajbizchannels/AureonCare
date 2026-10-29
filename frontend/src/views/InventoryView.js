import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Package, ArrowUpDown, ShoppingCart, Truck, Tag,
  Plus, Edit2, Trash2, Eye, Search, Filter, RefreshCw, Download,
  AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp, TrendingDown,
  BarChart2, Box, Layers, DollarSign, Hash, Calendar, Info,
  ChevronDown, ChevronRight, X, Check, FileText, Printer,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAudit } from '../hooks/useAudit';
import { useApp } from '../context/AppContext';
import { useShellTab } from '../hooks/useShellTab';
import ThemedSelect from '../components/forms/ThemedSelect';
import { getTranslations } from '../config/translations';

const useT = () => getTranslations(useApp().language);

// Display labels for enum values (option `value`s and API values stay unchanged)
const getStatusLabels = (t) => ({
  active:       t.active || 'Active',
  inactive:     t.inactive || 'Inactive',
  draft:        t.draft || 'Draft',
  pending:      t.pending || 'Pending',
  approved:     t.invStatusApproved || 'Approved',
  ordered:      t.ordered || 'Ordered',
  received:     t.received || 'Received',
  partial:      t.invPartial || 'Partial',
  cancelled:    t.cancelled || 'Cancelled',
  in:           t.invMovIn || 'Stock In',
  out:          t.invMovOut || 'Stock Out',
  adjustment:   t.invAdjustment || 'Adjustment',
  transfer:     t.invTransfer || 'Transfer',
  expired:      t.invExpired || 'Expired',
  low_stock:    t.lowStock || 'Low Stock',
  discontinued: t.discontinued || 'Discontinued',
  return:       t.invReturn || 'Return',
  on_hold:      t.onHold || 'On Hold',
});

const getItemTypeLabels = (t) => ({
  supply:     t.invTypeSupply || 'Supply',
  medication: t.medication || 'Medication',
  equipment:  t.invTypeEquipment || 'Equipment',
  consumable: t.invTypeConsumable || 'Consumable',
  reagent:    t.invTypeReagent || 'Reagent',
  implant:    t.invTypeImplant || 'Implant',
  other:      t.other || 'Other',
});

const getUnitLabels = (t) => ({
  each:   t.invUomEach || 'each',
  box:    t.invUomBox || 'box',
  case:   t.invUomCase || 'case',
  pack:   t.invUomPack || 'pack',
  bottle: t.invUomBottle || 'bottle',
  vial:   t.invUomVial || 'vial',
  kit:    t.invUomKit || 'kit',
  roll:   t.invUomRoll || 'roll',
  pair:   t.invUomPair || 'pair',
  set:    t.invUomSet || 'set',
  gram:   t.invUomGram || 'gram',
  ml:     t.invUomMl || 'ml',
  liter:  t.invUomLiter || 'liter',
});

const getPaymentTermLabels = (t) => ({
  net_15:      t.invTermNet15 || 'Net 15',
  net_30:      t.invTermNet30 || 'Net 30',
  net_60:      t.invTermNet60 || 'Net 60',
  net_90:      t.invTermNet90 || 'Net 90',
  cod:         t.invTermCod || 'COD',
  prepaid:     t.invTermPrepaid || 'Prepaid',
  consignment: t.invTermConsignment || 'Consignment',
});

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
      ? <ToggleRight size={28} className="text-orange-500 flex-shrink-0" />
      : <ToggleLeft  size={28} className="text-gray-400 flex-shrink-0" />}
    {label && <span className="text-sm">{label}</span>}
  </button>
);

const Badge = ({ status }) => {
  const t = useT();
  const labels = getStatusLabels(t);
  const map = {
    active:       'bg-green-100 text-green-700',
    inactive:     'bg-gray-100 text-gray-500',
    draft:        'bg-gray-100 text-gray-700',
    pending:      'bg-yellow-100 text-yellow-700',
    approved:     'bg-blue-100 text-blue-700',
    ordered:      'bg-indigo-100 text-indigo-700',
    received:     'bg-green-100 text-green-700',
    partial:      'bg-orange-100 text-orange-700',
    cancelled:    'bg-red-100 text-red-600',
    in:           'bg-green-100 text-green-700',
    out:          'bg-red-100 text-red-700',
    adjustment:   'bg-yellow-100 text-yellow-700',
    transfer:     'bg-blue-100 text-blue-700',
    expired:      'bg-red-100 text-red-700',
    low_stock:    'bg-orange-100 text-orange-700',
    discontinued: 'bg-gray-100 text-gray-500',
    return:       'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status?.replace(/_/g, ' ')}
    </span>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, color, trend }) => {
  const { theme } = useApp();
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
      <div className={`p-2.5 rounded-lg ${color || 'bg-orange-100'}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
};

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

const FormField = ({ label, required, error, children, className }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);

const Input = ({ className = '', ...props }) => (
  <input className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent ${className}`} {...props} />
);

const Select = ({ className = '', children, ...props }) => (
  <ThemedSelect focusClass="focus:ring-2 focus:ring-orange-500" className={`text-sm ${className}`} {...props}>
    {children}
  </ThemedSelect>
);

const Textarea = ({ className = '', ...props }) => (
  <textarea className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 resize-none ${className}`} rows={3} {...props} />
);

const Btn = ({ variant = 'primary', size = 'sm', icon: Icon, children, className = '', ...props }) => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  const sizes = { xs: 'px-2 py-1 text-xs', sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary:   'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:ring-gray-400',
    danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success:   'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    warning:   'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-400',
    ghost:     'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 focus:ring-gray-300',
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

const ItemForm = ({ categories, suppliers, onSave, onClose, initial }) => {
  const t = useT();
  const itemTypeLabels = getItemTypeLabels(t);
  const unitLabels = getUnitLabels(t);
  const statusLabels = getStatusLabels(t);
  const [form, setForm] = useState({
    name:                  initial?.name || '',
    category_id:           initial?.category_id || '',
    supplier_id:           initial?.supplier_id || '',
    item_type:             initial?.item_type || 'supply',
    unit_of_measure:       initial?.unit_of_measure || 'each',
    sku:                   initial?.sku || '',
    barcode:               initial?.barcode || '',
    unit_cost:             initial?.unit_cost ?? '',
    selling_price:         initial?.selling_price ?? '',
    reorder_level:         initial?.reorder_level ?? '',
    reorder_quantity:      initial?.reorder_quantity ?? '',
    description:           initial?.description || '',
    is_lot_tracked:        initial?.is_lot_tracked || false,
    is_expiry_tracked:     initial?.is_expiry_tracked || false,
    requires_refrigeration: initial?.requires_refrigeration || false,
    status:                initial?.status || 'active',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t.invItemNameRequired || 'Item name is required';
    if (!form.item_type) e.item_type = t.invItemTypeRequired || 'Item type is required';
    if (!form.unit_of_measure) e.unit_of_measure = t.invUomRequired || 'Unit of measure is required';
    if (form.unit_cost !== '' && parseFloat(form.unit_cost) < 0) e.unit_cost = t.invUnitCostMin || 'Unit cost must be 0 or greater';
    if (form.reorder_level !== '' && parseFloat(form.reorder_level) < 0) e.reorder_level = t.invReorderLevelMin || 'Reorder level must be 0 or greater';
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
        <FormField label={t.itemName || 'Item Name'} required error={errors.name} className="col-span-2">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t.invItemNamePlaceholder || 'e.g. Nitrile Gloves (Box/100)'} />
        </FormField>
        <FormField label={t.itemType || 'Item Type'} required error={errors.item_type}>
          <Select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}>
            {['supply','medication','equipment','consumable','reagent','implant','other'].map(typ => (
              <option key={typ} value={typ}>{itemTypeLabels[typ] || typ.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.unitOfMeasure || 'Unit of Measure'} required error={errors.unit_of_measure}>
          <Select value={form.unit_of_measure} onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))}>
            {['each','box','case','pack','bottle','vial','kit','roll','pair','set','gram','ml','liter'].map(u => (
              <option key={u} value={u}>{unitLabels[u] || u}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.invCategory || 'Category'}>
          <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">{t.invNone || '— None —'}</option>
            {categories.filter(c => c.is_active !== false).map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.invPrimarySupplier || 'Primary Supplier'}>
          <Select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">{t.invNone || '— None —'}</option>
            {suppliers.filter(s => s.status !== 'inactive').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.sku || 'SKU'}>
          <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder={t.invSkuPlaceholder || 'Stock-keeping unit'} />
        </FormField>
        <FormField label={t.invBarcode || 'Barcode'}>
          <Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder={t.invBarcodePlaceholder || 'UPC / barcode'} />
        </FormField>
        <FormField label={`${t.unitCost || 'Unit Cost'} ($)`} error={errors.unit_cost}>
          <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
        </FormField>
        <FormField label={`${t.sellingPrice || 'Selling Price'} ($)`}>
          <Input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0.00" />
        </FormField>
        <FormField label={t.reorderLevel || 'Reorder Level'} error={errors.reorder_level}>
          <Input type="number" min="0" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} placeholder={t.invReorderLevelPlaceholder || 'Minimum qty before reorder'} />
        </FormField>
        <FormField label={t.reorderQuantity || 'Reorder Quantity'}>
          <Input type="number" min="0" value={form.reorder_quantity} onChange={e => setForm(f => ({ ...f, reorder_quantity: e.target.value }))} placeholder={t.invReorderQtyPlaceholder || 'Qty to reorder'} />
        </FormField>
      </div>
      <FormField label={t.description || 'Description'}>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t.invItemDescPlaceholder || 'Item description...'} />
      </FormField>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 dark:text-slate-400">{t.invTrackingOptions || 'Tracking Options'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Toggle value={form.is_lot_tracked} onChange={v => setForm(f => ({ ...f, is_lot_tracked: v }))} label={t.lotBatchTracked || 'Lot / Batch Tracked'} />
          <Toggle value={form.is_expiry_tracked} onChange={v => setForm(f => ({ ...f, is_expiry_tracked: v }))} label={t.expiryDateTracked || 'Expiry Date Tracked'} />
          <Toggle value={form.requires_refrigeration} onChange={v => setForm(f => ({ ...f, requires_refrigeration: v }))} label={t.invRequiresRefrigeration || 'Requires Refrigeration'} />
        </div>
      </div>
      {initial && (
        <FormField label={t.status || 'Status'}>
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {['active','inactive','discontinued'].map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>)}
          </Select>
        </FormField>
      )}
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>{t.cancel || 'Cancel'}</Btn>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? (t.saving || 'Saving...') : initial ? (t.invUpdateItem || 'Update Item') : (t.invCreateItem || 'Create Item')}</Btn>
      </div>
    </form>
  );
};

const StockMovementForm = ({ items, onSave, onClose }) => {
  const t = useT();
  const unitLabels = getUnitLabels(t);
  const [form, setForm] = useState({
    item_id:        '',
    movement_type:  'in',
    quantity:       '',
    unit_cost:      '',
    lot_number:     '',
    expiry_date:    '',
    movement_date:  new Date().toISOString().split('T')[0],
    notes:          '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const selectedItem = items.find(i => i.id === form.item_id);

  const validate = () => {
    const e = {};
    if (!form.item_id) e.item_id = t.invItemRequired || 'Item is required';
    if (!form.movement_type) e.movement_type = t.invMovementTypeRequired || 'Movement type is required';
    if (!form.quantity || parseFloat(form.quantity) <= 0) e.quantity = t.invQuantityPositive || 'Quantity must be greater than 0';
    if (!form.movement_date) e.movement_date = t.invMovementDateRequired || 'Movement date is required';
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
        <FormField label={t.item || 'Item'} required error={errors.item_id} className="col-span-2">
          <Select value={form.item_id} onChange={e => setForm(f => ({ ...f, item_id: e.target.value }))}>
            <option value="">{t.invSelectItem || 'Select item…'}</option>
            {items.filter(i => i.status !== 'inactive').map(i => (
              <option key={i.id} value={i.id}>{i.item_number ? `${i.item_number} — ` : ''}{i.name}</option>
            ))}
          </Select>
        </FormField>
        {selectedItem && (
          <div className="col-span-2 flex gap-4 text-xs px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
            <span>{t.invCurrentStock || 'Current Stock'}: <strong>{selectedItem.quantity_on_hand ?? '—'} {unitLabels[selectedItem.unit_of_measure] || selectedItem.unit_of_measure}</strong></span>
            <span>{t.reorderLevel || 'Reorder Level'}: <strong>{selectedItem.reorder_level ?? '—'}</strong></span>
          </div>
        )}
        <FormField label={t.movementType || 'Movement Type'} required error={errors.movement_type}>
          <Select value={form.movement_type} onChange={e => setForm(f => ({ ...f, movement_type: e.target.value }))}>
            <option value="in">{t.invMovInReceipt || 'Stock In (Receipt)'}</option>
            <option value="out">{t.invMovOutDispense || 'Stock Out (Dispense)'}</option>
            <option value="adjustment">{t.invAdjustment || 'Adjustment'}</option>
            <option value="transfer">{t.invTransfer || 'Transfer'}</option>
            <option value="return">{t.invReturn || 'Return'}</option>
            <option value="expired">{t.invWriteOffExpired || 'Write-off / Expired'}</option>
          </Select>
        </FormField>
        <FormField label={t.movementDate || 'Movement Date'} required error={errors.movement_date}>
          <Input type="date" value={form.movement_date} onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))} />
        </FormField>
        <FormField label={t.quantity || 'Quantity'} required error={errors.quantity}>
          <Input type="number" min="0.001" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder={t.invAlwaysPositive || 'Always positive'} />
        </FormField>
        <FormField label={`${t.unitCost || 'Unit Cost'} ($)`}>
          <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
        </FormField>
        {(selectedItem?.is_lot_tracked) && (
          <FormField label={t.lotBatchNumber || 'Lot / Batch Number'}>
            <Input value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="LOT-XXXXX" />
          </FormField>
        )}
        {(selectedItem?.is_expiry_tracked) && (
          <FormField label={t.expiryDate || 'Expiry Date'}>
            <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          </FormField>
        )}
      </div>
      <FormField label={t.notes || 'Notes'}>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t.invMovementNotesPlaceholder || 'Reason, reference, additional info…'} />
      </FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>{t.cancel || 'Cancel'}</Btn>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? (t.saving || 'Saving...') : (t.invRecordMovement || 'Record Movement')}</Btn>
      </div>
    </form>
  );
};

const PurchaseOrderForm = ({ suppliers, items, onSave, onClose, currency = 'USD' }) => {
  const t = useT();
  const [form, setForm] = useState({
    supplier_id:   '',
    order_date:    new Date().toISOString().split('T')[0],
    expected_date: '',
    notes:         '',
  });
  const [lines, setLines] = useState([{ item_id: '', quantity_ordered: '', unit_cost: '' }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(l => [...l, { item_id: '', quantity_ordered: '', unit_cost: '' }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, field, val) => setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: val } : line));

  const orderTotal = lines.reduce((sum, l) => sum + ((parseFloat(l.quantity_ordered) || 0) * (parseFloat(l.unit_cost) || 0)), 0);

  const validate = () => {
    const e = {};
    if (!form.supplier_id) e.supplier_id = t.invSupplierRequired || 'Supplier is required';
    if (!form.order_date) e.order_date = t.invOrderDateRequired || 'Order date is required';
    const hasValidLines = lines.some(l => l.item_id && parseFloat(l.quantity_ordered) > 0);
    if (!hasValidLines) e.lines = t.invLineItemRequired || 'At least one line item with item and quantity is required';
    for (const l of lines) {
      if (l.item_id && (!l.quantity_ordered || parseFloat(l.quantity_ordered) <= 0)) {
        e.lines = t.invLineQtyInvalid || 'All line items must have a valid quantity';
        break;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try { await onSave({ ...form, line_items: lines.filter(l => l.item_id && l.quantity_ordered) }); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t.invSupplier || 'Supplier'} required error={errors.supplier_id}>
          <Select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">{t.invSelectSupplier || 'Select supplier…'}</option>
            {suppliers.filter(s => s.status !== 'inactive').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.orderDate || 'Order Date'} required>
          <Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
        </FormField>
        <FormField label={t.expectedDeliveryDate || 'Expected Delivery Date'} className="col-span-2">
          <Input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
        </FormField>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600 dark:text-slate-400">{t.lineItems || 'Line Items'}</p>
          <button type="button" onClick={addLine} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
            <Plus size={12} /> {t.addItem || 'Add Item'}
          </button>
        </div>
        {errors.lines && <p className="text-xs text-red-500">{errors.lines}</p>}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 px-1">
            <div className="col-span-5">{t.item || 'Item'}</div>
            <div className="col-span-3">{t.quantityOrdered || 'Quantity Ordered'}</div>
            <div className="col-span-3">{t.unitCost || 'Unit Cost'} ($)</div>
            <div className="col-span-1" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Select value={line.item_id} onChange={e => {
                  const item = items.find(it => it.id === e.target.value);
                  updateLine(i, 'item_id', e.target.value);
                  if (item?.unit_cost) updateLine(i, 'unit_cost', item.unit_cost);
                }}>
                  <option value="">{t.invSelectItem || 'Select item…'}</option>
                  {items.filter(it => it.status !== 'inactive').map(it => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-3">
                <Input type="number" min="1" step="1" placeholder={t.qty || 'Qty'} value={line.quantity_ordered} onChange={e => updateLine(i, 'quantity_ordered', e.target.value)} />
              </div>
              <div className="col-span-3">
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={line.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)} />
              </div>
              <div className="col-span-1 flex justify-center">
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end text-sm px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <span className="text-orange-800 dark:text-orange-300">
            {t.invOrderTotal || 'Order Total'}: <strong>{formatCurrency(orderTotal, currency)}</strong>
          </span>
        </div>
      </div>

      <FormField label={t.notes || 'Notes'}>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t.invPoNotesPlaceholder || 'Special instructions, delivery notes…'} />
      </FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>{t.cancel || 'Cancel'}</Btn>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? (t.saving || 'Saving...') : (t.invCreatePurchaseOrder || 'Create Purchase Order')}</Btn>
      </div>
    </form>
  );
};

const SupplierForm = ({ onSave, onClose, initial }) => {
  const t = useT();
  const paymentTermLabels = getPaymentTermLabels(t);
  const statusLabels = getStatusLabels(t);
  const [form, setForm] = useState({
    name:          initial?.name || '',
    contact_name:  initial?.contact_name || '',
    email:         initial?.email || '',
    phone:         initial?.phone || '',
    address:       initial?.address || '',
    city:          initial?.city || '',
    country:       initial?.country || '',
    payment_terms: initial?.payment_terms || 'net_30',
    tax_id:        initial?.tax_id || '',
    status:        initial?.status || 'active',
    notes:         initial?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t.invSupplierNameRequired || 'Supplier name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t.invInvalidEmail || 'Invalid email address';
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
        <FormField label={t.supplierName || 'Supplier Name'} required error={errors.name} className="col-span-2">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t.invSupplierNamePlaceholder || 'e.g. MedSupply Corp'} />
        </FormField>
        <FormField label={t.contactName || 'Contact Name'}>
          <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder={t.invPrimaryContact || 'Primary contact'} />
        </FormField>
        <FormField label={t.email || 'Email'} error={errors.email}>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="orders@supplier.com" />
        </FormField>
        <FormField label={t.phone || 'Phone'}>
          <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
        </FormField>
        <FormField label={t.invTaxIdEin || 'Tax ID / EIN'}>
          <Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="XX-XXXXXXX" />
        </FormField>
        <FormField label={t.address || 'Address'} className="col-span-2">
          <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t.invStreetAddress || 'Street address'} />
        </FormField>
        <FormField label={t.city || 'City'}>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </FormField>
        <FormField label={t.country || 'Country'}>
          <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder={t.invCountryPlaceholder || 'e.g. United States'} />
        </FormField>
        <FormField label={t.paymentTerms || 'Payment Terms'}>
          <Select value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
            {['net_15','net_30','net_60','net_90','cod','prepaid','consignment'].map(term => (
              <option key={term} value={term}>{(paymentTermLabels[term] || term.replace(/_/g, ' ')).toUpperCase()}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.status || 'Status'}>
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {['active','inactive','on_hold'].map(s => <option key={s} value={s}>{statusLabels[s] || s.replace(/_/g, ' ')}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label={t.notes || 'Notes'}>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t.invSupplierNotesPlaceholder || 'Additional notes about this supplier…'} />
      </FormField>
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>{t.cancel || 'Cancel'}</Btn>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? (t.saving || 'Saving...') : initial ? (t.invUpdateSupplier || 'Update Supplier') : (t.invCreateSupplier || 'Create Supplier')}</Btn>
      </div>
    </form>
  );
};

const CategoryForm = ({ categories, onSave, onClose, initial }) => {
  const t = useT();
  const [form, setForm] = useState({
    code:        initial?.code || '',
    name:        initial?.name || '',
    description: initial?.description || '',
    parent_id:   initial?.parent_id || '',
    is_active:   initial?.is_active !== false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = t.invCategoryCodeRequired || 'Category code is required';
    if (!form.name.trim()) e.name = t.invCategoryNameRequired || 'Category name is required';
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
        <FormField label={t.code || 'Code'} required error={errors.code}>
          <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder={t.invCategoryCodePlaceholder || 'e.g. MEDS'} />
        </FormField>
        <FormField label={t.name || 'Name'} required error={errors.name}>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t.invCategoryNamePlaceholder || 'e.g. Medications'} />
        </FormField>
        <FormField label={t.invParentCategory || 'Parent Category'} className="col-span-2">
          <Select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
            <option value="">{t.invTopLevel || '— Top Level —'}</option>
            {categories.filter(c => c.id !== initial?.id).map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.description || 'Description'} className="col-span-2">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t.invCategoryDescPlaceholder || 'Category description…'} />
        </FormField>
      </div>
      <Toggle value={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} label={t.invCategoryIsActive || 'Category is Active'} />
      <div className="flex gap-2 pt-2 justify-end">
        <Btn variant="secondary" type="button" onClick={onClose}>{t.cancel || 'Cancel'}</Btn>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? (t.saving || 'Saving...') : initial ? (t.invUpdateCategory || 'Update Category') : (t.invCreateCategory || 'Create Category')}</Btn>
      </div>
    </form>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',         icon: LayoutDashboard },
  { id: 'items',       label: 'Items',            icon: Package },
  { id: 'stock',       label: 'Stock',            icon: ArrowUpDown },
  { id: 'orders',      label: 'Purchase Orders',  icon: ShoppingCart },
  { id: 'suppliers',   label: 'Suppliers',        icon: Truck },
  { id: 'categories',  label: 'Categories',       icon: Tag },
];

export default function InventoryView({ theme, api, user, addNotification, setCurrentModule, currency = 'USD', activeTab: shellTab, onTabChange }) {
  const t = useT();
  const [activeTab, setActiveTab, tabsInShell] = useShellTab(shellTab, onTabChange, 'overview');
  const [loading, setLoading] = useState(false);

  // Data
  const [items,      setItems]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [movements,  setMovements]  = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [dashboard,  setDashboard]  = useState(null);

  // Forms
  const [showItemForm,     setShowItemForm]     = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showOrderForm,    setShowOrderForm]    = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem,      setEditingItem]      = useState(null);
  const [editingSupplier,  setEditingSupplier]  = useState(null);
  const [editingCategory,  setEditingCategory]  = useState(null);
  const [viewingOrder,     setViewingOrder]     = useState(null);

  // Filters
  const [itemSearch,       setItemSearch]       = useState('');
  const [itemTypeFilter,   setItemTypeFilter]   = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState('active');
  const [supplierSearch,   setSupplierSearch]   = useState('');
  const [movTypeFilter,    setMovTypeFilter]    = useState('');
  const [movDateFilter,    setMovDateFilter]    = useState('');
  const [orderStatusFilter,setOrderStatusFilter]= useState('');

  // Toggles
  const [showLowStock,    setShowLowStock]    = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

  const { logViewAccess, logCreate, logUpdate, logDelete } = useAudit();

  useEffect(() => {
    logViewAccess('InventoryView', { module: 'Inventory' });
  }, [logViewAccess]);

  // ── RBAC ──────────────────────────────────────────────────────────────────────

  const userRole = user?.role || 'doctor';
  const can = useCallback((resource, action) => {
    if (userRole === 'admin') return true;
    const roleMap = {
      billing_manager: {
        items:            { view: true, create: true, edit: true },
        suppliers:        { view: true, create: true, edit: true },
        purchase_orders:  { view: true, create: true, edit: true, approve: true },
        stock_movements:  { view: true, create: true },
        categories:       { view: true },
      },
      doctor: {
        items:           { view: true },
        stock_movements: { view: true },
        categories:      { view: true },
      },
      nurse: {
        items:           { view: true },
        stock_movements: { view: true, create: true },
        categories:      { view: true },
      },
      receptionist: {
        items:      { view: true },
        categories: { view: true },
      },
    };
    return roleMap[userRole]?.[resource]?.[action] === true;
  }, [userRole]);

  // ── Data fetching ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': {
          const [dash, itms, cats] = await Promise.all([
            api.getInventorySummary(),
            api.getInventoryItems(),
            api.getInventoryCategories(),
          ]);
          setDashboard(dash); setItems(itms); setCategories(cats);
          break;
        }
        case 'items': {
          const [itms, cats, sups] = await Promise.all([
            api.getInventoryItems(),
            api.getInventoryCategories(),
            api.getInventorySuppliers(),
          ]);
          setItems(itms); setCategories(cats); setSuppliers(sups);
          break;
        }
        case 'stock': {
          const [movs, itms] = await Promise.all([api.getInventoryMovements(), api.getInventoryItems()]);
          setMovements(movs); setItems(itms);
          break;
        }
        case 'orders': {
          const [ords, sups, itms] = await Promise.all([
            api.getInventoryOrders(),
            api.getInventorySuppliers(),
            api.getInventoryItems(),
          ]);
          setOrders(ords); setSuppliers(sups); setItems(itms);
          break;
        }
        case 'suppliers':
          setSuppliers(await api.getInventorySuppliers());
          break;
        case 'categories':
          setCategories(await api.getInventoryCategories());
          break;
        default: break;
      }
    } catch (err) {
      addNotification('alert', (t.invLoadFailed || 'Failed to load inventory data: {error}').replace('{error}', err.message));
    } finally {
      setLoading(false);
    }
  }, [api, addNotification, t]);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateItem = async (form) => {
    try {
      const created = await api.createInventoryItem(form);
      setItems(prev => [created, ...prev]);
      setShowItemForm(false);
      logCreate('InventoryItem', form, { module: 'Inventory' });
      addNotification('success', (t.invItemCreated || 'Item "{name}" created').replace('{name}', created.name));
    } catch (err) { addNotification('error', err.message || t.invItemCreateFailed || 'Failed to create item'); }
  };

  const handleUpdateItem = async (form) => {
    try {
      const updated = await api.updateInventoryItem(editingItem.id, form);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditingItem(null);
      logUpdate('InventoryItem', editingItem, form, { module: 'Inventory' });
      addNotification('success', (t.invItemUpdated || 'Item "{name}" updated').replace('{name}', updated.name));
    } catch (err) { addNotification('error', err.message || t.invItemUpdateFailed || 'Failed to update item'); }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm((t.invConfirmDeleteItem || 'Delete item "{name}"? This cannot be undone.').replace('{name}', item.name))) return;
    try {
      await api.deleteInventoryItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      logDelete('InventoryItem', item, { module: 'Inventory' });
      addNotification('success', (t.invItemDeleted || 'Item "{name}" deleted').replace('{name}', item.name));
    } catch (err) { addNotification('error', err.message || t.invItemDeleteFailed || 'Failed to delete item'); }
  };

  const handleCreateMovement = async (form) => {
    try {
      const created = await api.createInventoryMovement(form);
      setMovements(prev => [created, ...prev]);
      // Refresh item stock
      const updatedItem = await api.getInventoryItem(form.item_id);
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      setShowMovementForm(false);
      logCreate('StockMovement', form, { module: 'Inventory' });
      addNotification('success', t.invMovementRecorded || 'Stock movement recorded');
    } catch (err) { addNotification('error', err.message || t.invMovementFailed || 'Failed to record movement'); }
  };

  const handleCreateOrder = async (form) => {
    try {
      const created = await api.createInventoryOrder(form);
      setOrders(prev => [created, ...prev]);
      setShowOrderForm(false);
      logCreate('PurchaseOrder', form, { module: 'Inventory' });
      addNotification('success', (t.invPoCreated || 'Purchase order {number} created').replace('{number}', created.po_number || ''));
    } catch (err) { addNotification('error', err.message || t.invPoCreateFailed || 'Failed to create purchase order'); }
  };

  const handleApproveOrder = async (id) => {
    try {
      const updated = await api.updateInventoryOrder(id, { status: 'approved' });
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      addNotification('success', t.invPoApproved || 'Purchase order approved');
    } catch (err) { addNotification('error', err.message || t.invPoApproveFailed || 'Failed to approve purchase order'); }
  };

  const handleReceiveOrder = async (order) => {
    if (!window.confirm((t.invConfirmReceive || 'Mark PO {number} as received and update stock?').replace('{number}', order.po_number || order.id))) return;
    try {
      const updated = await api.receiveInventoryOrder(order.id);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      addNotification('success', t.invOrderReceived || 'Order received and stock updated');
      // Refresh items to reflect updated stock
      const itms = await api.getInventoryItems();
      setItems(itms);
    } catch (err) { addNotification('error', err.message || t.invReceiveFailed || 'Failed to receive order'); }
  };

  const handleCancelOrder = async (id) => {
    if (!window.confirm(t.invConfirmCancelPo || 'Cancel this purchase order?')) return;
    try {
      const updated = await api.updateInventoryOrder(id, { status: 'cancelled' });
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      addNotification('success', t.invPoCancelled || 'Purchase order cancelled');
    } catch (err) { addNotification('error', err.message || t.invCancelOrderFailed || 'Failed to cancel order'); }
  };

  const handleCreateSupplier = async (form) => {
    try {
      const created = await api.createInventorySupplier(form);
      setSuppliers(prev => [created, ...prev]);
      setShowSupplierForm(false);
      logCreate('Supplier', form, { module: 'Inventory' });
      addNotification('success', (t.invSupplierCreated || 'Supplier "{name}" created').replace('{name}', created.name));
    } catch (err) { addNotification('error', err.message || t.invSupplierCreateFailed || 'Failed to create supplier'); }
  };

  const handleUpdateSupplier = async (form) => {
    try {
      const updated = await api.updateInventorySupplier(editingSupplier.id, form);
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      setEditingSupplier(null);
      logUpdate('Supplier', editingSupplier, form, { module: 'Inventory' });
      addNotification('success', (t.invSupplierUpdated || 'Supplier "{name}" updated').replace('{name}', updated.name));
    } catch (err) { addNotification('error', err.message || t.invSupplierUpdateFailed || 'Failed to update supplier'); }
  };

  const handleCreateCategory = async (form) => {
    try {
      const created = await api.createInventoryCategory(form);
      setCategories(prev => [created, ...prev]);
      setShowCategoryForm(false);
      logCreate('InventoryCategory', form, { module: 'Inventory' });
      addNotification('success', (t.invCategoryCreated || 'Category "{name}" created').replace('{name}', created.name));
    } catch (err) { addNotification('error', err.message || t.invCategoryCreateFailed || 'Failed to create category'); }
  };

  const handleUpdateCategory = async (form) => {
    try {
      const updated = await api.updateInventoryCategory(editingCategory.id, form);
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditingCategory(null);
      logUpdate('InventoryCategory', editingCategory, form, { module: 'Inventory' });
      addNotification('success', (t.invCategoryUpdated || 'Category "{name}" updated').replace('{name}', updated.name));
    } catch (err) { addNotification('error', err.message || t.invCategoryUpdateFailed || 'Failed to update category'); }
  };

  const handleToggleCategory = async (cat) => {
    try {
      const updated = await api.updateInventoryCategory(cat.id, { is_active: !cat.is_active });
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      addNotification('success', updated.is_active ? (t.invCategoryActivated || 'Category activated') : (t.invCategoryDeactivated || 'Category deactivated'));
    } catch (err) { addNotification('error', t.invCategoryToggleFailed || 'Failed to toggle category status'); }
  };

  const statusLabels = getStatusLabels(t);
  const itemTypeLabels = getItemTypeLabels(t);
  const unitLabels = getUnitLabels(t);
  const paymentTermLabels = getPaymentTermLabels(t);
  const tabLabels = {
    overview:   t.overviewTab || 'Overview',
    items:      t.items || 'Items',
    stock:      t.stock || 'Stock',
    orders:     t.purchaseOrders || 'Purchase Orders',
    suppliers:  t.suppliers || 'Suppliers',
    categories: t.categories || 'Categories',
  };

  // ── Filtered data ─────────────────────────────────────────────────────────────

  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const filteredItems = items.filter(item => {
    if (itemStatusFilter && item.status !== itemStatusFilter) return false;
    if (itemTypeFilter && item.item_type !== itemTypeFilter) return false;
    if (showLowStock && !(parseFloat(item.quantity_on_hand || 0) <= parseFloat(item.reorder_level || 0))) return false;
    if (showExpiringSoon && item.next_expiry_date) {
      const expiry = new Date(item.next_expiry_date);
      if (expiry > thirtyDaysFromNow) return false;
    } else if (showExpiringSoon && !item.next_expiry_date) {
      return false;
    }
    if (itemSearch) {
      const q = itemSearch.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.item_number?.toLowerCase().includes(q) ||
        item.barcode?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredMovements = movements.filter(mov => {
    if (movTypeFilter && mov.movement_type !== movTypeFilter) return false;
    if (movDateFilter && !mov.movement_date?.startsWith(movDateFilter)) return false;
    return true;
  });

  const filteredOrders = orders.filter(ord => {
    if (orderStatusFilter && ord.status !== orderStatusFilter) return false;
    return true;
  });

  const filteredSuppliers = suppliers.filter(sup => {
    if (!supplierSearch) return true;
    const q = supplierSearch.toLowerCase();
    return (
      sup.name?.toLowerCase().includes(q) ||
      sup.contact_name?.toLowerCase().includes(q) ||
      sup.email?.toLowerCase().includes(q)
    );
  });

  const lowStockItems = items.filter(i => parseFloat(i.quantity_on_hand || 0) <= parseFloat(i.reorder_level || 0) && i.status === 'active');
  const expiringItems = items.filter(i => {
    if (!i.next_expiry_date) return false;
    return new Date(i.next_expiry_date) <= thirtyDaysFromNow;
  });

  // ── Tab renderers ─────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t.invTotalItems || 'Total Items'}
          value={dashboard?.totalItems ?? items.length}
          sub={(t.invActiveCount || '{count} active').replace('{count}', items.filter(i => i.status === 'active').length)}
          icon={Package}
          color="bg-orange-100 text-orange-600"
        />
        <StatCard
          label={t.invTotalInventoryValue || 'Total Inventory Value'}
          value={formatCurrency(dashboard?.totalValue ?? items.reduce((s, i) => s + (parseFloat(i.quantity_on_hand || 0) * parseFloat(i.unit_cost || 0)), 0), currency)}
          sub={t.invAtCost || 'at cost'}
          icon={DollarSign}
          color="bg-amber-100 text-amber-600"
        />
        <StatCard
          label={t.invLowStockItems || 'Low Stock Items'}
          value={dashboard?.lowStockCount ?? lowStockItems.length}
          sub={t.invNeedReorder || 'need reorder'}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          label={t.invExpiringSoon || 'Expiring Soon'}
          value={dashboard?.expiringSoonCount ?? expiringItems.length}
          sub={t.invWithin30Days || 'within 30 days'}
          icon={Clock}
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <AlertTriangle size={16} className="text-red-500" />
            {t.invLowStockAlerts || 'Low Stock Alerts'}
            {lowStockItems.length > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
            )}
          </h3>
          {lowStockItems.length === 0 ? (
            <div className={`text-sm text-center py-6 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
              <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
              {t.invAllAdequatelyStocked || 'All items are adequately stocked'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStockItems.slice(0, 10).map(item => (
                <div key={item.id} className={`flex items-center justify-between py-2 border-b last:border-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {(t.invStockMinLine || 'Stock: {stock} / Min: {min}').replace('{stock}', item.quantity_on_hand ?? 0).replace('{min}', item.reorder_level ?? 0)}
                    </p>
                  </div>
                  <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                    {t.invReorder || 'Reorder'} {item.reorder_quantity ? `(${item.reorder_quantity})` : ''}
                  </span>
                </div>
              ))}
              {lowStockItems.length > 10 && (
                <p className={`text-xs text-center pt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                  {(t.invMoreItems || '+{count} more items').replace('{count}', lowStockItems.length - 10)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent Movements */}
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <ArrowUpDown size={16} className="text-orange-500" />
            {t.invRecentMovements || 'Recent Movements'}
          </h3>
          {movements.length === 0 ? (
            <div className={`text-sm text-center py-6 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
              {t.invNoRecentMovements || 'No recent stock movements'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {movements.slice(0, 10).map(mov => (
                <div key={mov.id} className={`flex items-center justify-between py-2 border-b last:border-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{mov.item_name}</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {formatDate(mov.movement_date)} · {mov.performed_by_name || t.system || 'System'}
                    </p>
                  </div>
                  <div className="ml-3 text-right">
                    <span className={`text-sm font-bold ${mov.movement_type === 'in' ? 'text-green-600' : 'text-red-500'}`}>
                      {mov.movement_type === 'in' ? '+' : '-'}{mov.quantity}
                    </span>
                    <p className="text-xs text-gray-400 capitalize">{statusLabels[mov.movement_type] || mov.movement_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          <BarChart2 size={16} className="text-orange-500" />
          {t.invItemsByCategory || 'Items by Category'}
        </h3>
        {categories.length === 0 ? (
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{t.invNoCategories || 'No categories defined'}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.filter(c => c.is_active !== false).map(cat => {
              const count = items.filter(i => i.category_id === cat.id).length;
              return (
                <div key={cat.id} className={`rounded-lg border p-3 text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-xs font-medium truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{cat.name}</p>
                  <p className={`text-lg font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{count}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{t.items || 'Items'}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderItems = () => (
    <div className="space-y-4">
      {/* Filters toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder={t.invSearchItemsPlaceholder || 'Search items, SKU, barcode…'} value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
        </div>
        <Select className="w-40" value={itemTypeFilter} onChange={e => setItemTypeFilter(e.target.value)}>
          <option value="">{t.allTypes || 'All Types'}</option>
          {['supply','medication','equipment','consumable','reagent','implant','other'].map(typ => (
            <option key={typ} value={typ}>{itemTypeLabels[typ] || typ.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        <Select className="w-36" value={itemStatusFilter} onChange={e => setItemStatusFilter(e.target.value)}>
          <option value="">{t.allStatuses || 'All Statuses'}</option>
          {['active','inactive','discontinued'].map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>)}
        </Select>
        <Toggle value={showLowStock} onChange={setShowLowStock} label={t.invLowStockOnly || 'Low Stock Only'} />
        <Toggle value={showExpiringSoon} onChange={setShowExpiringSoon} label={t.invExpiringSoon || 'Expiring Soon'} />
        {can('items', 'create') && (
          <Btn variant="primary" icon={Plus} onClick={() => { setShowItemForm(true); setEditingItem(null); }}>{t.invNewItem || 'New Item'}</Btn>
        )}
      </div>

      {/* Inline item form */}
      {(showItemForm || editingItem) && (
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {editingItem ? (t.invEditItemTitle || 'Edit Item — {name}').replace('{name}', editingItem.name) : (t.invNewInventoryItem || 'New Inventory Item')}
            </h3>
            <button onClick={() => { setShowItemForm(false); setEditingItem(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <ItemForm
            categories={categories}
            suppliers={suppliers}
            initial={editingItem}
            onSave={editingItem ? handleUpdateItem : handleCreateItem}
            onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          />
        </div>
      )}

      <Table
        theme={theme}
        headers={[t.invItemNumber || 'Item #', t.name || 'Name', t.type || 'Type', t.invCategory || 'Category', t.stock || 'Stock', t.invReorderLvl || 'Reorder Lvl', t.unitCost || 'Unit Cost', t.status || 'Status', t.actions || 'Actions']}
        empty={filteredItems.length === 0 ? (t.invNoItemsFound || 'No items found') : null}
      >
        {filteredItems.map(item => {
          const isLow = parseFloat(item.quantity_on_hand || 0) <= parseFloat(item.reorder_level || 0);
          const catName = categories.find(c => c.id === item.category_id)?.name || '—';
          return (
            <tr key={item.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
              <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{item.item_number || '—'}</td>
              <td className="px-4 py-3">
                <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                {item.sku && <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{t.sku || 'SKU'}: {item.sku}</div>}
              </td>
              <td className={`px-4 py-3 text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{itemTypeLabels[item.item_type] || item.item_type?.replace(/_/g, ' ')}</td>
              <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{catName}</td>
              <td className="px-4 py-3">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${isLow ? 'text-red-500' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {isLow && <AlertTriangle size={12} />}
                  {item.quantity_on_hand ?? 0} <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{unitLabels[item.unit_of_measure] || item.unit_of_measure}</span>
                </div>
              </td>
              <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{item.reorder_level ?? '—'}</td>
              <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(item.unit_cost || 0, currency)}</td>
              <td className="px-4 py-3"><Badge status={item.status || 'active'} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {can('items', 'edit') && (
                    <Btn variant="ghost" size="xs" icon={Edit2} onClick={() => { setEditingItem(item); setShowItemForm(false); }} />
                  )}
                  {can('items', 'delete') && (
                    <Btn variant="ghost" size="xs" icon={Trash2} className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteItem(item)} />
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );

  const renderStock = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select className="w-44" value={movTypeFilter} onChange={e => setMovTypeFilter(e.target.value)}>
          <option value="">{t.invAllMovementTypes || 'All Movement Types'}</option>
          {['in','out','adjustment','transfer','return','expired'].map(typ => (
            <option key={typ} value={typ}>{statusLabels[typ] || typ.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <Input
            type="month"
            className="w-40"
            value={movDateFilter}
            onChange={e => setMovDateFilter(e.target.value)}
            placeholder={t.invFilterByMonth || 'Filter by month'}
          />
        </div>
        {movDateFilter && (
          <Btn variant="ghost" size="xs" icon={X} onClick={() => setMovDateFilter('')}>{t.invClearDate || 'Clear Date'}</Btn>
        )}
        {can('stock_movements', 'create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowMovementForm(true)} className="ml-auto">{t.invRecordMovement || 'Record Movement'}</Btn>
        )}
      </div>

      {/* Inline movement form */}
      {showMovementForm && (
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.invRecordStockMovement || 'Record Stock Movement'}</h3>
            <button onClick={() => setShowMovementForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <StockMovementForm
            items={items}
            onSave={handleCreateMovement}
            onClose={() => setShowMovementForm(false)}
          />
        </div>
      )}

      <Table
        theme={theme}
        headers={[t.invMovNumber || 'Mov #', t.date || 'Date', t.item || 'Item', t.type || 'Type', t.quantity || 'Quantity', t.unitCost || 'Unit Cost', t.invLotNumber || 'Lot #', t.notes || 'Notes', t.invPerformedBy || 'Performed By']}
        empty={filteredMovements.length === 0 ? (t.invNoMovementsFound || 'No stock movements found') : null}
      >
        {filteredMovements.map(mov => (
          <tr key={mov.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{mov.movement_number || mov.id?.slice(0, 8)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(mov.movement_date)}</td>
            <td className="px-4 py-3">
              <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{mov.item_name}</div>
              {mov.item_sku && <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{mov.item_sku}</div>}
            </td>
            <td className="px-4 py-3"><Badge status={mov.movement_type} /></td>
            <td className="px-4 py-3">
              <span className={`text-sm font-bold ${['in','return'].includes(mov.movement_type) ? 'text-green-600' : 'text-red-500'}`}>
                {['in','return'].includes(mov.movement_type) ? '+' : '-'}{mov.quantity}
              </span>
              {mov.unit_of_measure && <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{unitLabels[mov.unit_of_measure] || mov.unit_of_measure}</span>}
            </td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{mov.unit_cost ? formatCurrency(mov.unit_cost, currency) : '—'}</td>
            <td className={`px-4 py-3 text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{mov.lot_number || '—'}</td>
            <td className={`px-4 py-3 text-xs max-w-40 truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{mov.notes || '—'}</td>
            <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{mov.performed_by_name || '—'}</td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select className="w-40" value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)}>
          <option value="">{t.allStatuses || 'All Statuses'}</option>
          {['draft','pending','approved','ordered','partial','received','cancelled'].map(s => (
            <option key={s} value={s}>{statusLabels[s] || s.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        {can('purchase_orders', 'create') && (
          <Btn variant="primary" icon={Plus} onClick={() => setShowOrderForm(true)} className="ml-auto">{t.invNewPurchaseOrder || 'New Purchase Order'}</Btn>
        )}
      </div>

      {/* Inline order form */}
      {showOrderForm && (
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.invNewPurchaseOrder || 'New Purchase Order'}</h3>
            <button onClick={() => setShowOrderForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <PurchaseOrderForm
            suppliers={suppliers}
            items={items}
            onSave={handleCreateOrder}
            onClose={() => setShowOrderForm(false)}
            currency={currency}
          />
        </div>
      )}

      {/* Order detail modal */}
      {viewingOrder && (
        <Modal title={`${t.purchaseOrder || 'Purchase Order'} — ${viewingOrder.po_number || viewingOrder.id}`} wide onClose={() => setViewingOrder(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.invSupplier || 'Supplier'}</span>
                <p className="font-medium">{viewingOrder.supplier_name}</p>
              </div>
              <div>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.status || 'Status'}</span>
                <p><Badge status={viewingOrder.status} /></p>
              </div>
              <div>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.orderDate || 'Order Date'}</span>
                <p className="font-medium">{formatDate(viewingOrder.order_date)}</p>
              </div>
              <div>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.invExpectedDate || 'Expected Date'}</span>
                <p className="font-medium">{formatDate(viewingOrder.expected_date) || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.notes || 'Notes'}</span>
                <p>{viewingOrder.notes || '—'}</p>
              </div>
            </div>
            {viewingOrder.line_items?.length > 0 && (
              <div>
                <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{t.lineItems || 'Line Items'}</p>
                <table className="w-full text-sm">
                  <thead className={`text-xs ${theme === 'dark' ? 'text-slate-400 bg-slate-900' : 'text-gray-500 bg-gray-50'}`}>
                    <tr>
                      <th className="px-3 py-2 text-left">{t.item || 'Item'}</th>
                      <th className="px-3 py-2 text-left">{t.quantityOrdered || 'Quantity Ordered'}</th>
                      <th className="px-3 py-2 text-left">{t.quantityReceived || 'Quantity Received'}</th>
                      <th className="px-3 py-2 text-left">{t.unitCost || 'Unit Cost'}</th>
                      <th className="px-3 py-2 text-left">{t.total || 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-100'}`}>
                    {viewingOrder.line_items.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{line.item_name || items.find(it => it.id === line.item_id)?.name || '—'}</td>
                        <td className="px-3 py-2">{line.quantity_ordered}</td>
                        <td className="px-3 py-2">{line.quantity_received ?? '—'}</td>
                        <td className="px-3 py-2">{formatCurrency(line.unit_cost || 0, currency)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency((line.quantity_ordered || 0) * (line.unit_cost || 0), currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-slate-700">
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.invOrderTotal || 'Order Total'}: <strong>{formatCurrency(viewingOrder.total_amount || 0, currency)}</strong>
              </span>
              <Btn variant="secondary" onClick={() => setViewingOrder(null)}>{t.close || 'Close'}</Btn>
            </div>
          </div>
        </Modal>
      )}

      <Table
        theme={theme}
        headers={[t.invPoNumber || 'PO #', t.invSupplier || 'Supplier', t.orderDate || 'Order Date', t.invExpectedDate || 'Expected Date', t.status || 'Status', t.total || 'Total', t.actions || 'Actions']}
        empty={filteredOrders.length === 0 ? (t.invNoPurchaseOrders || 'No purchase orders found') : null}
      >
        {filteredOrders.map(ord => (
          <tr key={ord.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-300' : ''}`}>{ord.po_number || ord.id?.slice(0, 8)}</td>
            <td className={`px-4 py-3 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{ord.supplier_name}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{formatDate(ord.order_date)}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{ord.expected_date ? formatDate(ord.expected_date) : '—'}</td>
            <td className="px-4 py-3"><Badge status={ord.status} /></td>
            <td className={`px-4 py-3 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(ord.total_amount || 0, currency)}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <Btn variant="ghost" size="xs" icon={Eye} onClick={() => setViewingOrder(ord)} />
                {ord.status === 'pending' && can('purchase_orders', 'approve') && (
                  <Btn variant="success" size="xs" icon={Check} onClick={() => handleApproveOrder(ord.id)}>{t.invApprove || 'Approve'}</Btn>
                )}
                {['approved','ordered','partial'].includes(ord.status) && can('purchase_orders', 'edit') && (
                  <Btn variant="primary" size="xs" icon={Package} onClick={() => handleReceiveOrder(ord)}>{t.invReceive || 'Receive'}</Btn>
                )}
                {['draft','pending'].includes(ord.status) && can('purchase_orders', 'edit') && (
                  <Btn variant="ghost" size="xs" icon={XCircle} className="text-red-500 hover:bg-red-50" onClick={() => handleCancelOrder(ord.id)} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderSuppliers = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" placeholder={t.invSearchSuppliers || 'Search suppliers…'} value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
        </div>
        {can('suppliers', 'create') && (
          <Btn variant="primary" icon={Plus} onClick={() => { setShowSupplierForm(true); setEditingSupplier(null); }}>{t.invNewSupplier || 'New Supplier'}</Btn>
        )}
      </div>

      {/* Inline supplier form */}
      {(showSupplierForm || editingSupplier) && (
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {editingSupplier ? (t.invEditSupplierTitle || 'Edit Supplier — {name}').replace('{name}', editingSupplier.name) : (t.invNewSupplier || 'New Supplier')}
            </h3>
            <button onClick={() => { setShowSupplierForm(false); setEditingSupplier(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <SupplierForm
            initial={editingSupplier}
            onSave={editingSupplier ? handleUpdateSupplier : handleCreateSupplier}
            onClose={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
          />
        </div>
      )}

      <Table
        theme={theme}
        headers={[t.invSupplierNumber || 'Supplier #', t.name || 'Name', t.invContact || 'Contact', t.email || 'Email', t.phone || 'Phone', t.status || 'Status', t.paymentTerms || 'Payment Terms', t.actions || 'Actions']}
        empty={filteredSuppliers.length === 0 ? (t.invNoSuppliersFound || 'No suppliers found') : null}
      >
        {filteredSuppliers.map(sup => (
          <tr key={sup.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-3 font-mono text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{sup.supplier_number || sup.id?.slice(0, 8)}</td>
            <td className="px-4 py-3">
              <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sup.name}</div>
              {sup.city && <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{sup.city}{sup.country ? `, ${sup.country}` : ''}</div>}
            </td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{sup.contact_name || '—'}</td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>
              {sup.email ? (
                <a href={`mailto:${sup.email}`} className="text-orange-500 hover:underline">{sup.email}</a>
              ) : '—'}
            </td>
            <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>{sup.phone || '—'}</td>
            <td className="px-4 py-3"><Badge status={sup.status || 'active'} /></td>
            <td className={`px-4 py-3 text-xs uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{paymentTermLabels[sup.payment_terms] || sup.payment_terms?.replace(/_/g, ' ') || '—'}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                {can('suppliers', 'edit') && (
                  <Btn variant="ghost" size="xs" icon={Edit2} onClick={() => { setEditingSupplier(sup); setShowSupplierForm(false); }} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
          {(t.invCategoryCount || '{count} category(s)').replace('{count}', categories.length)}
        </div>
        {can('categories', 'create') && (
          <Btn variant="primary" icon={Plus} onClick={() => { setShowCategoryForm(true); setEditingCategory(null); }}>{t.invNewCategory || 'New Category'}</Btn>
        )}
      </div>

      {/* Inline category form */}
      {(showCategoryForm || editingCategory) && (
        <div className={`rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {editingCategory ? (t.invEditCategoryTitle || 'Edit Category — {name}').replace('{name}', editingCategory.name) : (t.invNewCategory || 'New Category')}
            </h3>
            <button onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <CategoryForm
            categories={categories}
            initial={editingCategory}
            onSave={editingCategory ? handleUpdateCategory : handleCreateCategory}
            onClose={() => { setShowCategoryForm(false); setEditingCategory(null); }}
          />
        </div>
      )}

      <Table
        theme={theme}
        headers={[t.code || 'Code', t.name || 'Name', t.description || 'Description', t.invParent || 'Parent', t.items || 'Items', t.active || 'Active', t.actions || 'Actions']}
        empty={categories.length === 0 ? (t.invNoCategories || 'No categories defined') : null}
      >
        {categories.map(cat => {
          const itemCount = items.filter(i => i.category_id === cat.id).length;
          const parentCat = categories.find(c => c.id === cat.parent_id);
          return (
            <tr key={cat.id} className={theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
              <td className={`px-4 py-3 font-mono text-xs font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>{cat.code}</td>
              <td className={`px-4 py-3 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{cat.name}</td>
              <td className={`px-4 py-3 text-xs max-w-48 truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{cat.description || '—'}</td>
              <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{parentCat?.name || '—'}</td>
              <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                <span className={`px-2 py-0.5 rounded-full text-xs ${itemCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                  {itemCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <Toggle
                  value={cat.is_active !== false}
                  onChange={() => can('categories', 'edit') && handleToggleCategory(cat)}
                  disabled={!can('categories', 'edit')}
                />
              </td>
              <td className="px-4 py-3">
                {can('categories', 'edit') && (
                  <Btn variant="ghost" size="xs" icon={Edit2} onClick={() => { setEditingCategory(cat); setShowCategoryForm(false); }} />
                )}
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );

  const tabContent = {
    overview:   renderOverview,
    items:      renderItems,
    stock:      renderStock,
    orders:     renderOrders,
    suppliers:  renderSuppliers,
    categories: renderCategories,
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b px-6 py-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-end">
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
            {loading ? `${t.loading || 'Loading'}…` : (t.refresh || 'Refresh')}
          </button>
        </div>

        {/* Tabs — the app shell's secondary pane replaces these when present */}
        {!tabsInShell && (
        <div className={`flex items-center gap-1 p-1 rounded-xl mt-4 w-fit ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={14} />{tabLabels[tab.id] || tab.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={`flex items-center justify-center h-48 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
            <RefreshCw size={24} className="animate-spin mr-2" /> {t.loading || 'Loading'}…
          </div>
        ) : tabContent[activeTab]?.()}
      </div>
    </div>
  );
}
