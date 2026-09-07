import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, Video } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading, PrimaryButton } from '@/components/ui';
import { formatTime, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';
import type { Appointment } from '@/lib/api';

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);

/**
 * The clinician's day.
 *
 * A phone gets an agenda — a week grid at that width is unreadable. A tablet
 * has room for the week strip to sit above it, which is the one genuinely
 * useful thing the extra width buys here.
 */
export const StaffScheduleScreen: React.FC = () => {
  const { api } = useSession();
  const { gutter, isTablet } = useLayout();
  const [anchor, setAnchor] = useState(() => new Date());

  const appointments = useResource<Appointment[]>(() => api.listAppointments(), [api]);

  const week = useMemo(() => {
    // Monday-first week containing the anchor.
    const start = addDays(anchor, -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments.data ?? []) {
      const key = dayKey(new Date(a.start_time));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments.data]);

  const rows = (appointments.data ?? [])
    .filter((a) => dayKey(new Date(a.start_time)) === dayKey(anchor))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  if (appointments.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={styles.weekBar}>
        <View style={[styles.weekHeader, { paddingHorizontal: gutter }]}>
          <Pressable onPress={() => setAnchor(addDays(anchor, -7))} accessibilityLabel="Previous week" style={styles.arrow}>
            <ChevronLeft size={18} color={palette.textSecondary} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => setAnchor(addDays(anchor, 7))} accessibilityLabel="Next week" style={styles.arrow}>
            <ChevronRight size={18} color={palette.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.week, { paddingHorizontal: gutter / 2 }]}>
          {week.map((d) => {
            const selected = dayKey(d) === dayKey(anchor);
            const count = byDay.get(dayKey(d)) ?? 0;
            return (
              <Pressable
                key={dayKey(d)}
                onPress={() => setAnchor(d)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.dayCell, selected && styles.dayCellOn]}
              >
                <Text style={[styles.dow, selected && styles.dayOn]}>
                  {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                </Text>
                <Text style={[styles.dayNum, selected && styles.dayOn]}>{d.getDate()}</Text>
                {/* Load at a glance — on a tablet there is room for the count. */}
                {count > 0 &&
                  (isTablet ? (
                    <Text style={[styles.dayCount, selected && styles.dayOn]}>{count}</Text>
                  ) : (
                    <View style={[styles.dot, selected && styles.dotOn]} />
                  ))}
              </Pressable>
            );
          })}
        </View>
      </View>

      {appointments.error ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
          <ErrorNote message={appointments.error} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={appointments.refreshing}
            onRefresh={appointments.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<CalendarDays size={34} color={palette.textFaint} />}
            title="Nothing scheduled"
            hint={anchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.agendaRow}>
            <Text style={styles.agendaTime}>{formatTime(item.start_time)}</Text>
            <Card style={styles.agendaCard}>
              <View style={styles.agendaTop}>
                <View style={styles.grow}>
                  <Text style={styles.agendaTitle}>{item.reason ?? item.appointment_type ?? 'Appointment'}</Text>
                  <Text style={styles.agendaMeta}>
                    {formatTime(item.start_time)}–{formatTime(item.end_time)}
                    {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
                  </Text>
                </View>
                {item.status ? (
                  <Chip
                    label={item.status}
                    tone={item.status === 'cancelled' ? 'danger' : item.status === 'completed' ? 'success' : 'neutral'}
                  />
                ) : null}
              </View>

              {item.meeting_url ? (
                <PrimaryButton
                  label="Start visit"
                  icon={<Video size={16} color={palette.text} />}
                  onPress={() => void Linking.openURL(item.meeting_url as string).catch(() => undefined)}
                  style={styles.startBtn}
                />
              ) : null}
            </Card>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  weekBar: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.hairline },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.md },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { ...type.base, color: palette.text, fontWeight: '600' },
  week: { flexDirection: 'row', paddingBottom: space.md },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: 9, gap: 4 },
  dayCellOn: { backgroundColor: palette.accentFrom },
  dow: { ...type.xs, color: palette.textMuted },
  dayNum: { ...type.base, color: palette.textStrong, fontWeight: '600' },
  dayOn: { color: palette.text },
  dayCount: { ...type.xs, color: palette.textMuted },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  dotOn: { backgroundColor: palette.text },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  agendaRow: { flexDirection: 'row', gap: space.md },
  agendaTime: { ...type.sm, color: palette.textMuted, width: 46, paddingTop: space.md, fontWeight: '600' },
  agendaCard: { flex: 1, padding: space.md },
  agendaTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  agendaTitle: { ...type.base, color: palette.text, fontWeight: '600' },
  agendaMeta: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  startBtn: { marginTop: space.md },
});
