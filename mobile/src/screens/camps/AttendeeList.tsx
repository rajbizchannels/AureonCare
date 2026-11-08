import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, ShieldCheck, Users } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate } from '@/lib/useResource';
import { canWorkCampDesk } from '@/lib/permissions';
import { Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';
import type { Camp } from '@/lib/api';

/**
 * Everyone registered for this camp.
 *
 * The one action offered here is recording consent, because that is the thing
 * the desk gets asked for after the fact — somebody reaches a clinical station
 * without it and is sent back. Promotion to a patient record and the clinical
 * reports stay in the web app: both need judgement about duplicate matches
 * that a phone is a poor place to exercise.
 */

const STATUS_TONE: Record<string, 'neutral' | 'accent' | 'success' | 'warning'> = {
  registered: 'neutral',
  in_progress: 'accent',
  completed: 'success',
  left_early: 'warning',
  cancelled: 'warning',
};

export const AttendeeList: React.FC<{ camp: Camp }> = ({ camp }) => {
  const { api, role } = useSession();
  const { gutter } = useLayout();
  const [query, setQuery] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mayWork = canWorkCampDesk(role);

  // The search runs server-side so a camp with a thousand attendees does not
  // have to be pulled down to filter it.
  const attendees = useResource(
    () => api.listCampRegistrations({ campId: camp.id, q: query.trim() || undefined }),
    [api, camp.id, query]
  );

  const recordConsent = useCallback(
    async (id: string) => {
      setWorking(id);
      setError(null);
      try {
        await api.recordConsent(id);
        await attendees.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record consent.');
      } finally {
        setWorking(null);
      }
    },
    [api, attendees]
  );

  return (
    <View style={styles.fill}>
      <View style={[styles.searchRow, { marginHorizontal: gutter }]}>
        <Search size={15} color={palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name, phone or token"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={error} />
        </View>
      ) : null}

      {attendees.loading ? (
        <Loading />
      ) : (
        <FlatList
          data={attendees.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={attendees.refreshing}
              onRefresh={attendees.refresh}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Users size={36} color={palette.textFaint} />}
              title={query ? 'Nobody matches' : 'Nobody registered yet'}
              hint={query ? 'Try a different name or token.' : 'Attendees appear here as the desk takes them.'}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.token}>
                <Text style={styles.tokenNo}>{item.tokenNo}</Text>
              </View>

              <View style={styles.body}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.fullName}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {[
                    item.ageYears != null ? `${item.ageYears}y` : formatDate(item.dateOfBirth),
                    item.gender,
                    item.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <View style={styles.chips}>
                  <Chip label={item.status.replace(/_/g, ' ')} tone={STATUS_TONE[item.status] ?? 'neutral'} />
                  {item.patientId ? <Chip label="Has record" tone="accent" /> : null}
                </View>
              </View>

              {item.consentGivenAt ? (
                <View style={styles.consented}>
                  <ShieldCheck size={16} color={palette.success} />
                </View>
              ) : mayWork ? (
                <Pressable
                  onPress={() => recordConsent(item.id)}
                  disabled={working === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Record consent for ${item.fullName}`}
                  style={({ pressed }) => [
                    styles.consentButton,
                    (pressed || working === item.id) && styles.pressed,
                  ]}
                >
                  <Text style={styles.consentLabel}>Consent</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
  },
  searchInput: { flex: 1, minHeight: 42, color: palette.text, ...type.base },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
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
  token: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: palette.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenNo: { ...type.md, color: palette.textStrong, fontWeight: '700' },
  body: { flex: 1, gap: 3, alignItems: 'flex-start' },
  name: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.xs, color: palette.textSecondary },
  chips: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  consented: { width: 44, alignItems: 'center' },
  consentButton: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
  },
  consentLabel: { ...type.xs, color: palette.textStrong, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
