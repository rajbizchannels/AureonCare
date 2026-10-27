import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Users, Stethoscope, Package, ListOrdered, AlertTriangle, Check, RefreshCw,
} from 'lucide-react';

import ThemedSelect from '../../forms/ThemedSelect';

/**
 * CampPlanningPanel — the four things a camp needs before it can open:
 * services, staff, stations, supplies.
 *
 * The staffing section is the one with teeth: rostering someone who already has clinic
 * work inside the camp window is refused, and the clashes are listed so the planner can
 * see what to move. `force` is offered only after that refusal.
 */
const CampPlanningPanel = ({ theme, t = {}, api, camp, addNotification, onChanged }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';
  const divide = dark ? 'divide-gray-700' : 'divide-gray-200';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-blue-500 ${
    dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stations, setStations] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newService, setNewService] = useState({ offeringId: '', label: '', price: '' });
  const [newStaff, setNewStaff] = useState({ userId: '', campRole: 'clinician' });
  const [staffConflicts, setStaffConflicts] = useState(null);
  const [newStation, setNewStation] = useState({ name: '', stepOrder: '', isClinical: true });
  const [newStock, setNewStock] = useState({ itemId: '', qtyIssued: '' });
  const [reconciling, setReconciling] = useState({}); // allocationId -> { consumed, returned }

  const frozen = camp.status === 'closed' || camp.status === 'archived';
  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st, sta, al] = await Promise.all([
        api.getCampServices(camp.id),
        api.getCampStaff(camp.id),
        api.getCampStations(camp.id),
        api.getCampAllocations(camp.id),
      ]);
      setServices(s); setStaff(st); setStations(sta); setAllocations(al);
    } catch (err) {
      notify(err.message || 'Failed to load camp plan', 'error');
    } finally { setLoading(false); }
  }, [api, camp.id, notify]);

  useEffect(() => { load(); }, [load]);

  // Reference data. Each is optional — a camp can be planned with a free-text service and
  // no stock — so one failing lookup must not blank the whole panel.
  useEffect(() => {
    api.getOfferings().then((o) => setOfferings(Array.isArray(o) ? o : (o.offerings || []))).catch(() => {});
    api.getUsers().then((u) => setUsers(Array.isArray(u) ? u : (u.users || []))).catch(() => {});
    api.getInventoryItems().then((i) => setItems(Array.isArray(i) ? i : (i.items || []))).catch(() => {});
  }, [api]);

  const after = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) notify(okMsg, 'success');
      await load();
      if (onChanged) onChanged();
      return true;
    } catch (err) {
      notify(err.message || 'Action failed', 'error');
      return false;
    }
  };

  const addService = () => after(async () => {
    await api.addCampService(camp.id, {
      offeringId: newService.offeringId || undefined,
      label: newService.offeringId ? undefined : (newService.label || undefined),
      price: newService.price === '' ? undefined : Number(newService.price),
    });
    setNewService({ offeringId: '', label: '', price: '' });
  }, t.campServiceAdded || 'Service added');

  const checkConflicts = async (userId) => {
    setStaffConflicts(null);
    if (!userId) return;
    try {
      const out = await api.getCampStaffConflicts(camp.id, userId);
      setStaffConflicts(out.count > 0 ? out.conflicts : null);
    } catch { /* advisory only */ }
  };

  const addStaff = (force = false) => after(async () => {
    await api.addCampStaff(camp.id, { ...newStaff, force });
    setNewStaff({ userId: '', campRole: 'clinician' });
    setStaffConflicts(null);
  }, t.campStaffRostered || 'Rostered');

  const addStation = () => after(async () => {
    await api.addCampStation(camp.id, {
      name: newStation.name,
      stepOrder: newStation.stepOrder === '' ? stations.length + 1 : Number(newStation.stepOrder),
      isClinical: newStation.isClinical,
    });
    setNewStation({ name: '', stepOrder: '', isClinical: true });
  }, t.campStationAdded || 'Station added');

  const issueStock = () => after(async () => {
    await api.issueCampStock(camp.id, { itemId: newStock.itemId, qtyIssued: Number(newStock.qtyIssued) });
    setNewStock({ itemId: '', qtyIssued: '' });
  }, t.campStockIssued || 'Stock issued');

  const reconcile = (alloc) => after(async () => {
    const r = reconciling[alloc.id] || {};
    await api.reconcileCampStock(alloc.id, {
      qtyConsumed: Number(r.consumed ?? 0),
      qtyReturned: Number(r.returned ?? 0),
    });
    setReconciling((prev) => ({ ...prev, [alloc.id]: undefined }));
  }, t.campStockReconciled || 'Stock reconciled');

  const Section = ({ icon: Icon, title, hint, children }) => (
    <div className={`rounded-lg shadow ${card}`}>
      <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h4 className="font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4" />{title}
        </h4>
        {hint && <p className={`text-xs mt-1 ${sub}`}>{hint}</p>}
      </div>
      {children}
    </div>
  );

  return (
    <div className={`space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex justify-end">
        <button onClick={load} disabled={loading}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{t.refresh || 'Refresh'}
        </button>
      </div>

      {/* ── services ── */}
      <Section icon={Stethoscope} title={t.campServices || 'Services offered'}
        hint={camp.isFree ? (t.campFreeHint || 'This camp is free, so its services cannot carry a price.') : null}>
        <div className={`divide-y ${divide}`}>
          {services.length === 0 && <p className={`p-4 text-sm ${sub}`}>{t.campNoServices || 'No services yet.'}</p>}
          {services.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3">
              <span className="text-sm">
                {s.offeringName || s.label}
                {!s.isFree && s.price != null && <span className={`ml-2 text-xs ${sub}`}>{s.price}</span>}
              </span>
              {!frozen && (
                <button onClick={() => after(() => api.removeCampService(s.id))}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50" title={t.remove || 'Remove'}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!frozen && (
          <div className={`p-4 border-t grid grid-cols-1 sm:grid-cols-4 gap-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <ThemedSelect theme={theme} value={newService.offeringId}
              onChange={(e) => setNewService({ ...newService, offeringId: e.target.value })}>
              <option value="">{t.campPickOffering || 'From the catalogue…'}</option>
              {offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </ThemedSelect>
            <input className={inputCls} placeholder={t.campOrFreeText || 'or a one-off service'}
              value={newService.label} disabled={Boolean(newService.offeringId)}
              onChange={(e) => setNewService({ ...newService, label: e.target.value })} />
            <input className={inputCls} type="number" min="0" step="0.01"
              placeholder={camp.isFree ? (t.free || 'Free') : (t.price || 'Price')}
              value={newService.price} disabled={camp.isFree}
              onChange={(e) => setNewService({ ...newService, price: e.target.value })} />
            <button onClick={addService} disabled={!newService.offeringId && !newService.label}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />{t.add || 'Add'}
            </button>
          </div>
        )}
      </Section>

      {/* ── staff ── */}
      <Section icon={Users} title={t.campStaff || 'Staff on duty'}
        hint={t.campStaffHint || 'A camp takes people away from the practice, so clinic appointments inside the camp window are flagged.'}>
        <div className={`divide-y ${divide}`}>
          {staff.length === 0 && <p className={`p-4 text-sm ${sub}`}>{t.campNoStaff || 'Nobody rostered yet.'}</p>}
          {staff.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3">
              <span className="text-sm">
                {[s.firstName, s.lastName].filter(Boolean).join(' ') || s.email}
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>{s.campRole}</span>
              </span>
              {!frozen && (
                <button onClick={() => after(() => api.removeCampStaff(s.id))}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50" title={t.remove || 'Remove'}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!frozen && (
          <div className={`p-4 border-t space-y-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <ThemedSelect theme={theme} value={newStaff.userId}
                onChange={(e) => { setNewStaff({ ...newStaff, userId: e.target.value }); checkConflicts(e.target.value); }}>
                <option value="">{t.campPickStaff || 'Choose a team member…'}</option>
                {users.filter((u) => u.role !== 'patient').map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || u.email}
                  </option>
                ))}
              </ThemedSelect>
              <ThemedSelect theme={theme} value={newStaff.campRole}
                onChange={(e) => setNewStaff({ ...newStaff, campRole: e.target.value })}>
                {['lead', 'registrar', 'clinician', 'nurse', 'lab', 'pharmacy', 'volunteer'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </ThemedSelect>
              <button onClick={() => addStaff(false)} disabled={!newStaff.userId}
                className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />{t.campRoster || 'Roster'}
              </button>
            </div>

            {staffConflicts && (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm space-y-2">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {(t.campConflictWarning || '{n} clinic appointment(s) fall inside this camp.').replace('{n}', staffConflicts.length)}
                </p>
                <ul className="text-xs list-disc pl-5">
                  {staffConflicts.slice(0, 5).map((c) => (
                    <li key={c.id}>{new Date(c.startTime).toLocaleString()} — {c.locationName}</li>
                  ))}
                </ul>
                <button onClick={() => addStaff(true)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-amber-600 hover:bg-amber-700">
                  {t.campRosterAnyway || 'Roster anyway'}
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── stations ── */}
      <Section icon={ListOrdered} title={t.campStations || 'Station pipeline'}
        hint={t.campStationsHint || 'Attendees walk through these in order. A clinical station cannot be entered before consent is recorded.'}>
        <div className={`divide-y ${divide}`}>
          {stations.length === 0 && <p className={`p-4 text-sm ${sub}`}>{t.campNoStations || 'No stations yet.'}</p>}
          {stations.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className={`mr-2 text-xs ${sub}`}>#{s.stepOrder}</span>
                {s.name}
                {s.isClinical
                  ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">{t.clinical || 'clinical'}</span>
                  : <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>{t.nonClinical || 'non-clinical'}</span>}
                {s.isActive === false && <span className="ml-2 text-xs text-amber-600">{t.inactive || 'inactive'}</span>}
              </span>
              {!frozen && (
                <button onClick={() => after(() => api.removeCampStation(s.id))}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50" title={t.remove || 'Remove'}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!frozen && (
          <div className={`p-4 border-t grid grid-cols-1 sm:grid-cols-4 gap-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <input className={inputCls} placeholder={t.campStationName || 'Station name'} value={newStation.name}
              onChange={(e) => setNewStation({ ...newStation, name: e.target.value })} />
            <input className={inputCls} type="number" min="0" placeholder={t.campStepOrder || 'Step'}
              value={newStation.stepOrder}
              onChange={(e) => setNewStation({ ...newStation, stepOrder: e.target.value })} />
            <label className={`flex items-center gap-2 text-sm ${sub}`}>
              <input type="checkbox" checked={newStation.isClinical}
                onChange={(e) => setNewStation({ ...newStation, isClinical: e.target.checked })} />
              {t.clinical || 'Clinical'}
            </label>
            <button onClick={addStation} disabled={!newStation.name.trim()}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />{t.add || 'Add'}
            </button>
          </div>
        )}
      </Section>

      {/* ── supplies ── */}
      <Section icon={Package} title={t.campSupplies || 'Supplies taken to site'}
        hint={t.campSuppliesHint || 'Issuing stock moves it out of the store. Every allocation must be reconciled before the camp can close.'}>
        <div className={`divide-y ${divide}`}>
          {allocations.length === 0 && <p className={`p-4 text-sm ${sub}`}>{t.campNoStock || 'No stock issued.'}</p>}
          {allocations.map((a) => {
            const r = reconciling[a.id];
            const done = Boolean(a.reconciledAt);
            return (
              <div key={a.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {a.itemName}
                    <span className={`ml-2 text-xs ${sub}`}>
                      {(t.campIssuedQty || 'issued {q} {u}')
                        .replace('{q}', a.qtyIssued).replace('{u}', a.unitOfMeasure || '')}
                    </span>
                  </span>
                  {done
                    ? <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />{t.campReconciled || 'reconciled'}</span>
                    : <span className="text-xs text-amber-600">{(t.campUnaccounted || '{q} unaccounted').replace('{q}', a.qtyUnaccounted)}</span>}
                </div>
                {!done && !frozen && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input className={inputCls} type="number" min="0" step="0.001"
                      placeholder={t.campConsumed || 'Used'} value={r?.consumed ?? ''}
                      onChange={(e) => setReconciling({ ...reconciling, [a.id]: { ...r, consumed: e.target.value } })} />
                    <input className={inputCls} type="number" min="0" step="0.001"
                      placeholder={t.campReturned || 'Returned'} value={r?.returned ?? ''}
                      onChange={(e) => setReconciling({ ...reconciling, [a.id]: { ...r, returned: e.target.value } })} />
                    <button onClick={() => reconcile(a)}
                      className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
                      {t.campReconcile || 'Reconcile'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!frozen && (
          <div className={`p-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <ThemedSelect theme={theme} value={newStock.itemId}
              onChange={(e) => setNewStock({ ...newStock, itemId: e.target.value })}>
              <option value="">{t.campPickItem || 'Choose an item…'}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.quantityOnHand ?? i.quantity_on_hand})</option>
              ))}
            </ThemedSelect>
            <input className={inputCls} type="number" min="0" step="0.001"
              placeholder={t.campQtyToIssue || 'Quantity'} value={newStock.qtyIssued}
              onChange={(e) => setNewStock({ ...newStock, qtyIssued: e.target.value })} />
            <button onClick={issueStock} disabled={!newStock.itemId || !newStock.qtyIssued}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />{t.campIssue || 'Issue'}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
};

export default CampPlanningPanel;
