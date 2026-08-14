import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Check, Loader2, UserCircle, Stethoscope, AlertTriangle } from 'lucide-react';

/**
 * Compose a new conversation.
 *
 * The recipient picker has two sources depending on who is composing:
 * staff search the full directory (`api.getMessageRecipients`), patients only
 * ever see their own care team (`api.getMessageCareTeam`). That split is
 * enforced server-side too — this component picks the right call, it is not
 * the security boundary.
 */

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const NewThreadModal = ({ theme, api, mode, me, onClose, onCreated, addNotification }) => {
  const dark = theme === 'dark';
  const isStaff = mode === 'staff';

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState({ staff: [], patients: [] });
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadDirectory = useCallback(async (q) => {
    setSearching(true);
    try {
      if (isStaff) {
        setDirectory(await api.getMessageRecipients(q));
      } else {
        setDirectory({ staff: await api.getMessageCareTeam(), patients: [] });
      }
    } catch (error) {
      addNotification('alert', error.message || 'Failed to load recipients');
    } finally {
      setSearching(false);
    }
  }, [api, isStaff, addNotification]);

  // Debounced search so a typed query does not fire a request per keystroke.
  // Patients have no query — their care team loads once.
  useEffect(() => {
    if (!isStaff) {
      loadDirectory('');
      return undefined;
    }
    const timer = setTimeout(() => loadDirectory(query), 250);
    return () => clearTimeout(timer);
  }, [query, isStaff, loadDirectory]);

  const toggle = (candidate) => {
    setSelected((current) => {
      const exists = current.some(
        (s) => s.kind === candidate.kind && String(s.id) === String(candidate.id)
      );
      return exists
        ? current.filter((s) => !(s.kind === candidate.kind && String(s.id) === String(candidate.id)))
        : [...current, candidate];
    });
  };

  const isSelected = (candidate) =>
    selected.some((s) => s.kind === candidate.kind && String(s.id) === String(candidate.id));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!subject.trim()) return addNotification('alert', 'Give the conversation a subject');
    if (!body.trim()) return addNotification('alert', 'Write a message to send');
    if (selected.length === 0) return addNotification('alert', 'Choose at least one recipient');

    setSubmitting(true);
    try {
      const thread = await api.createMessageThread({
        subject: subject.trim(),
        body: body.trim(),
        priority,
        participants: selected.map((s) => ({ kind: s.kind, id: s.id })),
        // A staff thread addressed to a patient is about that patient; the
        // server re-derives this, but sending it keeps care-team threads
        // correctly filed against the right chart.
        patientId: selected.find((s) => s.kind === 'patient')?.id,
      });
      addNotification('success', 'Conversation started');
      onCreated(thread);
    } catch (error) {
      addNotification('alert', error.message || 'Failed to start conversation');
    } finally {
      setSubmitting(false);
    }
  };

  const patientSelected = selected.some((s) => s.kind === 'patient');

  const renderCandidate = (candidate, icon) => {
    const Icon = icon;
    const chosen = isSelected(candidate);
    return (
      <button
        key={`${candidate.kind}-${candidate.id}`}
        type="button"
        onClick={() => toggle(candidate)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          chosen
            ? dark ? 'bg-cyan-500/15 border border-cyan-500/40' : 'bg-cyan-50 border border-cyan-300'
            : dark ? 'hover:bg-slate-800 border border-transparent' : 'hover:bg-gray-50 border border-transparent'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${dark ? 'text-slate-400' : 'text-gray-500'}`} />
        <span className="flex-1 min-w-0">
          <span className={`block text-sm truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>
            {candidate.displayName}
          </span>
          <span className={`block text-xs truncate ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
            {candidate.specialty || candidate.role || candidate.mrn || candidate.email}
          </span>
        </span>
        {chosen && <Check className="w-4 h-4 text-cyan-500 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border ${
          dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
        }`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
            New secure conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* ── Recipients ─────────────────────────────────────────────── */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
              {isStaff ? 'Recipients' : 'Send to'}
            </label>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selected.map((s) => (
                  <span
                    key={`${s.kind}-${s.id}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                      s.kind === 'patient'
                        ? 'bg-amber-500/15 text-amber-600'
                        : dark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {s.displayName}
                    <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s.displayName}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isStaff && (
              <div className="relative mb-2">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search staff and patients…"
                  className={`w-full pl-9 pr-3 py-2 rounded-lg border focus:outline-none focus:border-cyan-500 ${
                    dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            )}

            <div className={`max-h-56 overflow-y-auto rounded-lg border p-1 space-y-0.5 ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
              {searching && (
                <div className={`flex justify-center py-4 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}

              {!searching && directory.staff?.length === 0 && directory.patients?.length === 0 && (
                <p className={`text-sm text-center py-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  No one to show.
                </p>
              )}

              {directory.staff?.length > 0 && (
                <>
                  <p className={`px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {isStaff ? 'Staff' : 'Your care team'}
                  </p>
                  {directory.staff.map((c) => renderCandidate(c, Stethoscope))}
                </>
              )}

              {directory.patients?.length > 0 && (
                <>
                  <p className={`px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Patients
                  </p>
                  {directory.patients.map((c) => renderCandidate(c, UserCircle))}
                </>
              )}
            </div>

            {patientSelected && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                A patient is included — they will be able to read every message in this conversation.
              </p>
            )}
          </div>

          {/* ── Subject ────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="thread-subject" className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
              Subject
            </label>
            <input
              id="thread-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
              placeholder="What is this about?"
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-cyan-500 ${
                dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>

          {/* Priority is a staff triage tool; patients do not set it. */}
          {isStaff && (
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
                Priority
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                      priority === level
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : dark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Message ────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="thread-body" className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
              Message
            </label>
            <textarea
              id="thread-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={20000}
              placeholder="Write your message…"
              className={`w-full px-3 py-2 rounded-lg border resize-y focus:outline-none focus:border-cyan-500 ${
                dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </form>

        <div className={`flex justify-end gap-2 px-6 py-4 border-t ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              dark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewThreadModal;
