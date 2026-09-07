import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlaskConical, Pill } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { formatDate, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';
import type { LabOrder, Prescription } from '@/lib/api';
import type { ChipTone } from '@/components/ui';

/**
 * Tablet only. Prescriptions and lab orders across the practice, read-only.
 *
 * Deliberately read-only: writing a prescription or a lab order is
 * safety-critical and needs the ICD/CPT and result-recipient pickers the web
 * app has. Showing the queues here is genuinely useful on a ward round;
 * a half-built prescribing form would not be.
 */
export const StaffOrdersScreen: React.FC = () => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [segment, setSegment] = useState<'prescriptions' | 'labs'>('prescriptions');

  const prescriptions = useResource<Prescription[]>(() => api.listPrescriptions(), [api]);
  const labs = useResource<LabOrder[]>(() => api.listLabOrders(), [api]);

  const active = segment === 'prescriptions' ? prescriptions : labs;
  const loading = active.loading;

  return (
    <View style={styles.fill}>
      <View style={[styles.segmentWrap, { paddingHorizontal: gutter }]}>
        <View style={styles.segment}>
          {(
            [
              ['prescriptions', 'Prescriptions'],
              ['labs', 'Lab orders'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setSegment(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: segment === value }}
              style={[styles.segmentItem, segment === value && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentLabel, segment === value && styles.segmentLabelOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {active.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={active.error} />
        </View>
      ) : null}

      {loading ? (
        <Loading />
      ) : segment === 'prescriptions' ? (
        <FlatList
          data={prescriptions.data ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          refreshControl={
            <RefreshControl
              refreshing={prescriptions.refreshing}
              onRefresh={prescriptions.refresh}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState icon={<Pill size={34} color={palette.textFaint} />} title="No prescriptions" />
          }
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <Pill size={18} color={palette.violet} />
              <View style={styles.grow}>
                <Text style={styles.title}>
                  {item.medication_name ?? item.brand_name ?? item.generic_name ?? 'Medication'}
                </Text>
                <Text style={styles.meta}>
                  {[item.dosage, item.frequency, formatDate(item.prescribed_date)].filter(Boolean).join(' · ')}
                </Text>
                {item.provider_name ? <Text style={styles.meta}>{item.provider_name}</Text> : null}
              </View>
              {item.status ? <Chip label={item.status} tone={statusTone(item.status)} /> : null}
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={labs.data ?? []}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          refreshControl={
            <RefreshControl refreshing={labs.refreshing} onRefresh={labs.refresh} tintColor={palette.accent} />
          }
          ListEmptyComponent={
            <EmptyState icon={<FlaskConical size={34} color={palette.textFaint} />} title="No lab orders" />
          }
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <FlaskConical size={18} color={palette.info} />
              <View style={styles.grow}>
                <Text style={styles.title}>{item.order_number ?? 'Lab order'}</Text>
                <Text style={styles.meta}>
                  {[item.order_type, formatDate(item.created_at)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.chips}>
                {item.priority && item.priority !== 'routine' ? (
                  <Chip label={item.priority} tone={item.priority === 'stat' ? 'danger' : 'warning'} />
                ) : null}
                {item.status ? <Chip label={item.status} tone={statusTone(item.status)} /> : null}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
};

const statusTone = (status: string): ChipTone => {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'active' || s === 'filled') return 'success';
  if (s === 'cancelled' || s === 'rejected') return 'danger';
  if (s === 'pending' || s === 'in_progress') return 'warning';
  return 'neutral';
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
  grow: { flex: 1, minWidth: 0 },
  title: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  chips: { gap: 6, alignItems: 'flex-end' },
});
