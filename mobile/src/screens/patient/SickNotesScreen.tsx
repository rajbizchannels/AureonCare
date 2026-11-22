import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FileText, Printer } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { printDocument } from '@/lib/print';
import { ADJUSTMENT_LABELS, summary, type SickNote } from '@/lib/sickNotes';
import { palette, space, type } from '@/theme/tokens';

/**
 * The patient's sick notes, as issued by their practice. "View / print" opens the phone's
 * print sheet with the same certificate the practice prints (it can be saved as a PDF and
 * shared with an employer from there). A voided note stays listed, marked, so the patient
 * knows not to use it.
 */
export const PatientSickNotesScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter } = useLayout();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  const notes = useResource<SickNote[]>(
    () => (account ? api.listMySickNotes(account.id) : Promise.resolve([])),
    [api, account?.id]
  );

  const print = useCallback(async (n: SickNote) => {
    if (!account) return;
    setBusyId(n.id);
    setPrintError(null);
    try {
      const doc = await api.getMySickNoteDocument(account.id, n.id);
      await printDocument(doc.html);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Could not open that sick note.');
    } finally {
      setBusyId(null);
    }
  }, [api, account]);

  if (notes.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      {(notes.error || printError) ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
          <ErrorNote message={notes.error ?? printError ?? ''} />
        </View>
      ) : null}
      <FlatList
        data={notes.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={<RefreshControl refreshing={notes.refreshing} onRefresh={notes.refresh} tintColor={palette.accent} />}
        ListEmptyComponent={
          <EmptyState icon={<FileText size={34} color={palette.textFaint} />} title="No sick notes"
            hint="Sick notes your practice issues will appear here." />
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, item.status === 'voided' && styles.voided]}>
            <View style={styles.headRow}>
              <Text style={styles.title}>{summary(item)}</Text>
              {item.status === 'voided' ? <Chip label="Void" tone="danger" /> : null}
            </View>
            <Text style={styles.meta}>{item.reference} · {item.issuerName}</Text>
            {item.adjustments.length ? (
              <Text style={styles.meta}>{item.adjustments.map((a) => ADJUSTMENT_LABELS[a] ?? a).join(', ')}</Text>
            ) : null}
            {item.status === 'voided' && item.voidReason ? <Text style={styles.voidReason}>Voided: {item.voidReason}</Text> : null}
            <Pressable onPress={() => void print(item)} accessibilityRole="button" style={styles.action} disabled={busyId === item.id}>
              <Printer size={16} color={palette.accent} />
              <Text style={styles.actionText}>{busyId === item.id ? 'Opening…' : 'View / print'}</Text>
            </Pressable>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  list: { paddingVertical: space.md, gap: space.sm },
  card: { gap: space.xs },
  voided: { opacity: 0.7 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  title: { ...type.md, color: palette.text, fontWeight: '600', flex: 1 },
  meta: { ...type.sm, color: palette.textSecondary },
  voidReason: { ...type.sm, color: palette.danger },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, marginTop: space.xs },
  actionText: { ...type.sm, color: palette.accent, fontWeight: '600' },
});
