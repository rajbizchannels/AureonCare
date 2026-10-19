import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, FileWarning, ListTodo, Tent, X } from 'lucide-react-native';
import type { Appointment, Camp, PendingReview, Task } from '@/lib/api';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, SectionLabel } from '@/components/ui';
import { useLayout } from '@/lib/device';
import { canUseCamps } from '@/lib/permissions';
import { formatTime, fullName, isToday } from '@/lib/useResource';
import { hasLiveBoard } from '@/lib/camps';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * The staff landing screen, composed from what this account may actually see.
 *
 * Four roles share this screen and get four different days out of it. A
 * clinician opens on the review queue and their list; a receptionist has no
 * `ehr.view` so the queue is not merely empty for them, it is not requested —
 * asking would 403 and paint a red error across the first thing they see each
 * morning.
 *
 * Every section is both capability-gated and empty-gated: nothing renders a
 * panel to say it has nothing to say.
 */
export const StaffTodayScreen: React.FC = () => {
  const { api, account, role, can } = useSession();
  const { gutter, isTablet } = useLayout();

  const mayReview = can('ehr');
  const maySeeSchedule = can('appointments');
  const maySeeTasks = can('practiceManagement');
  const maySeeCamps = canUseCamps(role);

  const [queue, setQueue] = useState<PendingReview[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Four independent reads, settled together.
   *
   * `allSettled` rather than `all`: a practice on a plan without camps gets a
   * 402 from that one endpoint, and one gated feature must not blank the
   * other three sections.
   */
  const load = useCallback(async () => {
    const [reviews, appts, taskRows, campRows] = await Promise.allSettled([
      mayReview ? api.listPendingReviews(10) : Promise.resolve([]),
      maySeeSchedule ? api.listAppointments() : Promise.resolve([]),
      maySeeTasks ? api.listTasks() : Promise.resolve([]),
      maySeeCamps ? api.listCamps({ status: 'in_progress' }) : Promise.resolve([]),
    ]);

    if (reviews.status === 'fulfilled') setQueue(reviews.value);
    if (appts.status === 'fulfilled') setAppointments(appts.value);
    if (taskRows.status === 'fulfilled') setTasks(taskRows.value);
    if (campRows.status === 'fulfilled') setCamps(campRows.value);

    // Only the two that define the screen are worth interrupting it for.
    const broke = [reviews, appts].find((r) => r.status === 'rejected');
    setError(
      broke && broke.status === 'rejected'
        ? broke.reason instanceof Error
          ? broke.reason.message
          : 'Could not load today.'
        : null
    );
    setRefreshing(false);
  }, [api, mayReview, maySeeSchedule, maySeeTasks, maySeeCamps]);

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

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => isToday(a.start_time))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [appointments]
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => !/^(completed|complete|done|closed|cancelled)$/i.test(String(t.status ?? ''))),
    [tasks]
  );

  const running = useMemo(() => camps.filter(hasLiveBoard), [camps]);

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

      {/* A camp in progress outranks everything else on the screen: somebody is
          standing in a field with a queue in front of them. */}
      {running.length > 0 && (
        <Card style={styles.campCard}>
          <View style={styles.rowHeader}>
            <View style={[styles.icon, { backgroundColor: tint.successSoft }]}>
              <Tent size={17} color={palette.success} />
            </View>
            <View style={styles.fill}>
              <Text style={styles.queueTitle}>
                {running.length === 1 ? running[0]?.name : `${running.length} camps running`}
              </Text>
              <Text style={styles.queueHint}>
                {running.length === 1
                  ? `${running[0]?.registrationCount ?? 0} registered${running[0]?.locationName ? ` · ${running[0].locationName}` : ''}`
                  : 'Open Camps to run a desk or watch a board'}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {mayReview && queue.length > 0 && (
        <Card style={styles.queueCard}>
          <View style={styles.rowHeader}>
            <View style={[styles.icon, { backgroundColor: tint.warningSoft }]}>
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

      {maySeeSchedule && (
        <View style={styles.section}>
          <SectionLabel>Next up</SectionLabel>
          <Card style={todays.length ? styles.listCard : undefined}>
            {todays.length === 0 ? (
              <Text style={styles.placeholder}>Nothing booked for today.</Text>
            ) : (
              todays.slice(0, 6).map((appointment, index) => (
                <View
                  key={appointment.id}
                  style={[styles.apptRow, index > 0 && styles.apptRowDivided]}
                >
                  <Text style={styles.apptTime}>{formatTime(appointment.start_time)}</Text>
                  <View style={styles.fill}>
                    <Text numberOfLines={1} style={styles.apptTitle}>
                      {appointment.reason ?? appointment.appointment_type ?? 'Appointment'}
                    </Text>
                    {appointment.provider ? (
                      <Text numberOfLines={1} style={styles.fileMeta}>
                        {fullName(
                          appointment.provider.first_name,
                          appointment.provider.last_name,
                          'Unassigned'
                        )}
                      </Text>
                    ) : null}
                  </View>
                  <Chip label={appointment.status} tone="neutral" />
                </View>
              ))
            )}
          </Card>
          {todays.length > 6 ? (
            <Text style={styles.more}>and {todays.length - 6} more in Schedule</Text>
          ) : null}
        </View>
      )}

      {maySeeTasks && openTasks.length > 0 && (
        <Card style={styles.rowHeader}>
          <View style={[styles.icon, { backgroundColor: tint.accentSoft }]}>
            <ListTodo size={17} color={palette.accent} />
          </View>
          <View style={styles.fill}>
            <Text style={styles.queueTitle}>
              {openTasks.length} open task{openTasks.length === 1 ? '' : 's'}
            </Text>
            <Text style={styles.queueHint}>Open Tasks from More to work through them</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  content: { paddingVertical: space.lg, gap: space.lg, backgroundColor: palette.bg },
  greeting: { ...type.display, color: palette.text, fontWeight: '700', letterSpacing: -0.3 },
  date: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  error: { ...type.sm, color: palette.danger },
  campCard: { borderColor: palette.success },
  queueCard: { borderColor: tint.warningBorder },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueTitle: { ...type.base, color: palette.text, fontWeight: '600' },
  queueHint: { ...type.xs, color: palette.textSecondary, marginTop: 2 },
  queueRows: { gap: space.sm, marginTop: space.md },
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
  listCard: { paddingVertical: space.sm },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  apptRowDivided: { borderTopWidth: 1, borderTopColor: palette.hairline },
  apptTime: { ...type.sm, color: palette.accent, fontWeight: '700', width: 56 },
  apptTitle: { ...type.base, color: palette.text, fontWeight: '500' },
  placeholder: { ...type.base, color: palette.textSecondary },
  more: { ...type.xs, color: palette.textMuted },
});
