import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus, Search, ShieldCheck, ShieldAlert, ArrowRightCircle, RefreshCw, Link2,
} from 'lucide-react';

import ThemedSelect from '../../forms/ThemedSelect';

/**
 * CampRegistrationDesk — the one screen in the product with a hard throughput requirement.
 *
 * Hundreds of walk-ins in a few hours, so: keyboard-only capture, no modal chain, the
 * token visible the instant it is issued, and focus returned to the name field after every
 * save. A registration deliberately needs only a name, a contact number and an age — it is
 * not a patient record, and turning it into one is a separate, explicit act (Promote).
 */
const CampRegistrationDesk = ({ theme, t = {}, api, camp, addNotification }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-blue-500 ${
    dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const EMPTY = { fullName: '', phone: '', ageYears: '', gender: '', city: '', consentGiven: true };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [lastToken, setLastToken] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(null); // { registration, candidates }
  const nameRef = useRef(null);

  const open = camp.status === 'published' || camp.status === 'in_progress';
  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRegistrations(await api.getCampRegistrations(camp.id, { q: query || undefined }));
    } catch (err) {
      notify(err.message || 'Failed to load attendees', 'error');
    } finally { setLoading(false); }
  }, [api, camp.id, query, notify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (nameRef.current) nameRef.current.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    if (!form.ageYears) { notify(t.campAgeRequired || 'Record an age (or a date of birth).', 'error'); return; }
    setSaving(true);
    try {
      const out = await api.registerCampAttendee({
        campId: camp.id,
        fullName: form.fullName.trim(),
        phone: form.phone || undefined,
        ageYears: Number(form.ageYears),
        gender: form.gender || undefined,
        city: form.city || undefined,
        consentGiven: form.consentGiven,
      });
      setLastToken(out.registration.tokenNo);
      // Keep city — a camp serves one place all day — and clear the rest.
      setForm({ ...EMPTY, city: form.city, consentGiven: form.consentGiven });
      if (nameRef.current) nameRef.current.focus();
      await load();
    } catch (err) {
      notify(err.message || 'Failed to register attendee', 'error');
    } finally { setSaving(false); }
  };

  const openPromote = async (r) => {
    try {
      const out = await api.matchCampRegistration(r.id);
      setPromoting({ registration: r, candidates: out.candidates || [] });
    } catch (err) {
      notify(err.message || 'Failed to look for existing records', 'error');
    }
  };

  const doPromote = async (payload) => {
    try {
      const out = await api.promoteCampRegistration(promoting.registration.id, payload);
      notify(
        out.linked
          ? (t.campLinkedExisting || 'Linked to the existing patient record')
          : (out.dateOfBirthEstimated
            ? (t.campPromotedEstimated || 'Patient created — date of birth estimated from the recorded age')
            : (t.campPromoted || 'Patient record created')),
        'success'
      );
      setPromoting(null);
      await load();
    } catch (err) {
      notify(err.message || 'Failed to promote', 'error');
    }
  };

  const consent = async (r) => {
    try {
      await api.recordCampConsent(r.id);
      notify(t.campConsentRecorded || 'Consent recorded', 'success');
      await load();
    } catch (err) {
      notify(err.message || 'Failed to record consent', 'error');
    }
  };

  return (
    <div className={`space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      {!open && (
        <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
          {(t.campDeskClosed || 'This camp is {status}. Attendees can be registered once it is published.')
            .replace('{status}', camp.status)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* capture */}
        <form onSubmit={submit} className={`rounded-lg shadow p-4 space-y-3 ${card}`}>
          <h4 className="font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4" />{t.campRegisterAttendee || 'Register attendee'}
          </h4>

          {lastToken != null && (
            <div className="p-3 rounded-lg bg-green-50 text-green-900 text-center">
              <p className="text-xs">{t.campTokenIssued || 'Token issued'}</p>
              <p className="text-4xl font-bold tabular-nums">{lastToken}</p>
            </div>
          )}

          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t.campFullName || 'Name'} *</label>
            <input ref={nameRef} className={inputCls} required value={form.fullName} disabled={!open}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t.phone || 'Phone'}</label>
              <input className={inputCls} value={form.phone} disabled={!open}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t.campAge || 'Age'} *</label>
              <input className={inputCls} type="number" min="0" max="130" required value={form.ageYears} disabled={!open}
                onChange={(e) => setForm({ ...form, ageYears: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t.gender || 'Gender'}</label>
              <ThemedSelect theme={theme} value={form.gender} disabled={!open}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="female">{t.female || 'Female'}</option>
                <option value="male">{t.male || 'Male'}</option>
                <option value="other">{t.other || 'Other'}</option>
              </ThemedSelect>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t.city || 'City'}</label>
              <input className={inputCls} value={form.city} disabled={!open}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consentGiven} disabled={!open}
              onChange={(e) => setForm({ ...form, consentGiven: e.target.checked })} />
            {t.campConsentTaken || 'Consent taken'}
          </label>
          <p className={`text-xs ${sub}`}>
            {t.campConsentNote || 'Without consent the attendee can still be registered, but no clinical station will accept them.'}
          </p>

          <button type="submit" disabled={saving || !open}
            className="w-full px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {saving ? (t.saving || 'Saving…') : (t.campIssueToken || 'Register and issue token')}
          </button>
        </form>

        {/* list */}
        <div className={`lg:col-span-2 rounded-lg shadow ${card}`}>
          <div className={`p-4 border-b flex items-center gap-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Search className={`w-4 h-4 ${sub}`} />
            <input className={`${inputCls} flex-1`} placeholder={t.campSearchAttendees || 'Search by name, phone or token'}
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <button onClick={load} disabled={loading} className={`p-2 rounded ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className={`divide-y ${dark ? 'divide-gray-700' : 'divide-gray-200'} max-h-[32rem] overflow-y-auto`}>
            {registrations.length === 0 && (
              <p className={`p-4 text-sm ${sub}`}>{t.campNoAttendees || 'Nobody registered yet.'}</p>
            )}
            {registrations.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="tabular-nums text-blue-600">#{r.tokenNo}</span>
                    {r.fullName}
                    {r.consentGivenAt
                      ? <ShieldCheck className="w-4 h-4 text-green-600" title={t.campConsentTaken || 'Consent taken'} />
                      : <ShieldAlert className="w-4 h-4 text-amber-600" title={t.campConsentMissing || 'No consent on record'} />}
                  </p>
                  <p className={`text-xs ${sub}`}>
                    {[r.ageYears != null ? `${r.ageYears}y` : null, r.gender, r.phone, r.mrn]
                      .filter(Boolean).join(' · ')}
                    <span className="ml-2">{r.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!r.consentGivenAt && (
                    <button onClick={() => consent(r)} title={t.campRecordConsent || 'Record consent'}
                      className={`p-2 rounded ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  {!r.patientId && (
                    <button onClick={() => openPromote(r)} title={t.campPromote || 'Create or link patient record'}
                      className={`p-2 rounded ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                      <ArrowRightCircle className="w-4 h-4" />
                    </button>
                  )}
                  {r.patientId && <Link2 className="w-4 h-4 text-green-600" title={t.campPromoted || 'Patient record exists'} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* promotion: match before create, so a duplicate is a choice rather than an accident */}
      {promoting && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dark ? 'bg-black/50' : 'bg-black/30'}`}>
          <div className={`w-full max-w-lg rounded-xl shadow-xl ${card}`}>
            <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className="font-semibold">{t.campPromoteTitle || 'Create a patient record'}</h4>
              <p className={`text-xs mt-1 ${sub}`}>
                #{promoting.registration.tokenNo} · {promoting.registration.fullName}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {promoting.candidates.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs ${sub}`}>
                    {t.campExistingMatches || 'These existing patients may be the same person — link rather than duplicate:'}
                  </p>
                  {promoting.candidates.map((c) => (
                    <button key={c.id} onClick={() => doPromote({ patientId: c.id })}
                      className={`w-full text-left p-2 rounded-lg border text-sm ${dark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}>
                      <span className="font-medium">{c.firstName} {c.lastName}</span>
                      <span className={`ml-2 text-xs ${sub}`}>
                        {c.mrn} · {c.phone || '—'} · {t.campMatchedOn || 'matched on'} {c.matchedOn}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={`pt-2 border-t ${dark ? 'border-gray-700' : 'border-gray-200'} space-y-2`}>
                <label className={`block text-xs ${sub}`}>{t.dateOfBirth || 'Date of birth'}</label>
                <input type="date" className={inputCls} id="camp-promote-dob" />
                <button onClick={() => {
                  const el = document.getElementById('camp-promote-dob');
                  doPromote(el && el.value ? { dateOfBirth: el.value } : { estimateDobFromAge: true });
                }} className="w-full px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
                  {t.campCreateNewPatient || 'Create a new patient record'}
                </button>
                <p className={`text-xs ${sub}`}>
                  {t.campDobEstimateNote || 'Leave the date blank to estimate it from the recorded age — the record will say the date is approximate.'}
                </p>
              </div>
            </div>
            <div className={`p-4 border-t flex justify-end ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button onClick={() => setPromoting(null)}
                className={`px-4 py-2 rounded-lg text-sm ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                {t.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampRegistrationDesk;
