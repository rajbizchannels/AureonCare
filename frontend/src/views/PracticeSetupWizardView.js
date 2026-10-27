import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Sparkles, Check, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert,
  Plus, Pencil, SkipForward, Eye, Building2, Stethoscope, ClipboardList, Clock, Users,
} from 'lucide-react';


/**
 * PracticeSetupWizardView — the specialty configuration wizard.
 *
 * Six steps, resumable, and every one of them skippable: "Skip for now" must leave a fully
 * working generic practice, because the wizard is an accelerator and never a gate.
 *
 * Nothing is written until the last step. Step 6 shows the server's own preview diff —
 * what will be created, what will be updated, and what the pack will leave alone because
 * the practice has already edited it — so Apply is never a leap of faith.
 */

const STEPS = [
  { id: 'profile',   icon: Building2 },
  { id: 'specialty', icon: Sparkles },
  { id: 'services',  icon: Stethoscope },
  { id: 'providers', icon: Users },
  { id: 'forms',     icon: ClipboardList },
  { id: 'review',    icon: Eye },
];

const PracticeSetupWizardView = ({ theme, t = {}, api, user, addNotification, onClose, onApplied }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';
  const border = dark ? 'border-gray-700' : 'border-gray-200';

  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = user && user.role === 'admin';
  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);
  const step = STEPS[stepIndex];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, sp] = await Promise.all([api.getPracticeSetupState(), api.getSpecialties()]);
      setState(st);
      setSpecialties(sp || []);
      if (st && Array.isArray(st.specialtyCodes) && st.specialtyCodes.length) {
        setChosen(st.specialtyCodes);
      }
      if (st && st.onboarding && st.onboarding.currentStep) {
        const i = STEPS.findIndex((s) => s.id === st.onboarding.currentStep);
        if (i >= 0) setStepIndex(i);
      }
    } catch (err) {
      notify(err.message || 'Failed to load practice setup', 'error');
    } finally { setLoading(false); }
  }, [api, notify]);

  useEffect(() => { load(); }, [load]);

  const saveStep = async (id, extra = {}) => {
    if (!isAdmin) return;
    try { await api.savePracticeSetupState({ currentStep: id, ...extra }); } catch { /* resumability is a convenience */ }
  };

  const goTo = (i) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setStepIndex(next);
    saveStep(STEPS[next].id);
  };

  const toggleSpecialty = (code) => {
    setPreview(null);
    setChosen((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  };

  const runPreview = async () => {
    if (!chosen.length) { notify(t.setupPickSpecialty || 'Choose at least one specialty.', 'error'); return; }
    setPreviewing(true);
    try {
      const diff = await api.previewSpecialtyPack(chosen);
      setPreview(diff);
      setAcknowledged(false);
    } catch (err) {
      setPreview(null);
      notify(err.message || 'Failed to preview', 'error');
    } finally { setPreviewing(false); }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const out = await api.applySpecialtyPack(chosen, {
        mode: 'seed', acknowledgeUnreviewed: acknowledged,
      });
      notify(
        (t.setupApplied || 'Configuration applied: {created} created, {skipped} already present, {conflicts} left alone.')
          .replace('{created}', out.summary.created)
          .replace('{skipped}', out.summary.skipped)
          .replace('{conflicts}', out.summary.conflicts),
        'success'
      );
      await api.savePracticeSetupState({ completed: true, specialtyCodes: chosen });
      if (onApplied) onApplied(out);
      if (onClose) onClose();
    } catch (err) {
      if (err.code === 'ClinicalReviewPending') {
        notify(err.message, 'error');
        setAcknowledged(false);
      } else {
        notify(err.message || 'Failed to apply', 'error');
      }
    } finally { setApplying(false); }
  };

  const skip = async () => {
    try { await api.savePracticeSetupState({ skipped: true, completed: true }); } catch { /* best effort */ }
    notify(t.setupSkipped || 'Setup skipped — you can run it any time from Admin → Practice Setup.', 'info');
    if (onClose) onClose();
  };

  const unreviewed = preview && preview.reviewStatus && preview.reviewStatus !== 'approved';
  const chosenPacks = specialties.filter((s) => chosen.includes(s.code));
  const anyWithoutPack = chosenPacks.some((s) => !s.hasPack);

  const Label = ({ children }) => <label className={`block text-xs mb-1 ${sub}`}>{children}</label>;
  const Row = ({ children }) => <div className={`p-3 border-b last:border-0 ${border}`}>{children}</div>;

  if (loading) {
    return <div className={`p-8 text-sm ${sub}`}>{t.loading || 'Loading…'}</div>;
  }

  if (!isAdmin) {
    return (
      <div className={`p-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
        <div className={`max-w-xl p-6 rounded-lg shadow ${card}`}>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />{t.setupTitle || 'Practice Setup'}
          </h3>
          <p className={`mt-2 text-sm ${sub}`}>
            {t.setupAdminOnly || 'Only an administrator can configure the practice specialty.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-6 space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />{t.setupTitle || 'Practice Setup'}
          </h3>
          <p className={`text-sm mt-1 ${sub}`}>
            {t.setupDescription || 'Configure the product for how this practice actually works. Nothing is written until the last step, and every step can be skipped.'}
          </p>
        </div>
        <button onClick={skip}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <SkipForward className="w-4 h-4" />{t.setupSkip || 'Skip for now'}
        </button>
      </div>

      {/* step rail */}
      <div className="flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < stepIndex;
          return (
            <button key={s.id} onClick={() => goTo(i)}
              className={`px-3 py-2 rounded-lg text-xs whitespace-nowrap flex items-center gap-2 ${
                i === stepIndex
                  ? 'bg-blue-600 text-white'
                  : done
                    ? (dark ? 'bg-gray-700' : 'bg-gray-200')
                    : (dark ? 'bg-gray-800 ' + sub : 'bg-gray-100 ' + sub)}`}>
              {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              {t[`setupStep_${s.id}`] || s.id}
            </button>
          );
        })}
      </div>

      <div className={`rounded-lg shadow ${card}`}>
        {/* 1. profile */}
        {step.id === 'profile' && (
          <div className="p-4 space-y-3">
            <h4 className="font-medium">{t.setupStep_profile || 'Practice profile'}</h4>
            <p className={`text-sm ${sub}`}>
              {t.setupProfileHint || 'Taken from your signup. Change these in Admin → Clinic Settings.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div><Label>{t.name || 'Practice'}</Label><p className="text-sm">{state?.practice?.name || '—'}</p></div>
              <div><Label>{t.country || 'Country'}</Label><p className="text-sm">{state?.practice?.country || '—'}</p></div>
              <div><Label>{t.timezone || 'Timezone'}</Label><p className="text-sm">{state?.practice?.timezone || '—'}</p></div>
            </div>
          </div>
        )}

        {/* 2. specialty */}
        {step.id === 'specialty' && (
          <div>
            <div className={`p-4 border-b ${border}`}>
              <h4 className="font-medium">{t.setupStep_specialty || 'Specialty'}</h4>
              <p className={`text-sm mt-1 ${sub}`}>
                {t.setupSpecialtyHint || 'Pick one, or several for a multi-specialty hospital. The first one you pick leads: it decides terminology and defaults where packs disagree.'}
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {specialties.filter((s) => !s.parentCode).map((s) => {
                const on = chosen.includes(s.code);
                const order = chosen.indexOf(s.code);
                return (
                  <Row key={s.code}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => toggleSpecialty(s.code)} />
                      <span className="text-sm flex-1">
                        {s.name}
                        {on && order === 0 && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {t.setupPrimary || 'primary'}
                          </span>
                        )}
                        {s.hasPack
                          ? <span className={`ml-2 text-xs ${sub}`}>
                              {(t.setupPackAvailable || 'pack v{v}').replace('{v}', s.packVersion)}
                              {s.clinicalReviewStatus !== 'approved' && (
                                <span className="ml-1 text-amber-600">· {t.setupPackDraft || 'draft'}</span>
                              )}
                            </span>
                          : <span className={`ml-2 text-xs ${sub}`}>{t.setupNoPack || 'no starter content yet'}</span>}
                      </span>
                    </label>
                  </Row>
                );
              })}
            </div>
            {anyWithoutPack && (
              <div className="p-3 text-sm bg-amber-50 text-amber-900">
                {t.setupSomeWithoutPacks || 'Some of the specialties you picked have no starter content yet. They are recorded on the practice, but nothing will be created for them.'}
              </div>
            )}
          </div>
        )}

        {/* 3-5. what the chosen packs will bring */}
        {['services', 'providers', 'forms'].includes(step.id) && (
          <div>
            <div className={`p-4 border-b ${border}`}>
              <h4 className="font-medium">{t[`setupStep_${step.id}`] || step.id}</h4>
              <p className={`text-sm mt-1 ${sub}`}>
                {step.id === 'services' && (t.setupServicesHint || 'Services and appointment types the chosen packs will create. You can edit any of them afterwards — once you do, a later pack update will leave your version alone.')}
                {step.id === 'providers' && (t.setupProvidersHint || 'Invite colleagues and set working hours in Admin. Nothing here is created by the wizard.')}
                {step.id === 'forms' && (t.setupFormsHint || 'Intake and consent forms the chosen packs will create.')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {!preview && (
                <button onClick={runPreview} disabled={previewing || !chosen.length}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {previewing ? (t.loading || 'Loading…') : (t.setupShowWhatWillBeCreated || 'Show what will be created')}
                </button>
              )}
              {preview && (
                <ul className="text-sm space-y-1 max-h-72 overflow-y-auto">
                  {[...preview.creates, ...preview.skips]
                    .filter((r) => (step.id === 'forms'
                      ? r.section === 'formTemplates'
                      : step.id === 'services'
                        ? ['offerings', 'serviceCategories', 'appointmentTypes'].includes(r.section)
                        : false))
                    .map((r) => (
                      <li key={`${r.section}-${r.key}`} className="flex items-center gap-2">
                        <Plus className="w-3 h-3 text-green-600" />{r.label}
                      </li>
                    ))}
                  {step.id === 'providers' && (
                    <li className={sub}>{t.setupNothingHere || 'Nothing is created at this step.'}</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 6. review and apply */}
        {step.id === 'review' && (
          <div>
            <div className={`p-4 border-b ${border}`}>
              <h4 className="font-medium">{t.setupStep_review || 'Review and apply'}</h4>
              <p className={`text-sm mt-1 ${sub}`}>
                {t.setupReviewHint || 'Exactly what will change. Nothing has been written yet.'}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {!preview && (
                <button onClick={runPreview} disabled={previewing || !chosen.length}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {previewing ? (t.loading || 'Loading…') : (t.setupPreview || 'Preview changes')}
                </button>
              )}

              {preview && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      [t.setupWillCreate || 'To create', preview.summary.created, 'text-green-600'],
                      [t.setupWillUpdate || 'To update', preview.summary.updated, 'text-blue-600'],
                      [t.setupAlreadyThere || 'Already there', preview.summary.skipped, sub],
                      [t.setupLeftAlone || 'Left alone', preview.summary.conflicts, 'text-amber-600'],
                    ].map(([label, n, cls]) => (
                      <div key={label} className={`p-3 rounded-lg ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                        <p className={`text-xs ${sub}`}>{label}</p>
                        <p className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</p>
                      </div>
                    ))}
                  </div>

                  {(preview.mergeClashes || []).length > 0 && (
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-900 text-sm">
                      <p className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t.setupMergeClashes || 'Your specialties disagree on some things. The primary one wins:'}
                      </p>
                      <ul className="mt-1 text-xs list-disc pl-5">
                        {preview.mergeClashes.slice(0, 8).map((c, i) => (
                          <li key={i}>{c.section}: {c.key} — {(t.setupKeptFrom || 'kept from {a}, also in {b}').replace('{a}', c.keptFrom).replace('{b}', c.alsoIn)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preview.conflicts.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
                      <p className="font-medium flex items-center gap-2">
                        <Pencil className="w-4 h-4" />
                        {t.setupConflictsTitle || 'These will be left exactly as they are:'}
                      </p>
                      <ul className="mt-1 text-xs list-disc pl-5 max-h-40 overflow-y-auto">
                        {preview.conflicts.map((c) => <li key={`${c.section}-${c.key}`}>{c.message}</li>)}
                      </ul>
                    </div>
                  )}

                  {(preview.settings?.hiddenModules || []).length > 0 && (
                    <div className={`p-3 rounded-lg text-sm ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      <p className="font-medium">{t.setupModulesHidden || 'Menu items this specialty hides by default:'}</p>
                      <p className={`mt-1 text-xs ${sub}`}>
                        {preview.settings.hiddenModules.join(', ')} — {t.setupModulesRestorable || 'you can show any of them again in Admin at any time.'}
                      </p>
                    </div>
                  )}

                  {unreviewed && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-900 text-sm space-y-2">
                      <p className="font-medium flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        {t.setupReviewPendingTitle || 'This starter content has not had clinical review'}
                      </p>
                      <p className="text-xs">
                        {t.setupReviewPendingBody || 'The services, procedure codes and forms are engineering drafts. Check them against your own protocols before using them with patients.'}
                      </p>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)} />
                        {t.setupReviewAcknowledge || 'I understand, and will review the content before clinical use.'}
                      </label>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button onClick={apply} disabled={applying || (unreviewed && !acknowledged)}
                      className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                      {applying ? (t.setupApplying || 'Applying…') : (t.setupApply || 'Apply configuration')}
                    </button>
                    <button onClick={runPreview} disabled={previewing}
                      className={`px-3 py-2 rounded-lg text-sm ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      {t.setupRefreshPreview || 'Refresh preview'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className={`flex items-center justify-between p-4 border-t ${border}`}>
          <button onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-40 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <ChevronLeft className="w-4 h-4" />{t.back || 'Back'}
          </button>
          <span className={`text-xs ${sub}`}>
            {(t.setupStepOf || 'Step {n} of {total}').replace('{n}', stepIndex + 1).replace('{total}', STEPS.length)}
          </span>
          <button onClick={() => goTo(stepIndex + 1)} disabled={stepIndex === STEPS.length - 1}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-40 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {t.next || 'Next'}<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Menu visibility. A pack hides modules by default; it never takes them away. An
          admin can put any of them back, and this is where that lives — next to the thing
          that hid them, rather than somewhere they would have to go hunting. */}
      {state && (state.hiddenModules || []).length > 0 && (
        <div className={`rounded-lg shadow ${card}`}>
          <div className={`p-4 border-b ${border}`}>
            <h4 className="font-medium">{t.setupMenuVisibility || 'Menu visibility'}</h4>
            <p className={`text-sm mt-1 ${sub}`}>
              {t.setupMenuVisibilityHint || 'Your specialty hides these by default. Tick one to show it again — your plan already includes it.'}
            </p>
          </div>
          <div>
            {state.hiddenModules.map((m) => {
              const pinned = (state.pinnedModules || []).includes(m);
              return (
                <Row key={m}>
                  <label className="flex items-center gap-3 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={async (e) => {
                        const next = e.target.checked
                          ? [...(state.pinnedModules || []), m]
                          : (state.pinnedModules || []).filter((x) => x !== m);
                        try {
                          await api.setPinnedModules(next);
                          setState({ ...state, pinnedModules: next });
                          if (onApplied) onApplied();
                          notify(t.setupMenuSaved || 'Menu updated', 'success');
                        } catch (err) {
                          notify(err.message || 'Failed to update the menu', 'error');
                        }
                      }}
                    />
                    <span>{t[m] || m}</span>
                    {pinned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        {t.setupShown || 'shown'}
                      </span>
                    )}
                  </label>
                </Row>
              );
            })}
          </div>
        </div>
      )}

      {state && (state.appliedPacks || []).length > 0 && (
        <div className={`rounded-lg shadow ${card}`}>
          <div className={`p-4 border-b ${border}`}>
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />{t.setupHistory || 'Previously applied'}
            </h4>
          </div>
          <div>
            {state.appliedPacks.slice().reverse().map((p, i) => (
              <Row key={i}>
                <p className="text-sm">
                  {p.code} v{p.version}
                  <span className={`ml-2 text-xs ${sub}`}>
                    {p.mode} · {new Date(p.appliedAt).toLocaleString()}
                    {p.reviewStatus !== 'approved' && ` · ${t.setupPackDraft || 'draft content'}`}
                  </span>
                </p>
              </Row>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

PracticeSetupWizardView.propTypes = {
  theme: PropTypes.string,
  t: PropTypes.object,
  api: PropTypes.object.isRequired,
  user: PropTypes.object,
  addNotification: PropTypes.func,
  onClose: PropTypes.func,
  onApplied: PropTypes.func,
};

export default PracticeSetupWizardView;
