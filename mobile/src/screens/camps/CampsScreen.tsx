import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, MapPin, Tent, Users } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate } from '@/lib/useResource';
import { canWorkCampDesk } from '@/lib/permissions';
import { acceptsRegistrations, hasLiveBoard, sortCamps } from '@/lib/camps';
import { Chip, EmptyState, ErrorNote, Loading, Segmented } from '@/components/ui';
import { SplitView } from '@/components/SplitView';
import { palette, radius, space, type } from '@/theme/tokens';
import type { Camp, CampStatus } from '@/lib/api';
import { RegistrationDesk } from './RegistrationDesk';
import { StationBoard } from './StationBoard';
import { AttendeeList } from './AttendeeList';

/**
 * Medical camps.
 *
 * Camps are the part of the practice that is already mobile — a field site, a
 * folding table, no desktop in sight — so this is the screen where the app
 * stops being a companion to the web client and becomes the primary tool. A
 * phone runs the registration desk; a tablet shows the board.
 *
 * Three panes rather than three tabs, because they are three views of one
 * camp and switching between them should not cost a navigation.
 */

type Pane = 'desk' | 'board' | 'attendees';

const STATUS_TONE: Record<CampStatus, 'success' | 'accent' | 'neutral' | 'warning'> = {
  in_progress: 'success',
  published: 'accent',
  draft: 'neutral',
  completed: 'neutral',
  cancelled: 'warning',
};

export const CampsScreen: React.FC = () => {
  const { api, role } = useSession();
  const { isSplit, gutter } = useLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('desk');

  const camps = useResource(() => api.listCamps(), [api]);
  const ordered = useMemo(() => sortCamps(camps.data ?? []), [camps.data]);

  const selected = ordered.find((c) => c.id === selectedId) ?? null;
  const mayWorkDesk = canWorkCampDesk(role);

  // The pane a camp opens on depends on what it is doing. A running camp wants
  // the board; one that is merely published has nobody queued yet.
  const open = (camp: Camp) => {
    setSelectedId(camp.id);
    setPane(hasLiveBoard(camp) && isSplit ? 'board' : mayWorkDesk && acceptsRegistrations(camp) ? 'desk' : 'attendees');
  };

  if (camps.loading) return <Loading />;

  const master = (
    <View style={styles.fill}>
      {camps.error ? (
        <View style={{ padding: gutter }}>
          <ErrorNote message={camps.error} />
        </View>
      ) : null}

      <FlatList
        data={ordered}
        keyExtractor={(camp) => camp.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={camps.refreshing}
            onRefresh={camps.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Tent size={36} color={palette.textFaint} />}
            title="No camps"
            hint="Camps planned in the web app appear here, ready to run."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === selectedId }}
            style={({ pressed }) => [
              styles.row,
              item.id === selectedId && styles.rowOn,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowTop}>
              <Text numberOfLines={1} style={styles.rowTitle}>
                {item.name}
              </Text>
              <Chip label={item.status.replace(/_/g, ' ')} tone={STATUS_TONE[item.status] ?? 'neutral'} />
            </View>

            <Text numberOfLines={1} style={styles.rowMeta}>
              {formatDate(item.startsAt)}
              {item.locationName ? ` · ${item.locationName}` : ''}
            </Text>

            <View style={styles.rowStats}>
              <Users size={13} color={palette.textMuted} />
              <Text style={styles.rowStat}>
                {item.registrationCount ?? 0}
                {item.capacity ? ` of ${item.capacity}` : ''} registered
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );

  const detail = selected ? (
    <View style={styles.fill}>
      <View style={[styles.detailHeader, { paddingHorizontal: gutter }]}>
        {/* On a phone the detail owns the screen, so it needs its own way back. */}
        {!isSplit ? (
          <Pressable
            onPress={() => setSelectedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to camps"
            style={styles.back}
          >
            <ArrowLeft size={16} color={palette.textSecondary} />
            <Text style={styles.backLabel}>Camps</Text>
          </Pressable>
        ) : null}

        <Text numberOfLines={1} style={styles.detailTitle}>
          {selected.name}
        </Text>
        <View style={styles.detailMetaRow}>
          <MapPin size={13} color={palette.textMuted} />
          <Text numberOfLines={1} style={styles.rowMeta}>
            {selected.locationName ?? 'No site set'} · {formatDate(selected.startsAt)}
          </Text>
        </View>

        <Segmented
          value={pane}
          onChange={setPane}
          style={styles.segments}
          options={[
            ...(mayWorkDesk ? ([{ value: 'desk' as Pane, label: 'Desk' }]) : []),
            { value: 'board' as Pane, label: 'Board' },
            { value: 'attendees' as Pane, label: 'Attendees' },
          ]}
        />
      </View>

      <View style={styles.fill}>
        {pane === 'desk' && mayWorkDesk ? (
          <RegistrationDesk camp={selected} onRegistered={camps.reload} />
        ) : pane === 'board' ? (
          <StationBoard camp={selected} />
        ) : (
          <AttendeeList camp={selected} />
        )}
      </View>
    </View>
  ) : null;

  return (
    <SplitView
      master={master}
      detail={detail}
      hasSelection={Boolean(selected)}
      emptyDetail={{ title: 'No camp selected', hint: 'Choose a camp to run its desk or board.' }}
    />
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  row: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: space.xs,
  },
  rowOn: { borderColor: palette.accentFrom },
  pressed: { opacity: 0.7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowTitle: { ...type.md, color: palette.text, fontWeight: '600', flex: 1 },
  rowMeta: { ...type.xs, color: palette.textSecondary, flex: 1 },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowStat: { ...type.xs, color: palette.textMuted },
  detailHeader: {
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 },
  backLabel: { ...type.sm, color: palette.textSecondary },
  detailTitle: { ...type.xl, color: palette.text, fontWeight: '700' },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segments: { marginTop: space.sm },
});
