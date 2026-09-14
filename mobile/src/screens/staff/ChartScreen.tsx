import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Activity, CalendarDays, FileText, FlaskConical, Pill, Stethoscope,
} from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useActivePatient } from '@/context/ActivePatientContext';
import { Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { formatDate, fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';
import { buildTimeline, countByKind, type ChartKind } from '@/lib/chart';
import type { Appointment, Diagnosis, LabOrder, MedicalRecord, Prescription } from '@/lib/api';

/**
 * Tablet only. The full chart for the active patient, in one chronology.
 *
 * This is deliberately not the Patients summary. That screen answers "who is
 * this patient" in a glance — allergies, current medications, the last few of
 * everything. This one answers "what has happened, in order", by merging the
 * five clinical streams the API serves into a single timeline. Reading a
 * course of care means seeing a diagnosis, the prescription that followed it
 * and the lab that checked it next to each other, which no per-type list does.
 */

const KIND_META: Record<ChartKind, { label: string; colour: string; Icon: React.ComponentType<{ size: number; color: string }> }> = {
  visit: { label: 'Visits', colour: palette.accent, Icon: CalendarDays },
  diagnosis: { label: 'Diagnoses', colour: '#ec4899', Icon: Activity },
  medication: { label: 'Medications', colour: palette.violet, Icon: Pill },
  lab: { label: 'Labs', colour: palette.info, Icon: FlaskConical },
  document: { label: 'Documents', colour: palette.textSecondary, Icon: FileText },
};

const ORDER: ChartKind[] = ['visit', 'diagnosis', 'medication', 'lab', 'document'];

export const StaffChartScreen: React.FC = () => {
  const { api } = useSession();
  const { patient } = useActivePatient();
  const { gutter } = useLayout();
  const [filter, setFilter] = useState<ChartKind | 'all'>('all');

  const id = patient?.id;

  // Five independent requests rather than one, because that is how the API is
  // shaped; Promise.all keeps it to a single round of latency.
  const chart = useResource(async () => {
    if (!id) return null;
    const [visits, diagnoses, medications, labs, documents] = await Promise.all([
      api.listPatientAppointments(id).catch(() => [] as Appointment[]),
      api.listDiagnoses(id).catch(() => [] as Diagnosis[]),
      api.listPrescriptions(id).catch(() => [] as Prescription[]),
      api.listLabOrders(id).catch(() => [] as LabOrder[]),
      (api.listRecords(id) as Promise<MedicalRecord[]>).catch(() => [] as MedicalRecord[]),
    ]);
    return { visits, diagnoses, medications, labs, documents };
  }, [api, id]);

  const entries = useMemo(
    () => (chart.data ? buildTimeline(chart.data, filter) : []),
    [chart.data, filter]
  );

  const counts = useMemo(
    () => (chart.data ? countByKind(chart.data) : ({} as Record<ChartKind, number>)),
    [chart.data]
  );

  if (!patient) {
    return (
      <EmptyState
        icon={<Stethoscope size={36} color={palette.textFaint} />}
        title="No patient selected"
        hint="Choose someone in Patients and their chart opens here."
      />
    );
  }

  if (chart.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Text style={styles.name}>{fullName(patient.first_name, patient.last_name)}</Text>
        <Text style={styles.meta}>
          {[patient.mrn, formatDate(patient.dob ?? patient.date_of_birth)].filter(Boolean).join(' · ')}
        </Text>

        {patient.allergies ? (
          <View style={styles.allergy}>
            <Text style={styles.allergyLabel}>ALLERGIES</Text>
            <Text style={styles.allergyValue}>{patient.allergies}</Text>
          </View>
        ) : null}

        <View style={styles.filters}>
          <FilterPill
            label="All"
            count={entries.length}
            on={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {ORDER.map((kind) => (
            <FilterPill
              key={kind}
              label={KIND_META[kind].label}
              count={counts[kind] ?? 0}
              on={filter === kind}
              onPress={() => setFilter(kind)}
            />
          ))}
        </View>
      </View>

      {chart.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={chart.error} />
        </View>
      ) : null}

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl refreshing={chart.refreshing} onRefresh={chart.refresh} tintColor={palette.accent} />
        }
        ListEmptyComponent={<EmptyState title="Nothing recorded" hint="No entries of this kind on file." />}
        renderItem={({ item }) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.Icon;
          return (
            <View style={styles.entry}>
              {/* A continuous rail makes the chronology readable as one thread
                  rather than five interleaved lists. */}
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: meta.colour }]} />
                <View style={styles.line} />
              </View>

              <View style={styles.entryBody}>
                <View style={styles.entryTop}>
                  <Icon size={15} color={meta.colour} />
                  <Text style={styles.entryDate}>
                    {item.at === -Infinity ? 'Undated' : formatDate(new Date(item.at).toISOString())}
                  </Text>
                  {item.status ? <Chip label={item.status} tone="neutral" /> : null}
                  {item.flag === 'pending_review' ? <Chip label="Awaiting review" tone="warning" /> : null}
                </View>
                <Text style={styles.entryTitle}>{item.title}</Text>
                {item.detail ? (
                  <Text numberOfLines={2} style={styles.entryDetail}>
                    {item.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const FilterPill: React.FC<{ label: string; count: number; on: boolean; onPress: () => void }> = ({
  label,
  count,
  on,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    style={[styles.pill, on && styles.pillOn]}
  >
    <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>
      {label} {count > 0 ? count : ''}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  name: { ...type.xl, color: palette.text, fontWeight: '700' },
  meta: { ...type.sm, color: palette.textSecondary },
  allergy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: tint.dangerSoft,
    borderWidth: 1,
    borderColor: tint.dangerBorder,
  },
  allergyLabel: { ...type.xs, color: palette.danger, fontWeight: '700', letterSpacing: 0.6 },
  allergyValue: { ...type.sm, color: palette.text, fontWeight: '600', flex: 1 },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: space.xs },
  pill: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pillOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  pillLabel: { ...type.xs, color: palette.textSecondary, fontWeight: '600' },
  pillLabelOn: { color: palette.text },
  list: { paddingTop: space.md, paddingBottom: space.xl, flexGrow: 1 },
  entry: { flexDirection: 'row', gap: space.md },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  line: { flex: 1, width: 1, backgroundColor: palette.hairline, marginTop: 2 },
  entryBody: { flex: 1, paddingBottom: space.lg },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  entryDate: { ...type.xs, color: palette.textMuted },
  entryTitle: { ...type.md, color: palette.text, fontWeight: '600', marginTop: 3 },
  entryDetail: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
});
