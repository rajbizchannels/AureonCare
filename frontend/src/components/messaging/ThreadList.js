import React from 'react';
import { MessageSquare, Lock, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

/**
 * Left pane of the messaging surface: the caller's conversations, newest
 * activity first. Purely presentational — loading, filtering and selection all
 * live in SecureMessaging.
 */

const PRIORITY_STYLES = {
  urgent: 'bg-red-500/15 text-red-500 border-red-500/30',
  high: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  normal: null,
  low: null,
};

/** "14:32" for today, "12 Aug" inside the year, else the full date. */
const formatStamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  return formatDate(value);
};

/**
 * Who the conversation is "with", from the caller's point of view — every
 * participant except the caller. Falls back to the subject-holder when a
 * thread somehow has no one else in it.
 */
const describeParticipants = (thread, me) => {
  const others = (thread.participants || []).filter(
    (p) => !(p.kind === me.kind && String(p.participantId) === String(me.id))
  );
  if (others.length === 0) return 'Just you';
  if (others.length <= 2) return others.map((p) => p.displayName).join(', ');
  return `${others[0].displayName} +${others.length - 1}`;
};

const ThreadList = ({ theme, threads, selectedId, onSelect, loading, emptyHint }) => {
  const dark = theme === 'dark';

  if (loading) {
    return (
      <div className={`p-4 space-y-3 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-20 rounded-xl animate-pulse ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}
          />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 p-10 text-center ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
        <MessageSquare className="w-10 h-10 opacity-40" />
        <p className="text-sm">{emptyHint || 'No conversations yet.'}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-700/40">
      {threads.map((thread) => {
        const active = thread.id === selectedId;
        const unread = thread.unreadCount > 0;
        const priorityStyle = PRIORITY_STYLES[thread.priority];

        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread)}
              aria-current={active ? 'true' : undefined}
              className={`w-full text-left px-4 py-3 transition-colors ${
                active
                  ? dark ? 'bg-slate-800' : 'bg-cyan-50'
                  : dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-sm truncate ${
                    unread
                      ? dark ? 'font-semibold text-white' : 'font-semibold text-gray-900'
                      : dark ? 'text-slate-200' : 'text-gray-800'
                  }`}
                >
                  {thread.subject}
                </span>
                <span className={`shrink-0 text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {formatStamp(thread.lastMessageAt)}
                </span>
              </div>

              <div className={`mt-1 flex items-center gap-1.5 text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                {thread.threadType === 'patient' ? (
                  <Lock className="w-3 h-3 shrink-0" />
                ) : (
                  <Users className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{describeParticipants(thread, thread.me || {})}</span>
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {unread && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                    {thread.unreadCount} new
                  </span>
                )}
                {priorityStyle && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityStyle}`}>
                    <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {thread.priority}
                  </span>
                )}
                {thread.status === 'closed' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>
                    <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Closed
                  </span>
                )}
                {thread.patientName && thread.threadType === 'care_team' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                    re: {thread.patientName}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ThreadList;
