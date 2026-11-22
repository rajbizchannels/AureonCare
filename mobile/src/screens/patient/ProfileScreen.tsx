import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/context/SessionContext';
import { Card, ErrorNote, Field, Loading, PrimaryButton, SectionLabel } from '@/components/ui';
import { formatDate, fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { changes, formFrom, formProblem, type PortalProfile, type ProfileForm } from '@/lib/profile';
import { palette, space, type } from '@/theme/tokens';

/**
 * The patient's own profile. Contact details, emergency contact and the health details
 * they keep up to date are editable here; name, date of birth and email identify them to
 * the practice and to sign-in, so those are shown with a note to ask the practice.
 * Only changed fields are sent (src/lib/profile.ts).
 */
export const PatientProfileScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter, maxContentWidth } = useLayout();
  const profile = useResource<PortalProfile | null>(
    () => (account ? api.getPortalProfile(account.id) : Promise.resolve(null)),
    [api, account?.id]
  );
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (profile.data) setForm(formFrom(profile.data)); }, [profile.data]);

  const set = (patch: Partial<ProfileForm>) => { setSaved(false); setError(null); setForm((f) => (f ? { ...f, ...patch } : f)); };
  const setEmergency = (patch: Partial<ProfileForm['emergency']>) =>
    set({ emergency: { ...(form as ProfileForm).emergency, ...patch } });

  const save = useCallback(async () => {
    if (!form || !profile.data || !account || saving) return;
    const problem = formProblem(form);
    if (problem) { setError(problem); return; }
    const patch = changes(profile.data, form);
    if (!patch) { setSaved(true); return; }
    setSaving(true);
    try {
      const next = await api.updatePortalProfile(account.id, patch);
      profile.set({ ...profile.data, ...next });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }, [api, account, form, profile, saving]);

  if (profile.loading || (!form && !profile.error)) return <Loading />;
  if (!profile.data || !form) return <View style={{ padding: gutter }}><ErrorNote message={profile.error ?? 'Could not load your profile.'} /></View>;
  const p = profile.data;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]} keyboardShouldPersistTaps="handled">
        <SectionLabel>About you</SectionLabel>
        <Card style={styles.card}>
          <Row label="Name" value={fullName(p.first_name ?? undefined, p.last_name ?? undefined)} />
          <Row label="Date of birth" value={formatDate(p.date_of_birth ?? undefined) || '—'} />
          <Row label="Email" value={p.email ?? '—'} />
          {p.mrn ? <Row label="Patient number" value={String(p.mrn)} /> : null}
          <Text style={styles.note}>To change these, contact your practice — they are how your practice and sign-in recognise you.</Text>
        </Card>

        <SectionLabel>Contact</SectionLabel>
        <Field label="Phone" value={form.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label="Address" value={form.address} onChangeText={(v) => set({ address: v })} multiline autoComplete="street-address" />

        <SectionLabel>Emergency contact</SectionLabel>
        <Field label="Name" value={form.emergency.name} onChangeText={(v) => setEmergency({ name: v })} />
        <Field label="Phone" value={form.emergency.phone} onChangeText={(v) => setEmergency({ phone: v })} keyboardType="phone-pad" />
        <Field label="Relationship" value={form.emergency.relationship} onChangeText={(v) => setEmergency({ relationship: v })} />

        <SectionLabel>Health details</SectionLabel>
        <Field label="Allergies" value={form.allergies} onChangeText={(v) => set({ allergies: v })} multiline hint="Your care team reviews what you add here." />
        <Field label="Medicines you take" value={form.currentMedications} onChangeText={(v) => set({ currentMedications: v })} multiline />

        {error ? <ErrorNote message={error} /> : null}
        {saved && !error ? <Text style={styles.saved} accessibilityLiveRegion="polite">Saved.</Text> : null}
        <PrimaryButton label="Save changes" onPress={() => void save()} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  card: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rowLabel: { ...type.sm, color: palette.textSecondary },
  rowValue: { ...type.sm, color: palette.text, flexShrink: 1, textAlign: 'right' },
  note: { ...type.xs, color: palette.textMuted },
  saved: { ...type.sm, color: palette.successText },
});
