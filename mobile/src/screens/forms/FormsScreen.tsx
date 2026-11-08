import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ClipboardList, FileSignature, ExternalLink } from 'lucide-react-native';
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
 * Filling in a *template* form is deliberately absent. The web builder
 * supports conditional fields, repeating groups and typed validation
 * (`form-management.js`); a mobile renderer that handled some of that and
 * silently dropped the rest would produce submissions that look complete and
 * are not. Document-backed requests — read this, confirm you have — are fully
 * handled here, because those are the ones that actually hold a visit up.
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
  const forms = useResource(() => api.listFormSubmissions(patientId), [api, patientId]);

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

                  {/* Signing and template forms both need the web app. Saying
                      so beats a button that opens a screen which cannot finish
                      the job. */}
                  {needsSignature || !isDocument ? (
                    <View style={styles.webNote}>
                      {needsSignature ? (
                        <FileSignature size={13} color={palette.textMuted} />
                      ) : (
                        <ExternalLink size={13} color={palette.textMuted} />
                      )}
                      <Text style={styles.webNoteText}>
                        {needsSignature
                          ? 'Needs a signature — open the web app to sign.'
                          : 'Complete this one in the web app.'}
                      </Text>
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
