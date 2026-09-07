import React, { useCallback } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, MessageSquare, Video } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, ErrorNote, Loading, PrimaryButton, SecondaryButton, SectionLabel } from '@/components/ui';
import { formatTime, fullName, isUpcoming, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';
import type { Appointment } from '@/lib/api';

/**
 * The patient's landing screen: the next thing that is going to happen, and
 * the one or two things waiting on them. Everything else lives behind a tab.
 */
export const PatientHomeScreen: React.FC<{ onOpenMessages: () => void; onOpenVisits: () => void }> = ({
  onOpenMessages,
  onOpenVisits,
}) => {
  const { api, account } = useSession();
  const { gutter, maxContentWidth } = useLayout();

  const appointments = useResource<Appointment[]>(
    () => (account ? api.listPatientAppointments(account.id) : Promise.resolve([])),
    [api, account?.id]
  );
  const unread = useResource<number>(() => api.unreadCount(), [api]);

  const next = (appointments.data ?? [])
    .filter((a) => isUpcoming(a.start_time) && a.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  const join = useCallback(async (url: string) => {
    // Prefer the provider's own app; the OS falls back to a browser when it is
    // not installed, which is the behaviour we want rather than a webview.
    await Linking.openURL(url).catch(() => undefined);
  }, []);

  if (appointments.loading) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}
      refreshControl={
        <RefreshControl
          refreshing={appointments.refreshing}
          onRefresh={() => {
            appointments.refresh();
            unread.refresh();
          }}
          tintColor={palette.accent}
        />
      }
    >
      <View>
        <Text style={styles.greeting}>
          {greetingFor(new Date())}, {account?.firstName ?? 'there'}
        </Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {appointments.error ? <ErrorNote message={appointments.error} /> : null}

      {next ? (
        <Card style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextLabel}>NEXT VISIT</Text>
            <Text style={styles.nextWhen}>{relativeTo(next.start_time)}</Text>
          </View>

          <Text style={styles.nextTitle}>{next.reason ?? next.appointment_type ?? 'Appointment'}</Text>
          <Text style={styles.nextProvider}>
            {fullName(next.provider?.first_name, next.provider?.last_name, 'Your care team')}
          </Text>
          <Text style={styles.nextMeta}>
            {formatTime(next.start_time)}
            {next.meeting_url ? ' · Video visit' : ''}
          </Text>

          <View style={styles.nextActions}>
            {next.meeting_url ? (
              <PrimaryButton
                label="Join visit"
                icon={<Video size={17} color={palette.text} />}
                onPress={() => void join(next.meeting_url as string)}
                style={styles.grow}
              />
            ) : null}
            <SecondaryButton label="All visits" onPress={onOpenVisits} style={styles.grow} />
          </View>
        </Card>
      ) : (
        <Card>
          <View style={styles.emptyRow}>
            <CalendarDays size={19} color={palette.textSecondary} />
            <Text style={styles.emptyText}>No upcoming appointments booked.</Text>
          </View>
        </Card>
      )}

      {(unread.data ?? 0) > 0 && (
        <Card style={styles.messageCard}>
          <View style={styles.emptyRow}>
            <MessageSquare size={19} color={palette.accent} />
            <View style={styles.grow}>
              <Text style={styles.messageTitle}>
                {unread.data} unread {unread.data === 1 ? 'message' : 'messages'}
              </Text>
              <Text style={styles.emptyText}>From your care team</Text>
            </View>
            <Chip label="Open" tone="accent" />
          </View>
          <SecondaryButton label="Read messages" onPress={onOpenMessages} style={styles.readBtn} />
        </Card>
      )}

      <View style={styles.section}>
        <SectionLabel>Recent visits</SectionLabel>
        {(appointments.data ?? [])
          .filter((a) => !isUpcoming(a.start_time))
          .slice(0, 3)
          .map((a) => (
            <Card key={a.id} style={styles.pastRow}>
              <View style={styles.grow}>
                <Text style={styles.pastTitle}>{a.reason ?? a.appointment_type ?? 'Visit'}</Text>
                <Text style={styles.emptyText}>
                  {new Date(a.start_time).toLocaleDateString()} ·{' '}
                  {fullName(a.provider?.first_name, a.provider?.last_name, 'Care team')}
                </Text>
              </View>
            </Card>
          ))}
      </View>
    </ScrollView>
  );
};

const greetingFor = (now: Date): string => {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/** "in 40 minutes" reads better than a timestamp for something imminent. */
const relativeTo = (iso: string): string => {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes < 0) return 'now';
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? 'day' : 'days'}`;
};

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg, gap: space.lg, alignSelf: 'center', width: '100%' },
  greeting: { ...type.display, color: palette.text, fontWeight: '700', letterSpacing: -0.3 },
  date: { ...type.base, color: palette.textSecondary, marginTop: 2 },
  nextCard: { backgroundColor: tint.accentSoft },
  nextHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  nextLabel: { ...type.xs, color: palette.accent, fontWeight: '700', letterSpacing: 0.6 },
  nextWhen: { ...type.xs, color: palette.textMuted },
  nextTitle: { ...type.lg, color: palette.text, fontWeight: '600' },
  nextProvider: { ...type.base, color: palette.textStrong, marginTop: 2 },
  nextMeta: { ...type.sm, color: palette.textSecondary, marginTop: 4 },
  nextActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  grow: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emptyText: { ...type.sm, color: palette.textSecondary },
  messageCard: { borderColor: palette.accentFrom },
  messageTitle: { ...type.base, color: palette.text, fontWeight: '600' },
  readBtn: { marginTop: space.md },
  section: { gap: space.sm },
  pastRow: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.lg },
  pastTitle: { ...type.base, color: palette.text, fontWeight: '500' },
});
