import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Star,
  RefreshCw,
  X,
  Power,
  CheckCircle,
} from 'lucide-react';

import apiService from '../../api/apiService';
import ConfirmationModal from '../modals/ConfirmationModal';
import ThemedSelect from '../forms/ThemedSelect';

/**
 * LocationsTab — manage the physical sites a practice operates from.
 *
 * A tenant always has exactly one primary site; it is seeded at provisioning and the
 * server refuses to delete or deactivate it. Additional sites are branches, camp venues,
 * mobile units or partner premises. Appointments, stock movements, provider availability
 * and working hours can each be attributed to a site; NULL there means the primary one.
 */

const EMPTY_FORM = {
  name: '',
  locationType: 'clinic',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  phone: '',
  email: '',
  timezone: '',
  notes: '',
  isActive: true,
};

// `api` is passed down by AdminPanelView (the same apiService default export); the import
// is the fallback so the component also works when mounted directly.
const LocationsTab = ({ theme, t = {}, addNotification, api = apiService }) => {
  const dark = theme === 'dark';

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // location being edited, or null for create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { title, message, confirmText, onConfirm }

  const notify = useCallback((message, type) => {
    if (addNotification) addNotification(message, type);
  }, [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getLocations({ includeInactive: true });
      setLocations(rows);
    } catch (err) {
      notify(err.message || 'Failed to load locations', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, notify]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };

  const openEdit = (loc) => {
    setEditing(loc);
    setForm({
      name: loc.name || '',
      locationType: loc.locationType || 'clinic',
      address: loc.address || '',
      city: loc.city || '',
      state: loc.state || '',
      country: loc.country || '',
      postalCode: loc.postalCode || '',
      phone: loc.phone || '',
      email: loc.email || '',
      timezone: loc.timezone || '',
      notes: loc.notes || '',
      isActive: loc.isActive !== false,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { notify(t.locationNameRequired || 'Site name is required', 'error'); return; }
    setSaving(true);
    try {
      // Send blank optional fields as null so COALESCE on the server does not treat an
      // emptied field as "leave unchanged".
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v])
      );
      payload.name = form.name.trim();

      if (editing) {
        await api.updateLocation(editing.id, payload);
        notify(t.locationUpdated || 'Site updated', 'success');
      } else {
        await api.createLocation(payload);
        notify(t.locationCreated || 'Site added', 'success');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      notify(err.message || 'Failed to save site', 'error');
    } finally {
      setSaving(false);
    }
  };

  const makePrimary = (loc) => setConfirm({
    title: t.makePrimaryLocation || 'Make primary site',
    message: (t.makePrimaryLocationConfirm
      || 'Make "{name}" the primary site? Anything not explicitly assigned to a site will be treated as belonging to it.')
      .replace('{name}', loc.name),
    confirmText: t.makePrimaryLocation || 'Make primary',
    onConfirm: async () => {
      try {
        await api.makeLocationPrimary(loc.id);
        notify(t.primaryLocationChanged || 'Primary site changed', 'success');
        await load();
      } catch (err) {
        notify(err.message || 'Failed to set primary site', 'error');
      }
    },
  });

  const toggleActive = (loc) => setConfirm({
    title: loc.isActive
      ? (t.deactivateLocation || 'Deactivate site')
      : (t.activateLocation || 'Activate site'),
    message: loc.isActive
      ? (t.deactivateLocationConfirm || 'Deactivate "{name}"? It stays on existing records but can no longer be chosen.').replace('{name}', loc.name)
      : (t.activateLocationConfirm || 'Activate "{name}"?').replace('{name}', loc.name),
    confirmText: loc.isActive ? (t.deactivate || 'Deactivate') : (t.activate || 'Activate'),
    onConfirm: async () => {
      try {
        await api.updateLocation(loc.id, { isActive: !loc.isActive });
        notify(t.locationUpdated || 'Site updated', 'success');
        await load();
      } catch (err) {
        notify(err.message || 'Failed to update site', 'error');
      }
    },
  });

  // The server refuses a delete that would detach history and says what references it, so
  // the failure path here is informative rather than generic.
  const remove = (loc) => setConfirm({
    title: t.deleteLocation || 'Delete site',
    message: (t.deleteLocationConfirm || 'Permanently delete "{name}"? This cannot be undone.')
      .replace('{name}', loc.name),
    confirmText: t.delete || 'Delete',
    onConfirm: async () => {
      try {
        await api.deleteLocation(loc.id);
        notify(t.locationDeleted || 'Site deleted', 'success');
        await load();
      } catch (err) {
        notify(err.message || 'Failed to delete site', 'error');
      }
    },
  });

  const typeLabel = (type) => ({
    clinic: t.locationTypeClinic || 'Clinic',
    camp: t.locationTypeCamp || 'Camp venue',
    mobile: t.locationTypeMobile || 'Mobile unit',
    partner: t.locationTypePartner || 'Partner premises',
  }[type] || type);

  const visible = showInactive ? locations : locations.filter((l) => l.isActive !== false);

  const card = dark ? 'bg-gray-800' : 'bg-white';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-blue-500 ${
    dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const field = (key, label, extra = {}) => (
    <div>
      <label className={`block text-xs mb-1 ${sub}`}>{label}</label>
      <input
        type={extra.type || 'text'}
        value={form[key] ?? ''}
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={inputCls}
      />
    </div>
  );

  return (
    <div className={`space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {t.locations || 'Locations'}
          </h3>
          <p className={`text-sm mt-1 ${sub}`}>
            {t.locationsDescription
              || 'Sites this practice operates from. One is the primary site; anything not assigned to a site belongs to it.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
              dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh || 'Refresh'}
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.addLocation || 'Add site'}
          </button>
        </div>
      </div>

      <label className={`flex items-center gap-2 text-sm ${sub}`}>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        {t.showInactiveLocations || 'Show deactivated sites'}
      </label>

      <div className={`rounded-lg shadow divide-y ${card} ${dark ? 'divide-gray-700' : 'divide-gray-200'}`}>
        {visible.length === 0 && (
          <p className={`p-6 text-sm ${sub}`}>{t.noLocations || 'No sites yet.'}</p>
        )}
        {visible.map((loc) => (
          <div key={loc.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{loc.name}</span>
                {loc.isPrimary && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {t.primary || 'Primary'}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {typeLabel(loc.locationType)}
                </span>
                {loc.isActive === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {t.inactive || 'Deactivated'}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ${sub}`}>
                {[loc.address, loc.city, loc.state, loc.postalCode, loc.country]
                  .filter(Boolean).join(', ') || (t.noAddress || 'No address recorded')}
              </p>
              {(loc.phone || loc.email || loc.timezone) && (
                <p className={`text-xs mt-0.5 ${sub}`}>
                  {[loc.phone, loc.email, loc.timezone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!loc.isPrimary && loc.isActive !== false && (
                <button
                  onClick={() => makePrimary(loc)}
                  title={t.makePrimaryLocation || 'Make primary'}
                  className={`p-2 rounded-lg ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => openEdit(loc)}
                title={t.edit || 'Edit'}
                className={`p-2 rounded-lg ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <Edit className="w-4 h-4" />
              </button>
              {!loc.isPrimary && (
                <button
                  onClick={() => toggleActive(loc)}
                  title={loc.isActive ? (t.deactivate || 'Deactivate') : (t.activate || 'Activate')}
                  className={`p-2 rounded-lg ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  {loc.isActive ? <Power className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>
              )}
              {!loc.isPrimary && (
                <button
                  onClick={() => remove(loc)}
                  title={t.delete || 'Delete'}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dark ? 'bg-black/50' : 'bg-black/30'}`}>
          <form
            onSubmit={save}
            className={`w-full max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto ${card}`}
          >
            <div className={`flex items-center justify-between p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className="font-semibold">
                {editing ? (t.editLocation || 'Edit site') : (t.addLocation || 'Add site')}
              </h4>
              <button type="button" onClick={() => setShowForm(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={`block text-xs mb-1 ${sub}`}>{t.name || 'Name'} *</label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t.locationType || 'Type'}</label>
                <ThemedSelect
                  theme={theme}
                  value={form.locationType}
                  onChange={(e) => setForm({ ...form, locationType: e.target.value })}
                >
                  <option value="clinic">{typeLabel('clinic')}</option>
                  <option value="camp">{typeLabel('camp')}</option>
                  <option value="mobile">{typeLabel('mobile')}</option>
                  <option value="partner">{typeLabel('partner')}</option>
                </ThemedSelect>
              </div>

              {field('timezone', t.timezone || 'Timezone', { placeholder: 'Europe/London' })}

              <div className="sm:col-span-2">
                {field('address', t.address || 'Address')}
              </div>

              {field('city', t.city || 'City')}
              {field('state', t.state || 'State / Region')}
              {field('postalCode', t.postalCode || 'Postal code')}
              {field('country', t.country || 'Country (2-letter code)', { maxLength: 2, placeholder: 'GB' })}
              {field('phone', t.phone || 'Phone')}
              {field('email', t.email || 'Email', { type: 'email' })}

              <div className="sm:col-span-2">
                <label className={`block text-xs mb-1 ${sub}`}>{t.notes || 'Notes'}</label>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={`flex justify-end gap-2 p-4 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-lg text-sm ${dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? (t.saving || 'Saving…') : (t.save || 'Save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmationModal
        theme={theme}
        isOpen={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        cancelText={t.cancel || 'Cancel'}
        type="warning"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          if (action) await action();
        }}
      />
    </div>
  );
};

export default LocationsTab;
