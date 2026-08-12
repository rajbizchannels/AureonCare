import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, X, Lock, Users, Trash2, Download,
  ArrowLeft, CheckCircle2, RotateCcw, AlertTriangle, Loader2, ShieldAlert
} from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

/**
 * Right pane: one conversation, its transcript, and the composer.
 *
 * Messages are grouped visually by author rather than bubbled per row, so a
 * clinician scanning a long thread reads it as a conversation instead of a
 * list. System notices ("X added Y") render inline, centred and unattributed.
 */

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // result is a data URL — strip the "data:<mime>;base64," prefix.
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MessageThreadPanel = ({
  theme,
  api,
  thread,
  messages,
  loading,
  sending,
  me,
  canAdminister,
  onSend,
  onBack,
  onWithdraw,
  onToggleStatus,
  addNotification,
}) => {
  const dark = theme === 'dark';
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Jump to the newest message whenever the thread or its length changes —
  // a conversation opens at the bottom, not the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.id, messages.length]);

  // Clear the composer when switching conversations so a half-typed reply
  // never lands in the wrong thread.
  useEffect(() => {
    setDraft('');
    setAttachments([]);
  }, [thread?.id]);

  const handleFiles = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';  // let the same file be picked again after removal
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      addNotification('alert', `You can attach at most ${MAX_ATTACHMENTS} files to a message`);
      return;
    }

    const accepted = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        addNotification('alert', `"${file.name}" is larger than 5MB and was not attached`);
        continue;
      }
      try {
        accepted.push({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          contentBase64: await readFileAsBase64(file),
        });
      } catch (error) {
        addNotification('alert', error.message);
      }
    }
    setAttachments((current) => [...current, ...accepted]);
  }, [attachments.length, addNotification]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    const ok = await onSend(draft.trim(), attachments);
    if (ok) {
      setDraft('');
      setAttachments([]);
    }
  };

  // Enter sends, Shift+Enter breaks the line — the convention every messaging
  // client shares, and the one clinicians will already have in their fingers.
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleDownload = async (attachment) => {
    setDownloadingId(attachment.id);
    try {
      const blob = await api.downloadMessageAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      addNotification('alert', error.message || 'Failed to download attachment');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!thread) {
    return (
      <div className={`hidden md:flex flex-1 items-center justify-center ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
        <div className="text-center">
          <Lock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a conversation to read it.</p>
        </div>
      </div>
    );
  }

  const isMine = (message) =>
    message.senderKind === me.kind && String(message.senderId) === String(me.id);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`flex items-start gap-3 px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
        <button
          type="button"
          onClick={onBack}
          className={`md:hidden p-2 -ml-2 rounded-lg ${dark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
            {thread.subject}
          </h3>
          <div className={`mt-0.5 flex items-center gap-2 text-xs flex-wrap ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
            {thread.threadType === 'patient' ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            <span className="truncate">
              {(thread.participants || []).map((p) => p.displayName).join(', ')}
            </span>
            {thread.patientName && (
              <span className={`px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                {thread.patientName}{thread.patientMrn ? ` · ${thread.patientMrn}` : ''}
              </span>
            )}
          </div>
        </div>

        {canAdminister && (
          <button
            type="button"
            onClick={onToggleStatus}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              dark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {thread.status === 'closed'
              ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> Close</>}
          </button>
        )}
      </div>

      {/* Staff need to know the patient reads everything written here. */}
      {thread.threadType === 'patient' && me.kind === 'user' && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-amber-500/10 text-amber-600 border-b border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          The patient is a participant and can read every message in this thread.
        </div>
      )}

      {/* ── Transcript ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {loading && (
          <div className={`flex justify-center py-6 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className={`text-center text-sm py-6 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
            No messages in this conversation yet.
          </p>
        )}

        {messages.map((message) => {
          if (message.messageType === 'system') {
            return (
              <p key={message.id} className={`text-center text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                {message.body}
              </p>
            );
          }

          const mine = isMine(message);

          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] group`}>
                <div className={`flex items-baseline gap-2 mb-1 ${mine ? 'justify-end' : ''}`}>
                  <span className={`text-xs font-medium ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
                    {mine ? 'You' : message.senderName}
                  </span>
                  <span className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {formatDateTime(message.sentAt)}
                  </span>
                </div>

                <div
                  className={`rounded-xl px-4 py-2.5 border ${
                    mine
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent'
                      : dark
                        ? 'bg-slate-800 border-slate-700 text-slate-100'
                        : 'bg-white border-gray-300 text-gray-800'
                  }`}
                >
                  {message.deletedAt ? (
                    <span className="text-sm italic opacity-70">This message was withdrawn.</span>
                  ) : message.undecryptable ? (
                    <span className="flex items-center gap-1.5 text-sm italic opacity-80">
                      <ShieldAlert className="w-4 h-4" />
                      This message could not be decrypted.
                    </span>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                  )}

                  {message.attachments?.length > 0 && (
                    <div className={`mt-2 pt-2 space-y-1 border-t ${mine ? 'border-white/25' : dark ? 'border-slate-700' : 'border-gray-200'}`}>
                      {message.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={() => handleDownload(attachment)}
                          disabled={downloadingId === attachment.id}
                          className={`flex items-center gap-2 text-xs w-full text-left hover:underline disabled:opacity-60 ${
                            mine ? 'text-white' : dark ? 'text-cyan-400' : 'text-cyan-600'
                          }`}
                        >
                          {downloadingId === attachment.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            : <Download className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate">{attachment.fileName}</span>
                          <span className="opacity-70 shrink-0">{formatBytes(attachment.sizeBytes)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {mine && !message.deletedAt && (
                  <button
                    type="button"
                    onClick={() => onWithdraw(message.id)}
                    className={`mt-1 flex items-center gap-1 ml-auto text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${
                      dark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" /> Withdraw
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Composer ───────────────────────────────────────────────────── */}
      {thread.status === 'closed' ? (
        <div className={`px-4 py-3 border-t text-sm text-center ${dark ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-gray-500'}`}>
          This conversation is closed.{canAdminister ? ' Reopen it to reply.' : ' Start a new one to continue.'}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`border-t p-3 ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((attachment, index) => (
                <span
                  key={`${attachment.fileName}-${index}`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${dark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[10rem] truncate">{attachment.fileName}</span>
                  <span className="opacity-60">{formatBytes(attachment.sizeBytes)}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((c) => c.filter((_, i) => i !== index))}
                    aria-label={`Remove ${attachment.fileName}`}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" multiple onChange={handleFiles} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a file"
              className={`p-2.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Write a secure message…"
              className={`flex-1 resize-none px-3 py-2.5 rounded-lg border max-h-40 focus:outline-none focus:border-cyan-500 ${
                dark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              style={{ minHeight: '2.75rem' }}
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MessageThreadPanel;
