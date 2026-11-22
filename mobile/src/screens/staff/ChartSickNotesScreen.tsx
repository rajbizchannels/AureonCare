import React, { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ban, FileText, Mail, Plus, Printer } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useActivePatient } from '@/context/ActivePatientContext';
import { Card, Chip, EmptyState, ErrorNote, Field, Loading, PrimaryButton, SectionLabel, Segmented } from '@/components/ui';
import { fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { printPdf } from '@/lib/print';
import {
  ADJUSTMENT_LABELS, PURPOSE_LABELS, blankDraft, dateRange, dayCount, draftFromRequest, draftProblem, plusDays, summary, toRequest,
  type Draft, type Fitness, type Purpose, type SickNote, type SickNoteRequest,
} from '@/lib/sickNotes';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * Sick notes for the patient open in Chart. Clinicians (doctors, nurses, or an admin who is
 * a provider — the server decides) issue one; anyone with access can print or email one.
 * Notes are never edited: a wrong one is voided with a reason and a new one issued.
 */
export const ChartSickNotesScreen: React.FC = () => {
  const { api } = useSession();
  const { patient } = useActivePatient();
  const { gutter, maxContentWidth } = useLayout();
  const id = patient?.id;
  const data = useResource(
    () => (id ? api.listSickNotes(id) : Promise.resolve(null)),
    [api, id]
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const set = (patch: Partial<Draft>) => { setError(null); setDraft((d) => (d ? { ...d, ...patch } : d)); };

  const print = useCallback(async (noteId: string, reference = 'sick-note') => {
    setBusy(noteId); setError(null);
    try { await printPdf(api.sickNotePdfSource(noteId), `sick-note-${reference}.pdf`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open the note.'); }
    finally { setBusy(null); }
  }, [api]);

  const issue = useCallback(async () => {
    if (!draft || !id || busy) return;
    const problem = draftProblem(draft);
    if (problem) { setError(problem); return; }
    setBusy('issue'); setError(null);
    try {
      const { note } = await api.issueSickNote(toRequest(id, draft));
      setDraft(null);
      setInfo(draft.requestId ? `Sick note ${note.reference} issued; the patient has been told.` : `Sick note ${note.reference} issued.`);
      await data.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue the sick note.');
    } finally {
      setBusy(null);
    }
  }, [api, draft, id, busy, data, print]);

  const email = useCallback(async (noteId: string) => {
    setBusy(noteId); setError(null);
    try { const r = await api.emailSickNote(noteId); setInfo(`Emailed to ${r.to}.`); await data.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not email the note.'); }
    finally { setBusy(null); }
  }, [api, data]);

  const voidNote = useCallback((n: SickNote) => {
    // Alert.prompt is iOS-only; a fixed list of common reasons works everywhere.
    const go = async (reason: string) => {
      setBusy(n.id); setError(null);
      try { await api.voidSickNote(n.id, reason); setInfo(`Sick note ${n.reference} voided.`); await data.reload(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not void the note.'); }
      finally { setBusy(null); }
    };
    Alert.alert('Void this sick note?', `${n.reference} will be marked void. Issue a new one if needed.`, [
      { text: 'Wrong dates', onPress: () => void go('Wrong dates') },
      { text: 'Wrong patient', onPress: () => void go('Wrong patient') },
      { text: 'Issued in error', onPress: () => void go('Issued in error') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [api, data]);

  const declineRequest = useCallback((r: SickNoteRequest) => {
    // The patient sees this reason (and gets it by email). Alert.prompt is iOS-only, so a
    // short list of the usual answers works on every phone.
    const go = async (reason: string) => {
      setBusy(r.id); setError(null);
      try { await api.declineSickNoteRequest(r.id, reason); setInfo('Request declined; the patient has been told.'); await data.reload(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not decline the request.'); }
      finally { setBusy(null); }
    };
    Alert.alert('Decline this request?', 'The patient will be emailed the reason you choose.', [
      { text: 'Please book an appointment', onPress: () => void go('Please book an appointment so we can assess you.') },
      { text: 'Dates need discussing', onPress: () => void go('The dates need discussing — please contact the practice.') },
      { text: 'Not appropriate', onPress: () => void go('A sick note is not appropriate for this — please contact the practice.') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [api, data]);

  if (!patient) {
    return <EmptyState icon={<FileText size={34} color={palette.textFaint} />} title="No patient selected" hint="Choose someone in Patients first." />;
  }
  if (data.loading) return <Loading />;
  const notes = data.data?.notes ?? [];
  const canIssue = Boolean(data.data?.canIssue);
  const days = draft ? dayCount(draft.startDate, draft.endDate) : null;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={palette.accent} />}
      >
        <Text style={styles.patient}>{fullName(patient.first_name, patient.last_name)}</Text>
        {data.error ? <ErrorNote message={data.error} /> : null}
        {error ? <ErrorNote message={error} /> : null}
        {info && !error ? <Text style={styles.info}>{info}</Text> : null}

        {(data.data?.requests ?? []).filter((r) => r.status === 'pending').map((r) => (
          <Card key={r.id} style={styles.request}>
            <Text style={styles.noteTitle}>Requested: {PURPOSE_LABELS[r.purpose]} · {dateRange(r.startDate, r.endDate, r.days)}</Text>
            <Text style={styles.meta}>“{r.reason}”</Text>
            {canIssue ? (
              <View style={styles.actions}>
                <Action icon={<Plus size={16} color={palette.accent} />} label="Issue from request" disabled={Boolean(draft) || busy === r.id}
                  onPress={() => { setInfo(null); setDraft(draftFromRequest(r)); }} />
                <Action icon={<Ban size={16} color={palette.danger} />} label="Decline" danger disabled={busy === r.id} onPress={() => declineRequest(r)} />
              </View>
            ) : <Text style={styles.hint}>A clinician will review this request.</Text>}
          </Card>
        ))}

        {canIssue && !draft ? (
          <PrimaryButton label="Issue sick note" icon={<Plus size={16} color={palette.text} />} onPress={() => { setInfo(null); setDraft(blankDraft()); }} />
        ) : null}
        {!canIssue ? <Text style={styles.hint}>Only a clinician can issue sick notes. You can print or email existing ones.</Text> : null}

        {draft ? (
          <Card style={styles.form}>
            <SectionLabel>{draft.requestId ? 'Answering the patient’s request' : 'New sick note'}</SectionLabel>
            <Text style={styles.label}>For</Text>
            <Segmented<Purpose>
              value={draft.purpose}
              onChange={(v) => set({ purpose: v })}
              options={[{ value: 'work', label: 'Work' }, { value: 'school', label: 'School' }, { value: 'other', label: 'Other' }]}
            />
            <Text style={styles.label}>Advice</Text>
            <Segmented<Fitness>
              value={draft.fitness}
              onChange={(v) => set({ fitness: v })}
              options={[{ value: 'not_fit', label: 'Not fit' }, { value: 'may_be_fit', label: 'May be fit' }]}
            />
            {draft.fitness === 'may_be_fit' ? (
              <View style={styles.adjustments}>
                {Object.entries(ADJUSTMENT_LABELS).map(([k, label]) => (
                  <View key={k} style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{label}</Text>
                    <Switch
                      value={draft.adjustments.includes(k)}
                      onValueChange={(on) => set({ adjustments: on ? [...draft.adjustments, k] : draft.adjustments.filter((a) => a !== k) })}
                      accessibilityLabel={label}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            <Field label="Assessed on (YYYY-MM-DD)" value={draft.assessedOn} onChangeText={(v) => set({ assessedOn: v })} autoCapitalize="none" />
            <View style={styles.dates}>
              <Field style={styles.grow} label="From" value={draft.startDate} onChangeText={(v) => set({ startDate: v })} autoCapitalize="none" />
              <Field style={styles.grow} label="To" value={draft.endDate} onChangeText={(v) => set({ endDate: v })} autoCapitalize="none" />
            </View>
            <View style={styles.quick}>
              <Text style={styles.hint}>{days ? `${days} day${days === 1 ? '' : 's'}` : 'Check the dates'} · quick:</Text>
              {[3, 7, 14, 28].map((n) => (
                <Pressable key={n} onPress={() => set({ endDate: plusDays(draft.startDate, n - 1) })} style={styles.quickBtn} accessibilityRole="button">
                  <Text style={styles.quickText}>{n} days</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Condition, as written on the note" value={draft.conditionText} onChangeText={(v) => set({ conditionText: v })}
              hint="Leave blank to print “A medical condition”. Only write a diagnosis the patient agreed to share." />
            <Text style={styles.label}>Comments</Text>
            <TextInput value={draft.comments} onChangeText={(v) => set({ comments: v })} multiline style={styles.textarea}
              placeholder={draft.fitness === 'may_be_fit' ? 'Advice on what they can do' : 'Optional'} placeholderTextColor={palette.textMuted} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Review needed at the end of this period</Text>
              <Switch value={draft.followUp} onValueChange={(v) => set({ followUp: v })} accessibilityLabel="Review needed" />
            </View>
            <PrimaryButton label="Issue" onPress={() => void issue()} busy={busy === 'issue'} />
            <Pressable onPress={() => setDraft(null)} accessibilityRole="button" style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </Card>
        ) : null}

        {notes.length === 0 && !draft ? <EmptyState title="No sick notes yet" /> : null}
        {notes.map((n) => (
          <Card key={n.id} style={[styles.note, n.status === 'voided' && styles.voided]}>
            <View style={styles.headRow}>
              <Text style={styles.noteTitle}>{summary(n)}</Text>
              {n.status === 'voided' ? <Chip label="Void" tone="danger" /> : null}
            </View>
            <Text style={styles.meta}>{[n.reference, n.issuerName, n.conditionText, n.emailedAt ? 'emailed' : null].filter(Boolean).join(' · ')}</Text>
            {n.status === 'voided' && n.voidReason ? <Text style={styles.voidReason}>Voided: {n.voidReason}</Text> : null}
            <View style={styles.actions}>
              <Action icon={<Printer size={16} color={palette.accent} />} label="Print" onPress={() => void print(n.id, n.reference)} disabled={busy === n.id} />
              {n.status === 'issued' ? (
                <>
                  <Action icon={<Mail size={16} color={palette.accent} />} label="Email" onPress={() => void email(n.id)} disabled={busy === n.id} />
                  <Action icon={<Ban size={16} color={palette.danger} />} label="Void" danger onPress={() => voidNote(n)} disabled={busy === n.id} />
                </>
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const Action: React.FC<{ icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }> = ({ icon, label, onPress, disabled, danger }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={styles.action}>
    {icon}
    <Text style={[styles.actionText, danger && { color: palette.danger }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  patient: { ...type.lg, color: palette.text, fontWeight: '700' },
  info: { ...type.sm, color: palette.successText },
  hint: { ...type.xs, color: palette.textMuted },
  form: { gap: space.sm },
  label: { ...type.sm, color: palette.textStrong },
  adjustments: { gap: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 40 },
  switchLabel: { ...type.sm, color: palette.text, flex: 1 },
  dates: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  quickBtn: { paddingHorizontal: space.sm, minHeight: 32, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: palette.border },
  quickText: { ...type.xs, color: palette.textSecondary },
  textarea: { minHeight: 80, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, color: palette.text, padding: space.md, textAlignVertical: 'top', ...type.md },
  cancel: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...type.sm, color: palette.textSecondary },
  note: { gap: space.xs },
  request: { gap: space.xs, borderColor: palette.warningText },
  voided: { opacity: 0.7 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  noteTitle: { ...type.md, color: palette.text, fontWeight: '600', flex: 1 },
  meta: { ...type.sm, color: palette.textSecondary },
  voidReason: { ...type.sm, color: palette.danger },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40 },
  actionText: { ...type.sm, color: palette.accent, fontWeight: '600' },
});
