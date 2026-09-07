import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  AlertTriangle, ArrowLeft, Camera, FileCheck, Paperclip, Send, ShieldAlert,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ApiClient, Disposition, Message, OutgoingAttachment, Thread } from '@/lib/api';
import { Loading } from '@/components/ui';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';

const FILING_LABEL: Record<string, string> = {
  patient_records: 'Filed to Patient Records',
  forms_requested: 'Added to Forms Requested',
};

/** Attachment cap mirrors the server's: 5 MB, five per message. */
const MAX_BYTES = 5 * 1024 * 1024;

export const Conversation: React.FC<{
  api: ApiClient;
  thread: Thread;
  isPatient: boolean;
  meId: string | undefined;
  onBack: () => void;
  onSent: () => void;
}> = ({ api, thread, isPatient, meId, onBack, onSent }) => {
  const { isSplit } = useLayout();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<OutgoingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setMessages(await api.listMessages(thread.id));
        setError(null);
      } catch (e) {
        if (!quiet) setError(e instanceof Error ? e.message : 'Could not load messages.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [api, thread.id]
  );

  useEffect(() => {
    setDraft('');
    setPending(null);
    void load();
    void api.markThreadRead(thread.id).catch(() => undefined);
  }, [thread.id, load, api]);

  // Poll only while a thread is open — the scope doc's rule, so an idle app
  // is not spending battery on a conversation nobody is reading.
  useEffect(() => {
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const attach = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to attach a photo.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (shot.canceled || !shot.assets[0]) return;

    const asset = shot.assets[0];
    if (!asset.base64) {
      setError('Could not read that photo.');
      return;
    }
    // base64 inflates by ~4/3; check the decoded size against the server's cap.
    if ((asset.base64.length * 3) / 4 > MAX_BYTES) {
      setError('That photo is larger than 5MB.');
      return;
    }
    setPending({
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      contentBase64: asset.base64,
      disposition: 'records',
    });
  }, []);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body && !pending) return;
    setSending(true);
    try {
      await api.sendMessage(thread.id, body || 'Attached.', pending ? [pending] : []);
      setDraft('');
      setPending(null);
      await load(true);
      onSent();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }, [api, draft, pending, thread.id, load, onSent]);

  const canSend = Boolean(draft.trim() || pending);

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        {/* On a split tablet the list is already on screen, so Back is noise. */}
        {!isSplit && (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
            <ArrowLeft size={22} color={palette.textSecondary} />
          </Pressable>
        )}
        <View style={styles.fill}>
          <Text numberOfLines={1} style={styles.subject}>{thread.subject}</Text>
          <Text numberOfLines={1} style={styles.participants}>
            {thread.participants.map((p) => p.displayName).join(', ')}
          </Text>
        </View>
      </View>

      {thread.threadType === 'patient' && !isPatient && (
        <View style={styles.warning}>
          <AlertTriangle size={14} color={palette.warningText} />
          <Text style={styles.warningText}>
            The patient is a participant and can read every message here.
          </Text>
        </View>
      )}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.transcript}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.messageType === 'system') {
              return <Text style={styles.systemNote}>{item.body}</Text>;
            }
            const mine = String(item.senderId) === String(meId);
            return (
              <View style={[styles.bubbleRow, mine ? styles.alignEnd : styles.alignStart]}>
                <View style={styles.bubbleWrap}>
                  <View style={[styles.bubbleMeta, mine && styles.alignEnd]}>
                    <Text style={styles.sender}>{mine ? 'You' : item.senderName}</Text>
                    <Text style={styles.time}>
                      {new Date(item.sentAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {item.deletedAt ? (
                      <Text style={styles.withdrawn}>This message was withdrawn.</Text>
                    ) : item.undecryptable ? (
                      <View style={styles.inlineRow}>
                        <ShieldAlert size={14} color={palette.textSecondary} />
                        <Text style={styles.withdrawn}>This message could not be decrypted.</Text>
                      </View>
                    ) : (
                      <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
                    )}

                    {item.attachments.map((a) => (
                      <View key={a.id} style={styles.attachment}>
                        <Paperclip size={13} color={mine ? palette.text : palette.accent} />
                        <Text numberOfLines={1} style={[styles.attachmentName, mine && styles.bodyMine]}>
                          {a.fileName}
                        </Text>
                      </View>
                    ))}

                    {/* Where the document was filed — the sender should never
                        have to open the chart to find out. */}
                    {item.filings
                      .filter((f) => f.destination !== 'conversation')
                      .map((f, i) => (
                        <View key={`${f.destination}-${i}`} style={styles.filing}>
                          <FileCheck size={12} color={mine ? palette.text : palette.textSecondary} />
                          <Text style={[styles.filingText, mine && styles.bodyMine]}>
                            {FILING_LABEL[f.destination]}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        {pending && (
          <View style={styles.pending}>
            <Paperclip size={14} color={palette.textSecondary} />
            <View style={styles.fill}>
              <Text numberOfLines={1} style={styles.pendingName}>{pending.fileName}</Text>
              <Text style={styles.pendingNote}>
                {isPatient ? 'Will be added to your records' : 'Will be filed to Patient Records'}
              </Text>
            </View>
            <Pressable onPress={() => setPending(null)} accessibilityLabel="Remove attachment">
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composerRow}>
          <Pressable onPress={attach} accessibilityLabel="Attach a photo" style={styles.iconBtn}>
            <Camera size={21} color={palette.textSecondary} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a secure message…"
            placeholderTextColor={palette.textMuted}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={send}
            disabled={!canSend || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.sendBtn, !canSend && styles.sendBtnIdle]}
          >
            {sending ? <ActivityIndicator color={palette.text} /> : <Send size={19} color={palette.text} />}
          </Pressable>
        </View>

        <Text style={styles.composerNote}>
          {isPatient
            ? 'Documents you send are added to your records for your care team to review.'
            : 'Documents you send are filed to the patient chart.'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  backBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  subject: { ...type.lg, color: palette.text, fontWeight: '600' },
  participants: { ...type.xs, color: palette.textMuted, marginTop: 2 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: tint.warningSoft,
  },
  warningText: { ...type.xs, color: palette.warningText, flex: 1 },
  transcript: { padding: space.lg, gap: space.md },
  systemNote: { ...type.xs, color: palette.textFaint, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row' },
  alignEnd: { justifyContent: 'flex-end', alignSelf: 'flex-end' },
  alignStart: { justifyContent: 'flex-start' },
  bubbleWrap: { maxWidth: '82%' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: 4 },
  sender: { ...type.xs, color: palette.textStrong, fontWeight: '600' },
  time: { ...type.xs, color: palette.textMuted },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  bubbleMine: { backgroundColor: palette.accentTo },
  bubbleTheirs: { backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.border },
  body: { ...type.base, color: palette.textOnRaised },
  bodyMine: { color: palette.text },
  withdrawn: { ...type.base, color: palette.textSecondary, fontStyle: 'italic' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  attachmentName: { ...type.xs, color: palette.accent, flex: 1 },
  filing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filingText: { ...type.xs, color: palette.textSecondary },
  error: { ...type.sm, color: palette.danger, paddingHorizontal: space.lg, paddingBottom: space.sm },
  composer: {
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    backgroundColor: palette.surface,
    padding: space.md,
    gap: space.sm,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: palette.raised,
    borderRadius: radius.md,
    padding: space.sm,
  },
  pendingName: { ...type.xs, color: palette.text, fontWeight: '500' },
  pendingNote: { ...type.xs, color: palette.textMuted },
  remove: { ...type.xs, color: palette.accent },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
    paddingHorizontal: space.md,
    paddingTop: 12,
    color: palette.text,
    ...type.md,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.accentFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnIdle: { backgroundColor: palette.border },
  composerNote: { ...type.xs, color: palette.textFaint },
});
