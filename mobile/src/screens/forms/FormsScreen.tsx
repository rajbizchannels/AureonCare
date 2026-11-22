import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ClipboardList, FileSignature } from 'lucide-react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate } from '@/lib/useResource';
import { Chip, EmptyState, ErrorNote, Loading, Segmented } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';
import type { FormSubmission } from '@/lib/api';

/**
 * Forms, from both sides of the desk.
 *
 * A patient sees what they have been asked for and can acknowledge a document
 * they have read. Staff see the same queue across patients, to know what is
 * still outstanding before a clinic starts.
 *
 * Template forms are filled in on the device (FormFillScreen): the renderer
 * draws every field type the web renderer does — sections, show-when
 * conditions, role-visible fields, signatures — and the server checks each
 * submission against the template, so nothing incomplete gets through.
 * Documents to read are acknowledged here; documents to sign need the web app.
 */

type Filter = 'outstanding' | 'all';

const OUTSTANDING = new Set(['pending', 'requested', 'sent', 'in_progress', 'draft']);

const isOutstanding = (form: FormSubmission): boolean =>
  OUTSTANDING.has(String(form.status ?? '').toLowerCase());

export const FormsScreen: React.FC = () => {
  const { api, account, isPatient } = useSession();
  const { gutter } = useLayout();
  const [filter, setFilter] = useState<Filter>('outstanding');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A patient reads their own; staff read the practice's queue. The client
  // picks the portal or the staff route from the credential it holds.
  const patientId = isPatient ? account?.id : undefined;
  const navigation = useNavigation();
  // Refetch when coming back from filling one in, so it moves out of Outstanding.
  const focused = useIsFocused();
  const forms = useResource(() => api.listFormSubmissions(patientId), [api, patientId, focused]);

  const rows = useMemo(() => {
    const all = forms.data ?? [];
    return filter === 'outstanding' ? all.filter(isOutstanding) : all;
  }, [forms.data, filter]);

  const outstandingCount = useMemo(
    () => (forms.data ?? []).filter(isOutstanding).length,
    [forms.data]
  );

  const acknowledge = useCallback(
    async (form: FormSubmission) => {
      setWorking(form.id);
      setError(null);
      try {
        await api.acknowledgeForm(form.id, patientId);
        await forms.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record that.');
      } finally {
        setWorking(null);
      }
    },
    [api, forms, patientId]
  );

  if (forms.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'outstanding', label: 'Outstanding', badge: outstandingCount },
            { value: 'all', label: 'All' },
          ]}
        />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={error} />
        </View>
      ) : null}
      {forms.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={forms.error} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(f) => f.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={forms.refreshing}
            onRefresh={forms.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<ClipboardList size={36} color={palette.textFaint} />}
            title={filter === 'outstanding' ? 'Nothing outstanding' : 'No forms'}
            hint={
              isPatient
                ? 'Forms your practice asks you to complete appear here.'
                : 'Forms requested from patients appear here as they are sent.'
            }
          />
        }
        renderItem={({ item }) => {
          const name = item.template_name ?? item.document_name ?? 'Form';
          const isDocument = Boolean(item.document_attachment_id);
          const needsSignature = item.document_action === 'sign';
          const pending = isOutstanding(item);

          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text numberOfLines={2} style={styles.title}>
                  {name}
                </Text>
                <Chip
                  label={String(item.status ?? 'pending').replace(/_/g, ' ')}
                  tone={pending ? 'warning' : 'success'}
                />
              </View>

              <Text style={styles.meta}>
                {[
                  !isPatient && item.patient_name ? item.patient_name : null,
                  item.mrn && !isPatient ? item.mrn : null,
                  `Requested ${formatDate(item.created_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {pending ? (
                <View style={styles.actions}>
                  {isDocument && !needsSignature ? (
                    <Pressable
                      onPress={() => acknowledge(item)}
                      disabled={working === item.id}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.action,
                        (pressed || working === item.id) && styles.pressed,
                      ]}
                    >
                      <Text style={styles.actionLabel}>
                        {isPatient ? 'I have read this' : 'Mark acknowledged'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Template forms are filled in here (FormFillScreen renders every
                      field type the web does, and the server checks the answers). A
                      document that must be signed still needs the web app. */}
                  {!isDocument ? (
                    <Pressable
                      onPress={() => (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate('FormFill', { submissionId: item.id })}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                    >
                      <Text style={styles.actionLabel}>{isPatient ? 'Fill in' : 'Fill in with the patient'}</Text>
                    </Pressable>
                  ) : null}
                  {needsSignature ? (
                    <View style={styles.webNote}>
                      <FileSignature size={13} color={palette.textMuted} />
                      <Text style={styles.webNoteText}>Needs a signature — open the web app to sign.</Text>
                    </View>
                  ) : null}
                </View>
              ) : item.submitted_at ? (
                <Text style={styles.meta}>Completed {formatDate(item.submitted_at)}</Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  row: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: space.xs,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { ...type.md, color: palette.text, fontWeight: '600', flex: 1 },
  meta: { ...type.xs, color: palette.textSecondary },
  actions: { gap: space.sm, marginTop: space.xs },
  action: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.accentFrom,
    paddingHorizontal: space.lg,
  },
  actionLabel: { ...type.sm, color: palette.text, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  webNote: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  webNoteText: { ...type.xs, color: palette.textMuted, flex: 1 },
});
