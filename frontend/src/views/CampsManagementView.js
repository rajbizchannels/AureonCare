import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Tent, Plus, MapPin, Calendar, ChevronLeft, AlertTriangle, RefreshCw, Trash2, X,
} from 'lucide-react';

import ThemedSelect from '../components/forms/ThemedSelect';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import CampPlanningPanel from '../components/panels/camps/CampPlanningPanel';
import CampRegistrationDesk from '../components/panels/camps/CampRegistrationDesk';
import CampStationBoard from '../components/panels/camps/CampStationBoard';
import CampDashboardPanel from '../components/panels/camps/CampDashboardPanel';

/**
 * CampsManagementView — medical camps.
 *
 * A camp moves draft → published → in_progress → closed → archived, and the server
 * refuses a move it is not ready for while naming every outstanding requirement at once.
 * This view shows those requirements before the button is pressed, rather than letting the
 * organiser discover them one failed click at a time.
 */

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-800',
  published: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-green-100 text-green-800',
  closed: 'bg-purple-100 text-purple-800',
  archived: 'bg-amber-100 text-amber-800',
};

const CampsManagementView = ({ theme, t = {}, api, user, addNotification, activeTab, onTabChange }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-blue-500 ${
    dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const [list, setList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gated, setGated] = useState(null); // plan refusal message, if any
  const [selected, setSelected] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [tab, setTab] = useState(activeTab || 'plan');
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const EMPTY = {
    name: '', description: '', locationId: '', startsAt: '', endsAt: '',
    sponsorName: '', fundingSource: 'self_funded', isFree: true, budget: '', currency: '',
    capacity: '',
  };
  const [form, setForm] = useState(EMPTY);

  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api.getCamps());
      setGated(null);
    } catch (err) {
      // The plan gate answers with an upgrade message; show it rather than a dead screen.
      setGated(err.message || 'Camps are not available on this plan');
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getLocations().then(setLocations).catch(() => {});
  }, [api]);

  const refreshSelected = useCallback(async () => {
    if (!selected) return;
    try {
      const fresh = await api.getCamp(selected.id);
      setSelected(fresh);
      setReadiness(await api.getCampReadiness(fresh.id).catch(() => null));
    } catch (err) {
      notify(err.message || 'Failed to refresh camp', 'error');
    }
  }, [api, selected, notify]);

  const openCamp = async (camp) => {
    setSelected(camp);
    setTab('plan');
    if (onTabChange) onTabChange('plan');
    setReadiness(await api.getCampReadiness(camp.id).catch(() => null));
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      const camp = await api.createCamp({
        name: form.name.trim(),
        description: form.description || undefined,
        locationId: form.locationId || undefined,
        startsAt: form.startsAt, endsAt: form.endsAt,
        sponsorName: form.sponsorName || undefined,
        fundingSource: form.fundingSource,
        isFree: form.isFree,
        budget: form.budget === '' ? undefined : Number(form.budget),
        currency: form.currency || undefined,
        capacity: form.capacity === '' ? undefined : Number(form.capacity),
      });
      notify(t.campCreated || 'Camp created', 'success');
      setShowForm(false);
      setForm(EMPTY);
      await load();
      await openCamp(camp);
    } catch (err) {
      notify(err.message || 'Failed to create camp', 'error');
    }
  };

  const changeStatus = async (to) => {
    try {
      const updated = await api.setCampStatus(selected.id, to);
      notify((t.campStatusChanged || 'Camp is now {status}').replace('{status}', updated.status), 'success');
      setSelected(updated);
      setReadiness(await api.getCampReadiness(updated.id).catch(() => null));
      await load();
    } catch (err) {
      // `blockers` is the useful part — show each outstanding requirement, not just the
      // first sentence.
      if (err.blockers && err.blockers.length) {
        notify(err.blockers.map((b) => b.message).join(' '), 'error');
        setReadiness({ to, ready: false, blockers: err.blockers, status: selected.status });
      } else {
        notify(err.message || 'Failed to change status', 'error');
      }
    }
  };

  const remove = (camp) => setConfirm({
    title: t.campDelete || 'Delete camp',
    message: (t.campDeleteConfirm || 'Delete "{name}"? Only an untouched draft can be deleted.')
      .replace('{name}', camp.name),
    confirmText: t.delete || 'Delete',
    onConfirm: async () => {
      try {
        await api.deleteCamp(camp.id);
        notify(t.campDeleted || 'Camp deleted', 'success');
        setSelected(null);
        await load();
      } catch (err) {
        notify(err.message || 'Failed to delete camp', 'error');
      }
    },
  });

  const statusChip = (status) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
      {(t[`campStatus_${status}`]) || status.replace('_', ' ')}
    </span>
  );

  if (gated) {
    return (
      <div className={`p-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
        <div className={`max-w-xl p-6 rounded-lg shadow ${card}`}>
          <h3 className="font-semibold flex items-center gap-2">
            <Tent className="w-5 h-5" />{t.camps || 'Medical Camps'}
          </h3>
          <p className={`mt-2 text-sm ${sub}`}>{gated}</p>
        </div>
      </div>
    );
  }

  // ── camp detail ──
  if (selected) {
    const tabs = [
      ['plan', t.campTabPlan || 'Plan'],
      ['desk', t.campTabDesk || 'Registration desk'],
      ['board', t.campTabBoard || 'Station board'],
      ['report', t.campTabReport || 'Outcomes'],
    ];
    const nextStates = (readiness && readiness.allowed) || [];

    return (
      <div className={`p-4 sm:p-6 space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button onClick={() => { setSelected(null); load(); }}
              className={`text-sm flex items-center gap-1 ${sub} hover:underline`}>
              <ChevronLeft className="w-4 h-4" />{t.campAllCamps || 'All camps'}
            </button>
            <h3 className="text-lg font-semibold mt-1 flex items-center gap-2">
              {selected.name} {statusChip(selected.status)}
            </h3>
            <p className={`text-sm mt-1 ${sub}`}>
              {[selected.locationName, selected.startsAt && new Date(selected.startsAt).toLocaleString()]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={refreshSelected} className={`p-2 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <RefreshCw className="w-4 h-4" />
            </button>
            {nextStates.map((s) => (
              <button key={s} onClick={() => changeStatus(s)}
                className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
                {(t[`campMoveTo_${s}`]) || (t.campMoveTo || 'Move to {status}').replace('{status}', s.replace('_', ' '))}
              </button>
            ))}
            {selected.status === 'draft' && user && user.role === 'admin' && (
              <button onClick={() => remove(selected)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50" title={t.delete || 'Delete'}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {readiness && !readiness.ready && (readiness.blockers || []).length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {(t.campBeforeNext || 'Before this camp can move to {status}:')
                .replace('{status}', (readiness.to || '').replace('_', ' '))}
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {readiness.blockers.map((b) => <li key={b.code}>{b.message}</li>)}
            </ul>
          </div>
        )}

        <div className={`flex gap-1 border-b ${dark ? 'border-gray-700' : 'border-gray-200'} overflow-x-auto`}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); if (onTabChange) onTabChange(id); }}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 ${
                tab === id ? 'border-blue-500 font-medium' : `border-transparent ${sub}`}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'plan' && (
          <CampPlanningPanel theme={theme} t={t} api={api} camp={selected}
            addNotification={addNotification} onChanged={refreshSelected} />
        )}
        {tab === 'desk' && (
          <CampRegistrationDesk theme={theme} t={t} api={api} camp={selected}
            addNotification={addNotification} />
        )}
        {tab === 'board' && (
          <CampStationBoard theme={theme} t={t} api={api} camp={selected}
            addNotification={addNotification} />
        )}
        {tab === 'report' && (
          <CampDashboardPanel theme={theme} t={t} api={api} camp={selected}
            user={user} addNotification={addNotification} />
        )}

        <ConfirmationModal theme={theme} isOpen={!!confirm} title={confirm?.title}
          message={confirm?.message} confirmText={confirm?.confirmText} type="warning"
          cancelText={t.cancel || 'Cancel'} onClose={() => setConfirm(null)}
          onConfirm={async () => { const a = confirm?.onConfirm; setConfirm(null); if (a) await a(); }} />
      </div>
    );
  }

  // ── camp list ──
  return (
    <div className={`p-4 sm:p-6 space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tent className="w-5 h-5" />{t.camps || 'Medical Camps'}
          </h3>
          <p className={`text-sm mt-1 ${sub}`}>
            {t.campsDescription || 'Off-site screening drives and health camps, run as a station pipeline.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{t.refresh || 'Refresh'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />{t.campNew || 'New camp'}
          </button>
        </div>
      </div>

      <div className={`rounded-lg shadow divide-y ${card} ${dark ? 'divide-gray-700' : 'divide-gray-200'}`}>
        {list.length === 0 && <p className={`p-6 text-sm ${sub}`}>{t.campsNone || 'No camps yet.'}</p>}
        {list.map((c) => (
          <button key={c.id} onClick={() => openCamp(c)}
            className={`w-full text-left p-4 flex items-start justify-between gap-4 ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
            <div className="min-w-0">
              <p className="font-medium flex items-center gap-2">{c.name} {statusChip(c.status)}</p>
              <p className={`text-xs mt-1 ${sub} flex items-center gap-3 flex-wrap`}>
                {c.locationName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.locationName}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{new Date(c.startsAt).toLocaleDateString()}
                </span>
                <span>{(t.campAttendeeCount || '{n} attendees').replace('{n}', c.registrationCount ?? 0)}</span>
                <span>{(t.campStaffCount || '{n} staff').replace('{n}', c.staffCount ?? 0)}</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {showForm && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dark ? 'bg-black/50' : 'bg-black/30'}`}>
          <form onSubmit={create} className={`w-full max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto ${card}`}>
            <div className={`flex items-center justify-between p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className="font-semibold">{t.campNew || 'New camp'}</h4>
              <button type="button" onClick={() => setShowForm(false)} className="p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={`block text-xs mb-1 ${sub}`}>{t.name || 'Name'} *</label>
                <input className={inputCls} required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campVenue || 'Venue'}</label>
                <ThemedSelect theme={theme} value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  <option value="">{t.campChooseLater || 'Choose later'}</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campCapacity || 'Capacity'}</label>
                <input className={inputCls} type="number" min="1" value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campStartsAt || 'Starts'} *</label>
                <input className={inputCls} type="datetime-local" required value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campEndsAt || 'Ends'} *</label>
                <input className={inputCls} type="datetime-local" required value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campSponsor || 'Sponsor'}</label>
                <input className={inputCls} value={form.sponsorName}
                  onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campFunding || 'Funding'}</label>
                <ThemedSelect theme={theme} value={form.fundingSource}
                  onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}>
                  {['self_funded', 'sponsored', 'government', 'ngo', 'csr'].map((f) => (
                    <option key={f} value={f}>{(t[`campFunding_${f}`]) || f.replace('_', ' ')}</option>
                  ))}
                </ThemedSelect>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.campBudget || 'Budget'}</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.currency || 'Currency'}</label>
                <input className={inputCls} maxLength={3} value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isFree}
                  onChange={(e) => setForm({ ...form, isFree: e.target.checked })} />
                {t.campIsFree || 'Free for attendees'}
              </label>
              <div className="sm:col-span-2">
                <label className={`block text-xs mb-1 ${sub}`}>{t.description || 'Description'}</label>
                <textarea className={inputCls} rows={2} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className={`flex justify-end gap-2 p-4 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button type="button" onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-lg text-sm ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                {t.cancel || 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
                {t.create || 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmationModal theme={theme} isOpen={!!confirm} title={confirm?.title}
        message={confirm?.message} confirmText={confirm?.confirmText} type="warning"
        cancelText={t.cancel || 'Cancel'} onClose={() => setConfirm(null)}
        onConfirm={async () => { const a = confirm?.onConfirm; setConfirm(null); if (a) await a(); }} />
    </div>
  );
};

CampsManagementView.propTypes = {
  theme: PropTypes.string,
  t: PropTypes.object,
  api: PropTypes.object.isRequired,
  user: PropTypes.object,
  addNotification: PropTypes.func,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
};

export default CampsManagementView;
