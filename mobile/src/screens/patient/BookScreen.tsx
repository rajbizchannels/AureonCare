import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarPlus, CircleCheck, Clock, UserRound } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate, fullName } from '@/lib/useResource';
import { ApiError, type Appointment } from '@/lib/api';
import {
  Card, Chip, EmptyState, ErrorNote, Loading, PrimaryButton, SectionLabel,
} from '@/components/ui';
import { bookableDays, clashesWith, slotsForDay, toDateInput, type Slot } from '@/lib/booking';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * A patient booking their own appointment.
 *
 * The portal gained `POST /:patientId/appointments`, and this is the obvious
 * place to spend it: booking is the single most-used feature of every patient
 * app, and the one thing people reach for a phone to do.
 *
 * Honest about what it does not know. There is no availability endpoint, only
 * a booking one that refuses a clash with 409 — so the times here are offers
 * generated client-side, filtered against the appointments this patient
 * already has, and a slot someone else took comes back refused. The screen
 * says that rather than presenting a guess as a guarantee, and the waitlist
 * below is the answer when nothing suits.
 */
export const PatientBookScreen: React.FC = () => {
  const { api, account, actorIsPortal } = useSession();
  const { gutter } = useLayout();

  const [day, setDay] = useState<Date>(() => bookableDays()[0] as Date);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patientId = account?.id;
  const days = useMemo(() => bookableDays(), []);

  const data = useResource(async () => {
    if (!patientId || !actorIsPortal) return null;
    const [providers, mine, waitlist] = await Promise.all([
      api.listBookableProviders(patientId).catch(() => []),
      api.listPatientAppointments(patientId).catch(() => [] as Appointment[]),
      api.listWaitlist(patientId).catch(() => []),
    ]);
    return { providers, mine, waitlist };
  }, [api, patientId, actorIsPortal]);

  const slots = useMemo(() => slotsForDay(day), [day]);
  const mine = data.data?.mine ?? [];

  const book = useCallback(async () => {
    if (!patientId || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const appointment = await api.bookAppointment(patientId, {
        provider_id: providerId,
        start_time: slot.startIso,
        end_time: slot.endIso,
        duration_minutes: 30,
        appointment_type: 'consultation',
      });
      setBooked(appointment);
      setSlot(null);
      await data.reload();
    } catch (e) {
      // 409 is the common, expected answer — somebody else took it between
      // this screen rendering and the tap. Reload so the picker reflects it.
      setError(
        e instanceof ApiError && e.status === 409
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not book that time.'
      );
      if (e instanceof ApiError && e.status === 409) await data.reload();
    } finally {
      setBusy(false);
    }
  }, [api, patientId, slot, providerId, data]);

  const joinWaitlist = useCallback(async () => {
    if (!patientId) return;
    setBusy(true);
    setError(null);
    try {
      await api.joinWaitlist(patientId, {
        providerId,
        preferredDate: toDateInput(day),
        appointmentType: 'consultation',
      });
      await data.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the waitlist.');
    } finally {
      setBusy(false);
    }
  }, [api, patientId, providerId, day, data]);

  // A patient signed in with a staff-issued JWT has no portal session, and
  // these endpoints authorise on one. Said plainly rather than left to 401.
  if (!actorIsPortal) {
    return (
      <EmptyState
        icon={<CalendarPlus size={34} color={palette.textFaint} />}
        title="Booking needs your portal sign-in"
        hint="This account is signed in through the practice. Sign in with your patient portal details to book."
      />
    );
  }

  if (data.loading) return <Loading />;

  const providers = data.data?.providers ?? [];
  const waitlist = data.data?.waitlist ?? [];

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      {booked ? (
        <View style={styles.confirmed}>
          <CircleCheck size={20} color={palette.success} />
          <View style={styles.grow}>
            <Text style={styles.confirmedTitle}>Booked</Text>
            <Text style={styles.confirmedBody}>
              {formatDate(booked.start_time)} at{' '}
              {new Date(booked.start_time).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
              . It is in your Visits.
            </Text>
          </View>
        </View>
      ) : null}

      <SectionLabel>Who</SectionLabel>
      <View style={styles.pills}>
        <Choice label="Anyone" on={providerId === null} onPress={() => setProviderId(null)} />
        {providers.map((p) => (
          <Choice
            key={p.id}
            label={fullName(p.first_name, p.last_name, 'Provider')}
            on={providerId === p.id}
            onPress={() => setProviderId(p.id)}
          />
        ))}
      </View>

      <SectionLabel>Day</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d) => {
          const on = d.toDateString() === day.toDateString();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => {
                setDay(d);
                setSlot(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayName, on && styles.dayTextOn]}>
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNum, on && styles.dayTextOn]}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionLabel>Time</SectionLabel>
      <View style={styles.slots}>
        {slots.map((s) => {
          const taken = clashesWith(s, mine);
          const on = slot?.startIso === s.startIso;
          return (
            <Pressable
              key={s.startIso}
              onPress={() => setSlot(s)}
              disabled={taken}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: taken }}
              accessibilityLabel={taken ? `${s.label}, you already have an appointment` : s.label}
              style={[styles.slot, on && styles.slotOn, taken && styles.slotTaken]}
            >
              <Text style={[styles.slotLabel, on && styles.dayTextOn, taken && styles.slotLabelTaken]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.caveat}>
        These are the practice&apos;s usual hours, not confirmed availability. If someone
        takes a time first you will be told and can pick again.
      </Text>

      {error ? <ErrorNote message={error} /> : null}

      <PrimaryButton
        label={slot ? `Book ${slot.label}` : 'Choose a time'}
        onPress={book}
        disabled={!slot}
        busy={busy}
      />

      <SectionLabel>Nothing suitable?</SectionLabel>
      <Card style={styles.waitCard}>
        <Text style={styles.waitText}>
          Join the waitlist for {formatDate(day.toISOString())} and the practice will
          contact you if a slot opens.
        </Text>
        <Pressable
          onPress={joinWaitlist}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.waitButton, pressed && styles.pressed]}
        >
          <Clock size={14} color={palette.textStrong} />
          <Text style={styles.waitButtonLabel}>Add me to the waitlist</Text>
        </Pressable>
      </Card>

      {waitlist.length > 0 ? (
        <>
          <SectionLabel>You are waiting for</SectionLabel>
          {waitlist.map((entry) => (
            <View key={entry.id} style={styles.waitRow}>
              <UserRound size={14} color={palette.textMuted} />
              <Text style={styles.waitRowText}>
                {formatDate(entry.preferredDate)}
                {entry.providerLastName ? ` · ${entry.providerFirstName ?? ''} ${entry.providerLastName}` : ''}
              </Text>
              <Chip label={entry.status} tone={entry.status === 'active' ? 'accent' : 'neutral'} />
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

const Choice: React.FC<{ label: string; on: boolean; onPress: () => void }> = ({
  label,
  on,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    style={[styles.pill, on && styles.pillOn]}
  >
    <Text numberOfLines={1} style={[styles.pillLabel, on && styles.dayTextOn]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg, gap: space.sm, paddingBottom: space.xl * 3 },
  grow: { flex: 1 },
  confirmed: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: tint.successSoft,
    borderWidth: 1,
    borderColor: palette.success,
  },
  confirmedTitle: { ...type.md, color: palette.text, fontWeight: '700' },
  confirmedBody: { ...type.xs, color: palette.textSecondary },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    maxWidth: 200,
  },
  pillOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  pillLabel: { ...type.xs, color: palette.textSecondary, fontWeight: '600' },
  days: { gap: space.sm, paddingVertical: 2 },
  day: {
    width: 52,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  dayOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  dayName: { ...type.xs, color: palette.textMuted },
  dayNum: { ...type.lg, color: palette.text, fontWeight: '700' },
  dayTextOn: { color: palette.text },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    minWidth: 76,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  slotOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  slotTaken: { opacity: 0.35 },
  slotLabel: { ...type.sm, color: palette.textStrong, fontWeight: '600' },
  slotLabelTaken: { textDecorationLine: 'line-through' },
  caveat: { ...type.xs, color: palette.textMuted },
  waitCard: { gap: space.sm },
  waitText: { ...type.sm, color: palette.textSecondary },
  waitButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
  },
  waitButtonLabel: { ...type.sm, color: palette.textStrong, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  waitRowText: { ...type.sm, color: palette.text, flex: 1 },
});
