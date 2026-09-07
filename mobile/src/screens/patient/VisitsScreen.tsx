import React, { useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Video } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { formatTime, fullName, isUpcoming, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, type } from '@/theme/tokens';
import type { Appointment } from '@/lib/api';

/** Upcoming and past, split by a segmented control rather than two screens. */
export const PatientVisitsScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter } = useLayout();
  const [segment, setSegment] = useState<'upcoming' | 'past'>('upcoming');

  const visits = useResource<Appointment[]>(
    () => (account ? api.listPatientAppointments(account.id) : Promise.resolve([])),
    [api, account?.id]
  );

  const rows = (visits.data ?? [])
    .filter((a) => (segment === 'upcoming' ? isUpcoming(a.start_time) : !isUpcoming(a.start_time)))
    .sort((a, b) => {
      const at = new Date(a.start_time).getTime();
      const bt = new Date(b.start_time).getTime();
      // Upcoming reads soonest-first; past reads most-recent-first.
      return segment === 'upcoming' ? at - bt : bt - at;
    });

  if (visits.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={[styles.segmentWrap, { paddingHorizontal: gutter }]}>
        <View style={styles.segment}>
          {(['upcoming', 'past'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setSegment(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: segment === value }}
              style={[styles.segmentItem, segment === value && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentLabel, segment === value && styles.segmentLabelOn]}>
                {value === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {visits.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={visits.error} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl refreshing={visits.refreshing} onRefresh={visits.refresh} tintColor={palette.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<CalendarDays size={34} color={palette.textFaint} />}
            title={segment === 'upcoming' ? 'Nothing booked' : 'No past visits'}
            hint={segment === 'upcoming' ? 'Your care team will confirm new appointments here.' : undefined}
          />
        }
        renderItem={({ item }) => {
          const date = new Date(item.start_time);
          return (
            <Card style={styles.row}>
              <View style={styles.dateCol}>
                <Text style={styles.month}>
                  {date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                </Text>
                <Text style={styles.day}>{date.getDate()}</Text>
              </View>
              <View style={styles.rule} />
              <View style={styles.grow}>
                <Text style={styles.title}>{item.reason ?? item.appointment_type ?? 'Appointment'}</Text>
                <Text style={styles.meta}>
                  {formatTime(item.start_time)} ·{' '}
                  {fullName(item.provider?.first_name, item.provider?.last_name, 'Care team')}
                </Text>
                <View style={styles.chips}>
                  {item.meeting_url ? <Chip label="Video" tone="success" /> : null}
                  {item.status && item.status !== 'scheduled' ? (
                    <Chip
                      label={item.status}
                      tone={item.status === 'cancelled' ? 'danger' : 'neutral'}
                    />
                  ) : null}
                </View>
              </View>

              {item.meeting_url && isUpcoming(item.start_time) ? (
                <Pressable
                  onPress={() => void Linking.openURL(item.meeting_url as string).catch(() => undefined)}
                  accessibilityRole="button"
                  accessibilityLabel="Join this visit"
                  style={styles.joinBtn}
                >
                  <Video size={18} color={palette.text} />
                </Pressable>
              ) : null}
            </Card>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  segmentWrap: { paddingTop: space.md, paddingBottom: space.sm },
  segment: {
    height: 40,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 9,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  segmentItem: { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { backgroundColor: palette.raised },
  segmentLabel: { ...type.sm, color: palette.textMuted },
  segmentLabelOn: { color: palette.text, fontWeight: '600' },
  list: { paddingVertical: space.sm, gap: space.sm, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  dateCol: { width: 46, alignItems: 'center' },
  month: { ...type.xs, color: palette.textMuted, letterSpacing: 0.5 },
  day: { ...type.xl, color: palette.text, fontWeight: '700' },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: palette.hairline },
  grow: { flex: 1, minWidth: 0 },
  title: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary, marginTop: 3 },
  chips: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  joinBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.accentFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
