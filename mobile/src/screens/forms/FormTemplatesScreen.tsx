import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, ClipboardList, Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '@/context/SessionContext';
import { useActivePatient } from '@/context/ActivePatientContext';
import { Card, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * Staff: choose a form to fill in for the patient selected in Patients — e.g. a consent or
 * intake handed to the patient on a tablet at the desk.
 */
export const FormTemplatesScreen: React.FC = () => {
  const { api } = useSession();
  const { patient } = useActivePatient();
  const navigation = useNavigation();
  const { gutter } = useLayout();
  const [q, setQ] = useState('');
  const templates = useResource(() => api.listFormTemplates(), [api]);
  const rows = useMemo(() => {
    const all = (templates.data ?? []).filter((t) => t.is_active !== false);
    const s = q.trim().toLowerCase();
    return s ? all.filter((t) => `${t.name} ${t.category_name ?? ''}`.toLowerCase().includes(s)) : all;
  }, [templates.data, q]);

  if (!patient) return <EmptyState icon={<ClipboardList size={34} color={palette.textFaint} />} title="No patient selected" hint="Choose someone in Patients first." />;
  if (templates.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={[styles.top, { paddingHorizontal: gutter }]}>
        <Text style={styles.meta}>For {fullName(patient.first_name, patient.last_name)}</Text>
        <View style={styles.search}>
          <Search size={16} color={palette.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search forms" placeholderTextColor={palette.textMuted} style={styles.input} accessibilityLabel="Search forms" />
        </View>
        {templates.error ? <ErrorNote message={templates.error} /> : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        ListEmptyComponent={<EmptyState title="No forms" hint="Forms your practice publishes appear here." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate('FormFill', { templateId: item.id, patientId: patient.id })} accessibilityRole="button">
            <Card style={styles.card}>
              <View style={styles.grow}>
                <Text style={styles.name}>{item.name}</Text>
                {item.category_name ? <Text style={styles.meta}>{item.category_name}</Text> : null}
              </View>
              <ChevronRight size={18} color={palette.textSecondary} />
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  top: { paddingTop: space.md, gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised },
  input: { flex: 1, minHeight: 44, color: palette.text, ...type.md },
  list: { paddingVertical: space.md, gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: 2 },
  name: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary },
});
