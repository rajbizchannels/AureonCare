import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, FileWarning, X } from 'lucide-react-native';
import type { PendingReview } from '@/lib/api';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, SectionLabel } from '@/components/ui';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * The clinician's landing screen.
 *
 * The review queue is the part that matters: patient uploads that arrived
 * through secure messaging and that nobody has verified into the chart yet.
 * It renders only while something is waiting — an "all clear" panel would
 * spend a block of the screen saying nothing.
 */
export const StaffTodayScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter, isTablet } = useLayout();
  const [queue, setQueue] = useState<PendingReview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setQueue(await api.listPendingReviews(10));
      setError(null);
    } catch (e) {
      // An un-migrated server answers with an empty queue, so a failure here
      // is a real problem and worth showing rather than swallowing.
      setError(e instanceof Error ? e.message : 'Could not load the review queue.');
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useCallback(
    async (record: PendingReview, decision: 'accepted' | 'rejected') => {
      setBusyId(record.id);
      try {
        await api.reviewDocument(record.id, decision);
        // Drop it locally rather than refetching: the row is gone either way
        // and the queue should not flicker while the request settles.
        setQueue((rows) => rows.filter((r) => r.id !== record.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record that decision.');
      } finally {
        setBusyId(null);
      }
    },
    [api]
  );

  const name = [account?.firstName, account?.lastName].filter(Boolean).join(' ') || 'there';

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={palette.accent}
        />
      }
    >
      <View>
        <Text style={styles.greeting}>Good morning, {name}</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {queue.length > 0 && (
        <Card style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <View style={styles.queueIcon}>
              <FileWarning size={18} color={palette.warningText} />
            </View>
            <View style={styles.fill}>
              <Text style={styles.queueTitle}>Patient uploads awaiting review</Text>
              <Text style={styles.queueHint}>Sent through secure messaging</Text>
            </View>
            <Chip label={String(queue.length)} tone="warning" />
          </View>

          <View style={styles.queueRows}>
            {queue.map((record) => (
              <View
                key={record.id}
                style={[styles.queueRow, isTablet && styles.queueRowWide]}
              >
                <View style={styles.fill}>
                  <Text numberOfLines={1} style={styles.fileName}>{record.title}</Text>
                  <Text style={styles.fileMeta}>
                    {[record.patient_name, record.patient_mrn].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                <View style={styles.queueActions}>
                  {/* Accept sits after the file name, never before a chance to
                      read it — reviewing means reading, not rubber-stamping. */}
                  <Pressable
                    onPress={() => void review(record, 'accepted')}
                    disabled={busyId === record.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Accept ${record.title}`}
                    style={styles.accept}
                  >
                    {busyId === record.id ? (
                      <ActivityIndicator color={palette.text} size="small" />
                    ) : (
                      <>
                        <Check size={13} color={palette.text} />
                        <Text style={styles.acceptLabel}>Accept</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => void review(record, 'rejected')}
                    disabled={busyId === record.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${record.title}`}
                    style={styles.reject}
                  >
                    <X size={14} color={palette.textSecondary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View style={styles.section}>
        <SectionLabel>Next up</SectionLabel>
        <Card>
          <Text style={styles.placeholder}>
            Today&apos;s appointments appear here once the schedule endpoint is wired.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  content: { paddingVertical: space.lg, gap: space.lg, backgroundColor: palette.bg },
  greeting: { ...type.display, color: palette.text, fontWeight: '700', letterSpacing: -0.3 },
  date: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  error: { ...type.sm, color: palette.danger },
  queueCard: { borderColor: tint.warningBorder },
  queueHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  queueIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: tint.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueTitle: { ...type.base, color: palette.text, fontWeight: '600' },
  queueHint: { ...type.xs, color: palette.textSecondary, marginTop: 2 },
  queueRows: { gap: space.sm },
  queueRow: {
    backgroundColor: 'rgba(30,41,59,0.55)',
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
  // Phones stack the row; tablets have the width to put actions inline.
  queueRowWide: { flexDirection: 'row', alignItems: 'center' },
  fileName: { ...type.sm, color: palette.text, fontWeight: '600' },
  fileMeta: { ...type.xs, color: palette.textSecondary, marginTop: 2 },
  queueActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  accept: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: palette.accentFrom,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  acceptLabel: { ...type.xs, color: palette.text, fontWeight: '600' },
  reject: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: tint.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: space.sm },
  placeholder: { ...type.base, color: palette.textSecondary },
});
