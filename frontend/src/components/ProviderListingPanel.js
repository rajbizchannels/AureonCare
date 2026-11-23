import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Loader2, Upload } from 'lucide-react';
import { getTranslations } from '../config/translations';
import { useOptionalApp } from '../context/AppContext';
import { checkUpload, guidelineText, noteFor } from '../utils/uploadGuidelines';

const useT = () => getTranslations(useOptionalApp()?.language || 'en');

/**
 * My profile → "Practice profile listing": a provider's own consent to appear on the
 * practice's public profile page (and, if the practice makes it searchable, in the
 * directory). Only the provider can give or withdraw it; they choose which details show.
 * Renders nothing for staff who are not providers.
 */
const ProviderListingPanel = ({ theme = 'light', api, addNotification }) => {
  const t = useT();
  const lang = useOptionalApp()?.language || 'en';
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.getMyListing();
      setData(d);
      if (d.isProvider) {
        const c = d.consent;
        setForm({
          consented: Boolean(c.consented), show_photo: Boolean(c.show_photo), show_bio: Boolean(c.show_bio),
          show_languages: Boolean(c.show_languages), show_specialties: c.show_specialties !== false,
          bio: c.bio || '', languages: (c.languages || []).join(', '), specialty_codes: c.specialty_codes || [], photo_id: c.photo_id || null,
        });
      }
    } catch (e) {
      setError(e.message);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (!data || !data.isProvider || !form) return null;

  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const text = dark ? 'text-slate-200' : 'text-gray-800';
  const input = `w-full px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'} disabled:opacity-60`;
  const box = (k, labelText) => (
    <label className={`flex items-center gap-2 text-sm ${text}`}>
      <input type="checkbox" checked={form[k]} disabled={!form.consented} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} />
      {labelText}
    </label>
  );

  const save = async (override = {}) => {
    setBusy(true); setError('');
    try {
      const next = { ...form, ...override };
      await api.saveMyListing({ ...next, languages: next.languages.split(',').map((s) => s.trim()).filter(Boolean) });
      addNotification?.('success', next.consented ? (t.providerListingSaved || 'Your listing preferences are saved') : (t.providerListingRemoved || 'You are no longer listed on the practice profile'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    const verdict = await checkUpload('provider', file, lang);
    if (verdict.error) { setError(verdict.error); return; }
    if (verdict.warning) addNotification?.('alert', verdict.warning);
    setBusy(true); setError('');
    try {
      const ph = await api.uploadProfilePhoto('provider', file);
      setForm((f) => ({ ...f, photo_id: ph.id, show_photo: true }));
      addNotification?.('success', t.providerListingPhotoUploaded || 'Photo uploaded — it appears once an administrator approves it. Save to keep your choices.');
      await api.getMyListing().then(setData);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const photo = (data.photos || []).find((p) => p.id === form.photo_id);
  const visibilityNote = {
    off: t.providerListingVisibilityOff || 'The practice profile is currently off, so nothing is public yet.',
    link: t.providerListingVisibilityLink || 'The practice profile is link-only: visible to people with its link, not in search.',
    searchable: t.providerListingVisibilitySearchable || 'The practice profile is public and searchable.',
  }[data.practiceVisibility] || '';

  return (
    <div className={`rounded-lg p-4 ${dark ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
      <h4 className={`font-semibold mb-1 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
        <Globe className="w-4 h-4" /> {t.providerListingTitle || 'Practice profile listing'}
      </h4>
      <p className={`text-xs mb-3 ${muted}`}>{visibilityNote}</p>
      {data.needsReconsent && <p className="text-xs mb-3 text-amber-500">{t.providerListingReconsent || 'The listing terms have changed — please review and save to keep your listing.'}</p>}

      <label className={`flex items-start gap-2 text-sm ${text}`}>
        <input type="checkbox" className="mt-0.5" checked={form.consented}
               onChange={(e) => setForm((f) => ({ ...f, consented: e.target.checked }))} />
        <span>{data.consentText}</span>
      </label>

      <fieldset className="mt-3 space-y-2" disabled={!form.consented} aria-label={t.providerListingDetailsToShow || 'Details to show'}>
        <div className={`text-xs ${muted}`}>{t.providerListingAlwaysShown || 'Your name and title always show when you are listed. Also show:'}</div>
        {box('show_specialties', t.providerListingSpecialties || 'Specialties')}
        {form.consented && form.show_specialties && (
          <div className="flex flex-wrap gap-1.5 pl-6">
            {(data.specialties || []).slice(0, 60).map((s) => {
              const on = form.specialty_codes.includes(s.code);
              return (
                <button key={s.code} type="button" aria-pressed={on}
                        onClick={() => setForm((f) => ({ ...f, specialty_codes: on ? f.specialty_codes.filter((c) => c !== s.code) : [...f.specialty_codes, s.code] }))}
                        className={`px-2 py-0.5 rounded-full text-xs border ${on ? 'bg-teal-600 border-teal-600 text-white' : dark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
        {box('show_bio', t.providerListingShortBio || 'A short bio')}
        {form.consented && form.show_bio && (
          <textarea rows={3} maxLength={1500} className={input} value={form.bio} aria-label={t.providerListingBio || 'Bio'}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder={t.providerListingBioPlaceholder || 'Your background and interests, in a few sentences.'} />
        )}
        {box('show_languages', t.providerListingLanguagesSpoken || 'Languages I speak')}
        {form.consented && form.show_languages && (
          <input className={input} value={form.languages} aria-label={t.providerListingLanguages || 'Languages'} placeholder={t.providerListingLanguagesPlaceholder || 'English, Spanish'}
                 onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
        )}
        {box('show_photo', t.providerListingMyPhoto || 'My photo')}
        {form.consented && form.show_photo && (
          <div className="flex items-center gap-2 pl-6 text-xs">
            {photo ? <span className={muted}>{photo.status === 'approved' ? (t.providerListingPhotoApproved || 'Photo approved') : photo.status === 'pending' ? (t.providerListingPhotoPending || 'Photo waiting for approval') : (t.providerListingPhotoRejected || 'Photo not approved')}</span>
              : <span className={muted}>{t.providerListingNoPhoto || 'No photo yet.'}</span>}
            <label className={`inline-flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
              <Upload className="w-3.5 h-3.5" /> {t.providerListingUpload || 'Upload'}
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => { uploadPhoto(e.target.files[0]); e.target.value = ''; }} />
            </label>
          </div>
        )}
        {form.consented && form.show_photo && (
          <p className={`pl-6 mt-1 text-xs ${muted}`}>{guidelineText('provider', lang)}<br />{noteFor('provider', lang)}</p>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-500 mt-2">{error}</p>}
      <div className="flex justify-end mt-3">
        <button type="button" onClick={() => save()} disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t.providerListingSave || 'Save listing'}
        </button>
      </div>
    </div>
  );
};

export default ProviderListingPanel;
