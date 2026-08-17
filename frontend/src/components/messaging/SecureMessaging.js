import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MessageSquarePlus, Search, RefreshCw, Inbox, Archive, Lock } from 'lucide-react';
import ThreadList from './ThreadList';
import MessageThreadPanel from './MessageThreadPanel';
import NewThreadModal from './NewThreadModal';

/**
 * The complete messaging surface, shared by the staff console (MessagesView)
 * and the patient portal's Messages tab. `mode` decides which affordances
 * appear — priority, the full recipient directory and thread administration
 * are staff-only — while the transport underneath is identical.
 *
 * Layout is two-pane on md and up; below that the list and the conversation
 * occupy the full width one at a time, which is what makes the same component
 * usable on a phone.
 */

const THREAD_POLL_MS = 30000;
const MESSAGE_POLL_MS = 15000;

const SecureMessaging = ({ theme, api, addNotification, user, mode = 'staff', className = '' }) => {
  const dark = theme === 'dark';
  const isStaff = mode === 'staff';

  const me = useMemo(
    () => ({ kind: isStaff ? 'user' : 'patient', id: user?.id }),
    [isStaff, user?.id]
  );

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  // Mirrors the selected thread id for the poll callbacks, which would
  // otherwise close over a stale value between renders.
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedThread?.id ?? null;

  // ── Threads ───────────────────────────────────────────────────────────────
  const loadThreads = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoadingThreads(true);
    try {
      const rows = await api.getMessageThreads({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: search || undefined,
      });
      // Stamp each row with the viewer so ThreadList can say who a
      // conversation is *with* without threading `me` through separately.
      setThreads(rows.map((t) => ({ ...t, me })));
    } catch (error) {
      // A failed background refresh should not interrupt someone mid-reply.
      if (!quiet) addNotification('alert', error.message || 'Failed to load conversations');
    } finally {
      if (!quiet) setLoadingThreads(false);
    }
  }, [api, statusFilter, search, me, addNotification]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const timer = setInterval(() => loadThreads({ quiet: true }), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [loadThreads]);

  // ── Messages ──────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (threadId, { quiet = false } = {}) => {
    if (!threadId) return;
    if (!quiet) setLoadingMessages(true);
    try {
      const rows = await api.getThreadMessages(threadId);
      // Discard a response that arrived after the user moved on.
      if (selectedIdRef.current === threadId) setMessages(rows);
    } catch (error) {
      if (!quiet) addNotification('alert', error.message || 'Failed to load messages');
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, [api, addNotification]);

  useEffect(() => {
    if (!selectedThread?.id) {
      setMessages([]);
      return undefined;
    }
    loadMessages(selectedThread.id);
    const timer = setInterval(() => loadMessages(selectedThread.id, { quiet: true }), MESSAGE_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedThread?.id, loadMessages]);

  const handleSelect = useCallback(async (thread) => {
    setSelectedThread(thread);
    if (thread.unreadCount > 0) {
      // Clear the badge locally first — waiting for the round trip makes
      // opening a conversation feel laggy.
      setThreads((current) =>
        current.map((t) => (t.id === thread.id ? { ...t, unreadCount: 0 } : t))
      );
      try {
        await api.markThreadRead(thread.id);
      } catch {
        // Non-fatal: the next poll re-derives the true count from the server.
      }
    }
  }, [api]);

  const handleSend = useCallback(async (body, attachments) => {
    if (!selectedThread) return false;
    setSending(true);
    try {
      const message = await api.sendMessage(selectedThread.id, { body, attachments });
      // Append optimistically, then reconcile — the returned row carries no
      // attachment ids, so a refresh fills those in.
      setMessages((current) => [...current, message]);
      await loadMessages(selectedThread.id, { quiet: true });
      loadThreads({ quiet: true });
      return true;
    } catch (error) {
      addNotification('alert', error.message || 'Failed to send message');
      return false;
    } finally {
      setSending(false);
    }
  }, [api, selectedThread, loadMessages, loadThreads, addNotification]);

  const handleWithdraw = useCallback(async (messageId) => {
    try {
      await api.withdrawMessage(messageId);
      await loadMessages(selectedIdRef.current, { quiet: true });
      addNotification('success', 'Message withdrawn');
    } catch (error) {
      addNotification('alert', error.message || 'Failed to withdraw message');
    }
  }, [api, loadMessages, addNotification]);

  const handleToggleStatus = useCallback(async () => {
    if (!selectedThread) return;
    const next = selectedThread.status === 'closed' ? 'open' : 'closed';
    try {
      await api.updateMessageThread(selectedThread.id, { status: next });
      setSelectedThread((current) => ({ ...current, status: next }));
      loadThreads({ quiet: true });
      addNotification('success', next === 'closed' ? 'Conversation closed' : 'Conversation reopened');
    } catch (error) {
      addNotification('alert', error.message || 'Failed to update conversation');
    }
  }, [api, selectedThread, loadThreads, addNotification]);

  const handleCreated = useCallback(async (thread) => {
    setShowCompose(false);
    await loadThreads();
    const full = await api.getMessageThread(thread.id).catch(() => null);
    if (full) setSelectedThread({ ...full, me });
  }, [api, loadThreads, me]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations by subject…"
            className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-cyan-500 ${
              dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </div>

        <div className={`flex rounded-lg border overflow-hidden ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
          {[
            { id: 'open', label: 'Open', icon: Inbox },
            { id: 'closed', label: 'Closed', icon: Archive },
            { id: 'all', label: 'All', icon: null },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                statusFilter === option.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                  : dark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {option.icon && <option.icon className="w-3.5 h-3.5" />}
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => loadThreads()}
          aria-label="Refresh conversations"
          className={`p-2 rounded-lg border ${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loadingThreads ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="hidden sm:inline">New message</span>
        </button>
      </div>

      {/* ── Two-pane surface ───────────────────────────────────────────── */}
      <div
        className={`flex rounded-xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}
        style={{ height: 'min(70vh, 44rem)' }}
      >
        {/* On small screens the list yields the whole width once a thread is open. */}
        <div
          className={`${selectedThread ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 shrink-0 border-r ${
            dark ? 'border-slate-700' : 'border-gray-300'
          }`}
        >
          <div className="flex-1 overflow-y-auto">
            <ThreadList
              theme={theme}
              threads={threads}
              selectedId={selectedThread?.id}
              onSelect={handleSelect}
              loading={loadingThreads}
              emptyHint={
                isStaff
                  ? 'No conversations yet. Start one with a colleague or a patient.'
                  : 'No messages yet. Start a conversation with your care team.'
              }
            />
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-2 text-xs border-t ${dark ? 'border-slate-700 text-slate-500' : 'border-gray-300 text-gray-400'}`}>
            <Lock className="w-3 h-3" />
            Messages are encrypted at rest and access is audited.
          </div>
        </div>

        <div className={`${selectedThread ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
          <MessageThreadPanel
            theme={theme}
            api={api}
            thread={selectedThread}
            messages={messages}
            loading={loadingMessages}
            sending={sending}
            me={me}
            canAdminister={isStaff}
            onSend={handleSend}
            onBack={() => setSelectedThread(null)}
            onWithdraw={handleWithdraw}
            onToggleStatus={handleToggleStatus}
            addNotification={addNotification}
          />
        </div>
      </div>

      {showCompose && (
        <NewThreadModal
          theme={theme}
          api={api}
          mode={mode}
          me={me}
          onClose={() => setShowCompose(false)}
          onCreated={handleCreated}
          addNotification={addNotification}
        />
      )}
    </div>
  );
};

export default SecureMessaging;
