import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, TicketCheck } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { registrationBlockedReason, validateAttendee } from '@/lib/camps';
import { Card, EmptyState, ErrorNote, Field, PrimaryButton, SectionLabel } from '@/components/ui';
import { palette, radius, space, tint, type } from '@/theme/tokens';
import type { Camp } from '@/lib/api';

/**
 * The registration desk.
 *
 * Designed for someone standing up, holding a phone, with a queue in front of
 * them — so: the fewest fields the backend will accept, a keyboard that suits
 * each one, and a confirmation that shows the token number large enough to
 * read out loud. Everything else about an attendee can be filled in later.
 *
 * Consent is a switch rather than a form because a clinical station refuses
 * anyone without it (`camps.assertConsent`), and discovering that at the
 * vitals table means walking the person back to the desk.
 */

interface Draft {
  fullName: string;
  phone: string;
  ageYears: string;
  dateOfBirth: string;
  gender: string;
  city: string;
  consentGiven: boolean;
}

const EMPTY: Draft = {
  fullName: '',
  phone: '',
  ageYears: '',
  dateOfBirth: '',
  gender: '',
  city: '',
  consentGiven: false,
};

export const RegistrationDesk: React.FC<{ camp: Camp; onRegistered?: () => void }> = ({
  camp,
  onRegistered,
}) => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastToken, setLastToken] = useState<{ token: number; name: string; queued: boolean } | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const blocked = registrationBlockedReason(camp);

  const submit = useCallback(async () => {
    const problem = validateAttendee(draft);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      const { registration, firstVisit } = await api.registerAttendee({
        campId: camp.id,
        fullName: draft.fullName.trim(),
        phone: draft.phone.trim() || undefined,
        ageYears: draft.ageYears.trim() ? Number(draft.ageYears) : undefined,
        dateOfBirth: draft.dateOfBirth.trim() || undefined,
        gender: draft.gender.trim() || undefined,
        city: draft.city.trim() || undefined,
        consentGiven: draft.consentGiven,
      });

      setLastToken({
        token: registration.tokenNo,
        name: registration.fullName,
        queued: Boolean(firstVisit),
      });
      // Cleared rather than kept: the next person in the queue is a different
      // person, and a pre-filled name is how two of them end up merged.
      setDraft(EMPTY);
      onRegistered?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register this attendee.');
    } finally {
      setBusy(false);
    }
  }, [api, camp.id, draft, onRegistered]);

  if (blocked) {
    return (
      <EmptyState
        icon={<TicketCheck size={36} color={palette.textFaint} />}
        title="Not taking registrations"
        hint={blocked}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
      >
        {lastToken ? (
          <View style={styles.receipt}>
            <Text style={styles.receiptLabel}>TOKEN</Text>
            <Text style={styles.receiptToken}>{lastToken.token}</Text>
            <Text style={styles.receiptName}>{lastToken.name}</Text>
            <Text style={styles.receiptHint}>
              {lastToken.queued
                ? 'Queued at the first station.'
                : 'Registered. They join a queue when the camp starts, or once consent is recorded.'}
            </Text>
          </View>
        ) : null}

        <SectionLabel>New attendee</SectionLabel>

        <Field
          label="Full name"
          value={draft.fullName}
          onChangeText={(v) => set('fullName', v)}
          autoCapitalize="words"
          placeholder="Name as they give it"
          returnKeyType="next"
        />

        <View style={styles.pair}>
          <Field
            label="Age"
            value={draft.ageYears}
            onChangeText={(v) => set('ageYears', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="Years"
            style={styles.half}
          />
          <Field
            label="Date of birth"
            value={draft.dateOfBirth}
            onChangeText={(v) => set('dateOfBirth', v)}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.half}
          />
        </View>
        <Text style={styles.pairHint}>Either one is enough.</Text>

        <View style={styles.pair}>
          <Field
            label="Phone"
            value={draft.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            style={styles.half}
          />
          <Field
            label="Gender"
            value={draft.gender}
            onChangeText={(v) => set('gender', v)}
            autoCapitalize="none"
            style={styles.half}
          />
        </View>

        <Field label="City" value={draft.city} onChangeText={(v) => set('city', v)} />

        <Pressable
          onPress={() => set('consentGiven', !draft.consentGiven)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.consentGiven }}
          style={({ pressed }) => [styles.consent, pressed && styles.pressed]}
        >
          <View style={[styles.box, draft.consentGiven && styles.boxOn]}>
            {draft.consentGiven ? <Check size={14} color={palette.text} /> : null}
          </View>
          <View style={styles.consentBody}>
            <Text style={styles.consentTitle}>Consent given</Text>
            <Text style={styles.consentHint}>
              Required before any clinical station. Without it they can register but not be
              seen.
            </Text>
          </View>
        </Pressable>

        {error ? <ErrorNote message={error} /> : null}

        <PrimaryButton label="Register" onPress={submit} busy={busy} />

        <Card style={styles.note}>
          <Text style={styles.noteText}>
            The token number is allocated by the server under a lock on the camp, so two
            desks working the same camp never hand out the same number.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md, paddingBottom: space.xl * 3 },
  pair: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
  pairHint: { ...type.xs, color: palette.textMuted, marginTop: -space.sm },
  receipt: {
    alignItems: 'center',
    gap: 2,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: tint.successSoft,
    borderWidth: 1,
    borderColor: palette.success,
  },
  receiptLabel: { ...type.xs, color: palette.successText, fontWeight: '700', letterSpacing: 1 },
  receiptToken: { fontSize: 44, lineHeight: 50, color: palette.text, fontWeight: '800' },
  receiptName: { ...type.lg, color: palette.text, fontWeight: '600' },
  receiptHint: { ...type.xs, color: palette.textSecondary, textAlign: 'center' },
  consent: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  consentBody: { flex: 1, gap: 2 },
  consentTitle: { ...type.md, color: palette.text, fontWeight: '600' },
  consentHint: { ...type.xs, color: palette.textSecondary },
  note: { padding: space.md },
  noteText: { ...type.xs, color: palette.textMuted },
});
