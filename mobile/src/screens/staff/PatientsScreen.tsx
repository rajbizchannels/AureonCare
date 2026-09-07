import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, ArrowLeft, Search, Users } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useActivePatient } from '@/context/ActivePatientContext';
import { SplitView } from '@/components/SplitView';
import { Card, Chip, EmptyState, ErrorNote, Loading, SectionLabel } from '@/components/ui';
import { formatDate, fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';
import type { Diagnosis, MedicalRecord, PatientRow, Prescription } from '@/lib/api';

/** The roster, and one patient's summary. Two panes on a tablet, one on a phone. */
export const StaffPatientsScreen: React.FC = () => {
  const { api } = useSession();
  // Selection is shared so the Chart tab opens on whoever is chosen here,
  // rather than making the clinician pick the same person twice.
  const { patient: selected, setPatient: setSelected } = useActivePatient();
  const [query, setQuery] = useState('');
  const { gutter } = useLayout();

  const patients = useResource<PatientRow[]>(() => api.listPatients(), [api]);

  const rows = useMemo(() => {
    const all = patients.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((p) =>
      [p.first_name, p.last_name, p.mrn, p.email].some((f) => f?.toLowerCase().includes(needle))
    );
  }, [patients.data, query]);

  const master = patients.loading ? (
    <Loading />
  ) : (
    <View style={styles.fill}>
      <View style={[styles.searchWrap, { paddingHorizontal: gutter }]}>
        <View style={styles.search}>
          <Search size={18} color={palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search patients"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
      </View>

      {patients.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={patients.error} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={patients.refreshing} onRefresh={patients.refresh} tintColor={palette.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={34} color={palette.textFaint} />}
            title={query ? 'No matches' : 'No patients'}
          />
        }
        renderItem={({ item }) => {
          const name = fullName(item.first_name, item.last_name);
          return (
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              accessibilityLabel={name}
              style={({ pressed }) => [
                styles.row,
                selected?.id === item.id && styles.rowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {[item.first_name?.[0], item.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.grow}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.meta}>
                  {[item.mrn, formatDate(item.dob ?? item.date_of_birth)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.allergies ? <AlertTriangle size={16} color={palette.danger} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <View style={styles.fill}>
      <SplitView
        hasSelection={Boolean(selected)}
        emptyDetail={{ title: 'Select a patient', hint: 'Their summary appears here.' }}
        master={master}
        detail={selected ? <PatientSummary patient={selected} onBack={() => setSelected(null)} /> : null}
      />
    </View>
  );
};

/** Allergies, active medications, recent diagnoses and documents — read-only. */
const PatientSummary: React.FC<{ patient: PatientRow; onBack: () => void }> = ({ patient, onBack }) => {
  const { api } = useSession();
  const { gutter, isSplit } = useLayout();

  const prescriptions = useResource<Prescription[]>(() => api.listPrescriptions(patient.id), [api, patient.id]);
  const diagnoses = useResource<Diagnosis[]>(() => api.listDiagnoses(patient.id), [api, patient.id]);
  const records = useResource<MedicalRecord[]>(
    () => api.listRecords(patient.id) as Promise<MedicalRecord[]>,
    [api, patient.id]
  );

  const name = fullName(patient.first_name, patient.last_name);

  return (
    <ScrollView contentContainerStyle={[styles.detail, { paddingHorizontal: gutter }]}>
      {!isSplit && (
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <ArrowLeft size={18} color={palette.accent} />
          <Text style={styles.backLabel}>All patients</Text>
        </Pressable>
      )}

      <View>
        <Text style={styles.detailName}>{name}</Text>
        <Text style={styles.meta}>
          {[patient.mrn, formatDate(patient.dob ?? patient.date_of_birth), patient.blood_type]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {/* Allergies lead, and are the one thing styled to be impossible to miss. */}
      <Card style={patient.allergies ? styles.allergyCard : undefined}>
        <View style={styles.allergyRow}>
          {patient.allergies ? <AlertTriangle size={18} color={palette.danger} /> : null}
          <View style={styles.grow}>
            <Text style={[styles.allergyLabel, !patient.allergies && styles.mutedLabel]}>ALLERGIES</Text>
            <Text style={styles.allergyValue}>{patient.allergies || 'None recorded'}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionLabel>Active medications</SectionLabel>
        <Card style={styles.listCard}>
          {prescriptions.loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : (prescriptions.data ?? []).length === 0 ? (
            <Text style={styles.muted}>{patient.current_medications || 'None recorded'}</Text>
          ) : (
            (prescriptions.data ?? []).slice(0, 6).map((p) => (
              <View key={String(p.id)} style={styles.listRow}>
                <View style={styles.grow}>
                  <Text style={styles.listTitle}>
                    {p.medication_name ?? p.brand_name ?? p.generic_name ?? 'Medication'}
                  </Text>
                  <Text style={styles.meta}>{[p.dosage, p.frequency].filter(Boolean).join(' · ')}</Text>
                </View>
                {p.status ? <Chip label={p.status} tone="neutral" /> : null}
              </View>
            ))
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionLabel>Diagnoses</SectionLabel>
        <Card style={styles.listCard}>
          {(diagnoses.data ?? []).length === 0 ? (
            <Text style={styles.muted}>{diagnoses.loading ? 'Loading…' : 'None recorded'}</Text>
          ) : (
            (diagnoses.data ?? []).slice(0, 6).map((d) => (
              <View key={String(d.id)} style={styles.listRow}>
                <View style={styles.grow}>
                  <Text style={styles.listTitle}>{d.diagnosis_name}</Text>
                  <Text style={styles.meta}>
                    {[d.diagnosis_code, formatDate(d.diagnosed_date)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {d.status ? <Chip label={d.status} tone="neutral" /> : null}
              </View>
            ))
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionLabel>Documents</SectionLabel>
        <Card style={styles.listCard}>
          {(records.data ?? []).length === 0 ? (
            <Text style={styles.muted}>{records.loading ? 'Loading…' : 'None on file'}</Text>
          ) : (
            (records.data ?? []).slice(0, 6).map((r) => (
              <View key={r.id} style={styles.listRow}>
                <View style={styles.grow}>
                  <Text style={styles.listTitle}>{r.title ?? r.record_type}</Text>
                  <Text style={styles.meta}>{formatDate(r.record_date)}</Text>
                </View>
                {r.review_status === 'pending_review' ? <Chip label="Awaiting review" tone="warning" /> : null}
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  searchWrap: { paddingTop: space.md, paddingBottom: space.sm },
  search: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  searchInput: { flex: 1, color: palette.text, ...type.md },
  list: { paddingBottom: space.lg, gap: space.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  rowSelected: { borderColor: palette.accentFrom, backgroundColor: palette.raised },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accentTo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.base, color: palette.text, fontWeight: '700' },
  grow: { flex: 1, minWidth: 0 },
  name: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  detail: { paddingVertical: space.lg, gap: space.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  backLabel: { ...type.base, color: palette.accent },
  detailName: { ...type.xl, color: palette.text, fontWeight: '700' },
  allergyCard: { backgroundColor: tint.dangerSoft, borderColor: tint.dangerBorder },
  allergyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  allergyLabel: { ...type.xs, color: palette.danger, fontWeight: '700', letterSpacing: 0.6 },
  mutedLabel: { color: palette.textMuted },
  allergyValue: { ...type.base, color: palette.text, fontWeight: '600', marginTop: 2 },
  section: { gap: space.sm },
  listCard: { padding: space.md, gap: space.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listTitle: { ...type.base, color: palette.text, fontWeight: '500' },
  muted: { ...type.base, color: palette.textSecondary },
});
