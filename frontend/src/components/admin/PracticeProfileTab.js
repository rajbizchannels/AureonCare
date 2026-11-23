import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Link2, Search, EyeOff, Save, Upload, Check, X, Trash2, RefreshCw, Copy, ExternalLink, Loader2, Lock } from 'lucide-react';
import QrCodeButton from '../common/QrCodeButton';
import { getTranslations } from '../../config/translations';
import { useOptionalApp } from '../../context/AppContext';
import { checkUpload, guidelineText, UPLOAD_GUIDELINES } from '../../utils/uploadGuidelines';

/** Size and format guidance under an upload control. */
const UploadHint = ({ kind, dark }) => (
  <p className={`text-xs mt-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
    {guidelineText(kind)}{UPLOAD_GUIDELINES[kind] && UPLOAD_GUIDELINES[kind].note ? <><br />{UPLOAD_GUIDELINES[kind].note}</> : null}
  </p>
);

const useT = () => getTranslations(useOptionalApp()?.language || 'en');

/**
 * Settings → Practice Profile: the practice's public page (directory Phase 2).
 *
 * Visibility is the admins' choice and defaults to OFF:
 *   Off         — the page does not exist, even by direct link
 *   Link only   — opens by direct link / QR code; not in search, not indexed; optionally
 *                 under an unguessable random address
 *   Searchable  — opens, and will appear in the AureonCare directory search
 *
 * Providers appear only after THEY consent (from their own profile). An admin can hide a
 * consented provider but can never list one.
 */

const getVis = (t) => [
  { id: 'off', label: t.pubProfileModeOff || 'Off', icon: EyeOff, text: t.pubProfileModeOffText || 'No public page. The address shows "not available", even to people who have the link.' },
  { id: 'link', label: t.pubProfileModeLink || 'Link only', icon: Link2, text: t.pubProfileModeLinkText || 'Anyone with the link or QR code can open it. Not listed in search; search engines are told not to index it.' },
  { id: 'searchable', label: t.pubProfileModeSearchable || 'Searchable', icon: Search, text: t.pubProfileModeSearchableText || 'Open to everyone and listed in the AureonCare directory search.' },
];

const useObjectUrl = (api, id) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true; let made = null;
    if (id) api.profilePhotoObjectUrl(id).then((u) => { made = u; if (alive) setUrl(u); }).catch(() => {});
    else setUrl(null);
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [api, id]);
  return url;
};

const Thumb = ({ api, id, className, alt = '' }) => {
  const url = useObjectUrl(api, id);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`${className} bg-slate-500/20`} aria-hidden="true" />;
};

const PracticeProfileTab = ({ theme = 'light', api, addNotification }) => {
  const t = useT();
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyPhoto, setBusyPhoto] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api.getPracticeProfile();
      setData(d);
      const p = d.profile;
      setForm({
        visibility: p.visibility, use_random_link: Boolean(p.use_random_link), slug: p.slug || '',
        display_name: p.display_name || '', about: p.about || '', phone: p.phone || '', email: p.email || '', website: p.website || '',
        specialty_codes: p.specialty_codes || [], location_ids: (p.location_ids || []).map(String),
        cover_photo_id: p.cover_photo_id || null, logo_photo_id: p.logo_photo_id || null,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const canEdit = Boolean(data && data.canEdit);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const save = async (extra = {}) => {
    setSaving(true); setError('');
    try {
      const r = await api.savePracticeProfile({ ...form, ...extra });
      addNotification?.('success', r.publicUrl ? (t.pubProfileSaved || 'Practice profile saved') : (t.pubProfileSavedOff || 'Practice profile saved (the page is off)'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind, file) => {
    if (!file) return;
    // Size and type are checked here first, with the reason, rather than after a round trip.
    const verdict = await checkUpload(kind, file);
    if (verdict.error) { setError(verdict.error); return; }
    if (verdict.warning) addNotification?.('alert', verdict.warning);
    setBusyPhoto(kind); setError('');
    try {
      const ph = await api.uploadProfilePhoto(kind, file);
      if (kind === 'cover') setForm((f) => ({ ...f, cover_photo_id: ph.id }));
      if (kind === 'logo') setForm((f) => ({ ...f, logo_photo_id: ph.id }));
      addNotification?.('success', kind === 'gallery' ? (t.pubProfilePhotoAdded || 'Photo added') : kind === 'cover' ? (t.pubProfileCoverUploaded || 'Cover uploaded — save to publish it') : (t.pubProfileLogoUploaded || 'Logo uploaded — save to publish it'));
      const d = await api.getPracticeProfile(); setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyPhoto('');
    }
  };
  const review = async (id, status) => {
    try { await api.reviewProfilePhoto(id, status); setData(await api.getPracticeProfile()); } catch (e) { setError(e.message); }
  };
  const remove = async (id) => {
    try { await api.deleteProfilePhoto(id); setForm((f) => ({ ...f, cover_photo_id: f.cover_photo_id === id ? null : f.cover_photo_id, logo_photo_id: f.logo_photo_id === id ? null : f.logo_photo_id })); setData(await api.getPracticeProfile()); } catch (e) { setError(e.message); }
  };
  const setHidden = async (id, hidden) => {
    try { await api.setProviderListingHidden(id, hidden); setData(await api.getPracticeProfile()); } catch (e) { setError(e.message); }
  };

  const specialtyName = useMemo(() => new Map((data?.specialties || []).map((s) => [s.code, s.name])), [data]);

  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`;
  const h = `text-base font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`;
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const input = `w-full px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60`;
  const label = `block text-sm font-medium mb-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`;
  const chip = (on) => `px-3 py-1 rounded-full text-sm border transition-colors ${on
    ? 'bg-teal-600 border-teal-600 text-white' : dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`;
  const small = `inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${dark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`;

  if (loading) return <div className={`flex items-center gap-2 ${muted}`}><Loader2 className="w-4 h-4 animate-spin" /> {t.pubProfileLoading || 'Loading practice profile…'}</div>;
  if (!form) return <div className="text-red-500">{error || t.pubProfileLoadFailed || 'Could not load the practice profile.'}</div>;

  const photos = data.photos || [];
  const approved = (kind) => photos.filter((p) => p.kind === kind && p.status === 'approved');
  const pending = photos.filter((p) => p.status === 'pending');
  const publicUrl = data.publicUrl;
  const VIS = getVis(t);
  const KIND_LABELS = {
    provider: t.pubProfileProviderPhoto || 'Provider photo',
    cover: t.pubProfileKindCover || 'cover',
    logo: t.pubProfileKindLogo || 'logo',
    gallery: t.pubProfileKindGallery || 'gallery',
  };
  const [randomBefore, randomAfter] = (t.pubProfileRandomLinkHelp || 'Use an unguessable address (e.g. {address}) so only people you give the link or QR code to can find the page.').split('{address}');
  const PROVIDER_STATUS = {
    listed: t.pubProfileListed || 'Listed',
    hidden: t.pubProfileHiddenByAdmin || 'Hidden by admin',
    notConsented: t.pubProfileNotConsented || 'Not consented',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{t.practiceProfile || 'Practice Profile'}</h2>
        <p className={`text-sm mt-1 ${muted}`}>
          {t.pubProfileIntro || 'A plain public page for your practice: details, specialties, locations, photos, and the providers who agree to be listed. No reviews and no patient information.'}
        </p>
      </div>
      {!canEdit && (
        <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
          <Lock className="w-4 h-4" /> {t.pubProfileAdminsOnly || 'Only practice administrators can change the profile.'}
        </div>
      )}
      {error && <div role="alert" className="text-sm text-red-500">{error}</div>}

      {/* Visibility */}
      <section className={card} aria-labelledby="pp-vis">
        <h3 id="pp-vis" className={h}>{t.pubProfileVisibility || 'Visibility'}</h3>
        <div role="radiogroup" aria-labelledby="pp-vis" className="grid gap-3 sm:grid-cols-3 mt-3">
          {VIS.map((v) => {
            const on = form.visibility === v.id;
            const Icon = v.icon;
            return (
              <button key={v.id} type="button" role="radio" aria-checked={on} disabled={!canEdit}
                      onClick={() => setForm((f) => ({ ...f, visibility: v.id }))}
                      className={`text-left rounded-lg border p-3 transition-colors disabled:cursor-not-allowed ${on
                        ? 'border-teal-500 ring-2 ring-teal-500/40' : dark ? 'border-slate-600 hover:bg-slate-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <div className={`flex items-center gap-2 font-medium ${dark ? 'text-white' : 'text-gray-900'}`}><Icon className="w-4 h-4" />{v.label}</div>
                <p className={`text-xs mt-1 ${muted}`}>{v.text}</p>
              </button>
            );
          })}
        </div>
        {form.visibility === 'link' && (
          <label className={`flex items-start gap-2 mt-4 text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
            <input type="checkbox" className="mt-0.5" checked={form.use_random_link} onChange={set('use_random_link')} disabled={!canEdit} />
            <span>{randomBefore}<code>/p/k3J9xQ2mWb7ZpA</code>{randomAfter}</span>
          </label>
        )}
        <div className={`mt-4 rounded-lg p-3 text-sm ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
          {publicUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={muted}>{t.pubProfileYourPage || 'Your page:'}</span>
              <code className={`break-all ${dark ? 'text-teal-300' : 'text-teal-700'}`}>{publicUrl}</code>
              <button type="button" className={small} onClick={() => navigator.clipboard.writeText(publicUrl).then(() => addNotification?.('success', t.pubProfileLinkCopied || 'Link copied')).catch(() => {})}>
                <Copy className="w-3.5 h-3.5" /> {t.copy || 'Copy'}
              </button>
              <QrCodeButton getUrl={publicUrl} theme={theme} title={form.display_name || t.setupStep_profile || 'Practice profile'} description={t.pubProfileQrDescription || 'Scan to see our practice profile.'} filename="practice-profile" />
              <a className={small} href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> {t.auditOpen || 'Open'}</a>
              {data.profile.visibility === 'link' && data.profile.use_random_link && canEdit && (
                <button type="button" className={small} onClick={() => save({ regenerate_random_link: true })}
                        title={t.pubProfileNewAddressHint || 'Issue a new address. The current link and printed QR codes stop working.'}>
                  <RefreshCw className="w-3.5 h-3.5" /> {t.pubProfileNewAddress || 'New address'}
                </button>
              )}
            </div>
          ) : (
            <span className={muted}>{t.pubProfilePageOff || 'The page is off. Choose Link only or Searchable and save to publish it.'}</span>
          )}
          {publicUrl && form.visibility !== data.profile.visibility && <div className="text-amber-500 mt-1">{t.pubProfileSaveToApply || 'Save to apply the new visibility.'}</div>}
        </div>
      </section>

      {/* Details */}
      <section className={card} aria-labelledby="pp-details">
        <h3 id="pp-details" className={h}>{t.pubProfileDetails || 'Details'}</h3>
        <div className="grid gap-4 sm:grid-cols-2 mt-3">
          <div className="sm:col-span-2"><label className={label} htmlFor="pp-name">{t.pubProfilePracticeName || 'Practice name'}</label>
            <input id="pp-name" className={input} value={form.display_name} onChange={set('display_name')} disabled={!canEdit} maxLength={160} /></div>
          <div className="sm:col-span-2"><label className={label} htmlFor="pp-about">{t.pubProfileAbout || 'About'}</label>
            <textarea id="pp-about" rows={4} className={input} value={form.about} onChange={set('about')} disabled={!canEdit} maxLength={4000}
                      placeholder={t.pubProfileAboutPlaceholder || 'A few plain sentences about the practice. Avoid claims you cannot back up.'} /></div>
          <div><label className={label} htmlFor="pp-phone">{t.pubProfilePublicPhone || 'Public phone'}</label>
            <input id="pp-phone" className={input} value={form.phone} onChange={set('phone')} disabled={!canEdit} /></div>
          <div><label className={label} htmlFor="pp-email">{t.pubProfilePublicEmail || 'Public email'}</label>
            <input id="pp-email" type="email" className={input} value={form.email} onChange={set('email')} disabled={!canEdit} /></div>
          <div><label className={label} htmlFor="pp-web">{t.website || 'Website'}</label>
            <input id="pp-web" className={input} value={form.website} onChange={set('website')} disabled={!canEdit} placeholder="https://" /></div>
          <div><label className={label} htmlFor="pp-slug">{t.pubProfilePageAddress || 'Page address'}</label>
            <div className="flex items-center gap-1"><span className={`text-sm ${muted}`}>/p/</span>
              <input id="pp-slug" className={input} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} disabled={!canEdit} /></div></div>
        </div>
      </section>

      {/* Specialties + locations */}
      <section className={card} aria-labelledby="pp-spec">
        <h3 id="pp-spec" className={h}>{t.pubProfileSpecialties || 'Specialties'}</h3>
        <p className={`text-xs mb-3 ${muted}`}>{t.pubProfileSpecialtiesHelp || 'Chosen from the specialty catalogue, so they read the same everywhere.'}</p>
        <div className="flex flex-wrap gap-2">
          {(data.specialties || []).map((s) => (
            <button key={s.code} type="button" aria-pressed={form.specialty_codes.includes(s.code)} disabled={!canEdit}
                    className={chip(form.specialty_codes.includes(s.code))} onClick={() => toggleIn('specialty_codes', s.code)}>{s.name}</button>
          ))}
        </div>
        <h3 className={`${h} mt-6`}>{t.pubProfileLocationsShown || 'Locations shown'}</h3>
        {(data.locations || []).length === 0 ? (
          <p className={`text-sm ${muted}`}>{t.pubProfileNoLocations || 'Add your sites under Settings → Locations first.'}</p>
        ) : (
          <div className="space-y-2 mt-2">
            {data.locations.map((l) => (
              <label key={l.id} className={`flex items-start gap-2 text-sm ${dark ? 'text-slate-200' : 'text-gray-800'}`}>
                <input type="checkbox" className="mt-0.5" checked={form.location_ids.includes(String(l.id))} onChange={() => toggleIn('location_ids', String(l.id))} disabled={!canEdit} />
                <span><strong>{l.name}</strong>{l.is_primary ? ` ${t.pubProfilePrimary || '(primary)'}` : ''}<br />
                  <span className={muted}>{[l.address, l.city, l.state, l.postal_code, l.country].filter(Boolean).join(', ')}</span></span>
              </label>
            ))}
            <p className={`text-xs ${muted}`}>{t.pubProfileLocationsPublished || 'Only the name, address and phone are published — never a location\'s email or notes.'}</p>
          </div>
        )}
      </section>

      {/* Photos */}
      <section className={card} aria-labelledby="pp-photos">
        <h3 id="pp-photos" className={h}>{t.pubProfilePhotos || 'Photos'}</h3>
        <p className={`text-xs mb-3 ${muted}`}>{t.pubProfilePhotosHelp || 'JPEG or PNG, up to 2 MB. Location and camera details are removed. Do not show patients, screens or records.'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {['cover', 'logo'].map((kind) => {
            const field = `${kind}_photo_id`;
            return (
              <div key={kind}>
                <div className={label}>{kind === 'cover' ? (t.pubProfileCoverPhoto || 'Cover photo') : (t.pubProfileLogo || 'Logo')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {approved(kind).map((p) => (
                    <button key={p.id} type="button" disabled={!canEdit} onClick={() => setForm((f) => ({ ...f, [field]: f[field] === p.id ? null : p.id }))}
                            aria-pressed={form[field] === p.id} title={form[field] === p.id ? (t.pubProfileInUse || 'In use — click to remove from the page') : (t.pubProfileUseThis || 'Use this one')}
                            className={`relative rounded-lg overflow-hidden border-2 ${form[field] === p.id ? 'border-teal-500' : 'border-transparent'}`}>
                      <Thumb api={api} id={p.id} className={kind === 'cover' ? 'w-32 h-16 object-cover' : 'w-16 h-16 object-cover'} />
                    </button>
                  ))}
                  {canEdit && (
                    <label className={`${small} cursor-pointer`}>
                      {busyPhoto === kind ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {t.pubProfileUpload || 'Upload'}
                      <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => { upload(kind, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <UploadHint kind={kind} dark={dark} />
              </div>
            );
          })}
        </div>
        <div className={`${label} mt-5`}>{t.pubProfileGallery || 'Gallery'}</div>
        <div className="flex flex-wrap gap-2 items-center">
          {approved('gallery').map((p) => (
            <div key={p.id} className="relative">
              <Thumb api={api} id={p.id} className="w-24 h-20 object-cover rounded-lg" />
              {canEdit && <button type="button" aria-label={t.pubProfileDeletePhoto || 'Delete photo'} onClick={() => remove(p.id)} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white"><Trash2 className="w-3 h-3" /></button>}
            </div>
          ))}
          {canEdit && (
            <label className={`${small} cursor-pointer`}>
              {busyPhoto === 'gallery' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {t.pubProfileAddPhoto || 'Add photo'}
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => { upload('gallery', e.target.files[0]); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <UploadHint kind="gallery" dark={dark} />
        {pending.length > 0 && (
          <div className="mt-5">
            <div className={label}>{t.pubProfileAwaitingApproval || 'Waiting for approval'}</div>
            <div className="flex flex-wrap gap-3">
              {pending.map((p) => (
                <div key={p.id} className={`rounded-lg border p-2 ${dark ? 'border-slate-600' : 'border-gray-200'}`}>
                  <Thumb api={api} id={p.id} className="w-24 h-24 object-cover rounded" />
                  <div className={`text-xs mt-1 ${muted}`}>{KIND_LABELS[p.kind] || p.kind}</div>
                  {canEdit && (
                    <div className="flex gap-1 mt-1">
                      <button type="button" className={small} onClick={() => review(p.id, 'approved')}><Check className="w-3.5 h-3.5" /> {t.acctApprove || 'Approve'}</button>
                      <button type="button" className={small} onClick={() => review(p.id, 'rejected')}><X className="w-3.5 h-3.5" /> {t.aiReject || 'Reject'}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Providers */}
      <section className={card} aria-labelledby="pp-providers">
        <h3 id="pp-providers" className={h}>{t.providers || 'Providers'}</h3>
        <p className={`text-xs mb-3 ${muted}`}>
          {t.pubProfileProvidersHelp || 'Providers list themselves from their own profile (avatar menu → My profile → Practice profile listing). You can hide a listed provider, but you cannot list anyone without their consent.'}
        </p>
        {(data.providers || []).length === 0 ? <p className={`text-sm ${muted}`}>{t.pubProfileNoProviders || 'No providers yet.'}</p> : (
          <ul className="divide-y divide-slate-500/20">
            {data.providers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className={dark ? 'text-white' : 'text-gray-900'}>{p.name}</div>
                  <div className={`text-xs ${muted}`}>{p.specialization || specialtyName.get(p.specialization) || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.listed ? 'bg-teal-100 text-teal-800' : p.consented && p.hidden ? 'bg-amber-100 text-amber-800' : dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                    {p.listed ? PROVIDER_STATUS.listed : p.consented && p.hidden ? PROVIDER_STATUS.hidden : PROVIDER_STATUS.notConsented}
                  </span>
                  {canEdit && p.consented && (
                    <button type="button" className={small} onClick={() => setHidden(p.id, !p.hidden)}>{p.hidden ? (t.pubProfileShow || 'Show') : (t.pubProfileHide || 'Hide')}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={() => save()} disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t.pubProfileSaveProfile || 'Save profile'}
          </button>
        </div>
      )}
      <p className={`text-xs ${muted} flex items-center gap-1`}><Globe className="w-3.5 h-3.5" /> {t.pubProfileAuditNote || 'Every change to visibility and listings is recorded in the audit history.'}</p>
    </div>
  );
};

export default PracticeProfileTab;
