import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { FileText, Printer, Send, X } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Field, Loading, PrimaryButton, SectionLabel, Segmented } from '@/components/ui';
import { useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { printPdf } from '@/lib/print';
import {
  ADJUSTMENT_LABELS, PURPOSE_LABELS, REQUEST_STATUS, blankRequest, dateRange, requestProblem, summary,
  type Purpose, type RequestDraft, type SickNote, type SickNoteRequest,
} from '@/lib/sickNotes';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * The patient's sick notes, and asking for one.
 *
 * "Request a sick note" sends the dates, purpose and reason to the practice; a clinician
 * issues or declines it and the patient is emailed either way. One request can be open at a
 * time and can be cancelled while it waits. Issued notes open in the phone's print sheet
 * (save as PDF / share from there). A voided note stays listed, marked.
 */
export const PatientSickNotesScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter, maxContentWidth } = useLayout();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [draft, setDraft] = useState<RequestDraft | null>(null);

  const data = useResource<{ notes: SickNote[]; requests: SickNoteRequest[] }>(async () => {
    if (!account) return { notes: [], requests: [] };
    const [notes, requests] = await Promise.all([
      api.listMySickNotes(account.id),
      api.listMySickNoteRequests(account.id).catch(() => [] as SickNoteRequest[]),
    ]);
    return { notes, requests };
  }, [api, account?.id]);

  const print = useCallback(async (n: SickNote) => {
    if (!account) return;
    setBusyId(n.id); setError(null);
    try { await printPdf(api.sickNotePdfSource(n.id, account.id), `sick-note-${n.reference}.pdf`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open that sick note.'); }
    finally { setBusyId(null); }
  }, [api, account]);

  const send = useCallback(async () => {
    if (!account || !draft || busyId) return;
    const problem = requestProblem(draft);
    if (problem) { setError(problem); return; }
    setBusyId('send'); setError(null);
    try {
      await api.requestSickNote(account.id, { ...draft, reason: draft.reason.trim() });
      setDraft(null);
      setInfo('Request sent. Your clinician will review it and you will get an email.');
      await data.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request.');
    } finally {
      setBusyId(null);
    }
  }, [api, account, draft, busyId, data]);

  const cancel = useCallback(async (r: SickNoteRequest) => {
    if (!account) return;
    setBusyId(r.id); setError(null);
    try { await api.cancelSickNoteRequest(account.id, r.id); setInfo('Request cancelled.'); await data.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel the request.'); }
    finally { setBusyId(null); }
  }, [api, account, data]);

  if (data.loading) return <Loading />;
  const notes = data.data?.notes ?? [];
  const requests = data.data?.requests ?? [];
  const pending = requests.find((r) => r.status === 'pending');
  const set = (patch: Partial<RequestDraft>) => { setError(null); setDraft((d) => (d ? { ...d, ...patch } : d)); };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={palette.accent} />}
      >
        {data.error ? <ErrorNote message={data.error} /> : null}
        {error ? <ErrorNote message={error} /> : null}
        {info && !error ? <Text style={styles.info} accessibilityLiveRegion="polite">{info}</Text> : null}

        {/* ── asking for one ── */}
        {!draft && !pending ? (
          <Card style={styles.askCard}>
            <Text style={styles.askTitle}>Need a sick note?</Text>
            <Text style={styles.meta}>Ask your practice. A clinician reviews every request and may ask you to book an appointment.</Text>
            <PrimaryButton label="Request a sick note" icon={<Send size={16} color={palette.text} />}
              onPress={() => { setInfo(null); setDraft(blankRequest()); }} />
          </Card>
        ) : null}

        {draft ? (
          <Card style={styles.form}>
            <SectionLabel>Request a sick note</SectionLabel>
            <Text style={styles.label}>For</Text>
            <Segmented<Purpose>
              value={draft.purpose}
              onChange={(v) => set({ purpose: v })}
              options={[{ value: 'work', label: 'Work' }, { value: 'school', label: 'School' }, { value: 'other', label: 'Other' }]}
            />
            <View style={styles.dates}>
              <Field style={styles.grow} label="First day" value={draft.startDate} onChangeText={(v) => set({ startDate: v })} autoCapitalize="none" placeholder="YYYY-MM-DD" />
              <Field style={styles.grow} label="Last day" value={draft.endDate} onChangeText={(v) => set({ endDate: v })} autoCapitalize="none" placeholder="YYYY-MM-DD" />
            </View>
            <Text style={styles.label}>Why do you need it?</Text>
            <TextInput value={draft.reason} onChangeText={(v) => set({ reason: v })} multiline maxLength={1000} style={styles.textarea}
              placeholder="For example: flu with a high temperature since Saturday, can't work." placeholderTextColor={palette.textMuted}
              accessibilityLabel="Why do you need it?" />
            <Text style={styles.hint}>Only your practice sees this. It can go back up to 14 days and start up to 30 days ahead.</Text>
            <PrimaryButton label="Send request" onPress={() => void send()} busy={busyId === 'send'} />
            <Pressable onPress={() => setDraft(null)} accessibilityRole="button" style={styles.cancelRow}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </Card>
        ) : null}

        {requests.length ? <SectionLabel>Your requests</SectionLabel> : null}
        {requests.slice(0, 5).map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.headRow}>
              <Text style={styles.title}>{PURPOSE_LABELS[r.purpose]} · {dateRange(r.startDate, r.endDate, r.days)}</Text>
              <Chip label={REQUEST_STATUS[r.status]} tone={r.status === 'pending' ? 'warning' : r.status === 'issued' ? 'success' : r.status === 'declined' ? 'danger' : 'neutral'} />
            </View>
            {r.status === 'declined' && r.decisionReason ? <Text style={styles.meta}>Clinician’s note: {r.decisionReason}</Text> : null}
            {r.status === 'pending' ? (
              <Pressable onPress={() => void cancel(r)} accessibilityRole="button" style={styles.action} disabled={busyId === r.id}>
                <X size={16} color={palette.textSecondary} />
                <Text style={styles.cancelText}>{busyId === r.id ? 'Cancelling…' : 'Cancel request'}</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}

        {/* ── issued notes ── */}
        <SectionLabel>Your sick notes</SectionLabel>
        {notes.length === 0 ? (
          <EmptyState icon={<FileText size={34} color={palette.textFaint} />} title="No sick notes" hint="Sick notes your practice issues will appear here." />
        ) : null}
        {notes.map((item) => (
          <Card key={item.id} style={[styles.card, item.status === 'voided' && styles.voided]}>
            <View style={styles.headRow}>
              <Text style={styles.title}>{summary(item)}</Text>
              {item.status === 'voided' ? <Chip label="Void" tone="danger" /> : null}
            </View>
            <Text style={styles.meta}>{item.reference} · {item.issuerName}</Text>
            {item.adjustments.length ? <Text style={styles.meta}>{item.adjustments.map((a) => ADJUSTMENT_LABELS[a] ?? a).join(', ')}</Text> : null}
            {item.status === 'voided' && item.voidReason ? <Text style={styles.voidReason}>Voided: {item.voidReason}</Text> : null}
            <Pressable onPress={() => void print(item)} accessibilityRole="button" style={styles.action} disabled={busyId === item.id}>
              <Printer size={16} color={palette.accent} />
              <Text style={styles.actionText}>{busyId === item.id ? 'Opening…' : 'View / print'}</Text>
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  info: { ...type.sm, color: palette.successText },
  askCard: { gap: space.sm },
  askTitle: { ...type.md, color: palette.text, fontWeight: '600' },
  form: { gap: space.sm },
  label: { ...type.sm, color: palette.textStrong },
  dates: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  textarea: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, color: palette.text, padding: space.md, textAlignVertical: 'top', ...type.md },
  hint: { ...type.xs, color: palette.textMuted },
  cancelRow: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...type.sm, color: palette.textSecondary },
  card: { gap: space.xs },
  voided: { opacity: 0.7 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  title: { ...type.md, color: palette.text, fontWeight: '600', flex: 1 },
  meta: { ...type.sm, color: palette.textSecondary },
  voidReason: { ...type.sm, color: palette.danger },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, marginTop: space.xs },
  actionText: { ...type.sm, color: palette.accent, fontWeight: '600' },
});
