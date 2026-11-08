import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ChevronRight, Clock, LayoutGrid, Play, Check } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource } from '@/lib/useResource';
import { formatWait, hasLiveBoard, stationPressure, summariseBoard, type Pressure } from '@/lib/camps';
import { Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { palette, radius, space, tint, type } from '@/theme/tokens';
import type { Camp, CampStation } from '@/lib/api';

/**
 * The station board — where a camp is congested, and who is next.
 *
 * Whoever is running the camp is walking it, not sitting at it, so the board
 * answers one question from arm's length: which station needs a person moved
 * to it. Pressure is colour, the bottleneck is named at the top, and the
 * numbers behind both are there when someone stops to look.
 *
 * Tapping a station opens its queue, where the two actions that actually move
 * the day along — start, complete — are a single tap each.
 */

const PRESSURE: Record<Pressure, { colour: string; fill: string; label: string }> = {
  clear: { colour: palette.success, fill: tint.successSoft, label: 'Clear' },
  busy: { colour: palette.warning, fill: tint.warningSoft, label: 'Busy' },
  blocked: { colour: palette.danger, fill: tint.dangerSoft, label: 'Backed up' },
};

export const StationBoard: React.FC<{ camp: Camp }> = ({ camp }) => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [openStation, setOpenStation] = useState<CampStation | null>(null);

  const board = useResource(() => api.campBoard(camp.id), [api, camp.id]);
  const stations = board.data ?? [];
  const summary = useMemo(() => summariseBoard(stations), [stations]);

  if (board.loading) return <Loading />;

  if (!hasLiveBoard(camp) && stations.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid size={36} color={palette.textFaint} />}
        title="No stations yet"
        hint="Stations are laid out when the camp is planned. The board fills as attendees are queued."
      />
    );
  }

  if (openStation) {
    return (
      <StationQueue
        station={openStation}
        onClose={() => {
          setOpenStation(null);
          board.reload();
        }}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <View style={[styles.summary, { paddingHorizontal: gutter }]}>
        <View style={styles.counts}>
          <Count label="Waiting" value={summary.waiting} />
          <Count label="Being seen" value={summary.inProgress} />
          <Count label="Done" value={summary.seen} />
        </View>

        {summary.bottleneck ? (
          <View style={styles.bottleneck}>
            <AlertTriangle size={14} color={palette.warning} />
            <Text style={styles.bottleneckText}>
              {summary.bottleneck.name} is holding things up —{' '}
              {summary.bottleneck.queued} waiting, longest{' '}
              {formatWait(summary.bottleneck.longestWaitSeconds)}.
            </Text>
          </View>
        ) : null}
      </View>

      {board.error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={board.error} />
        </View>
      ) : null}

      <FlatList
        data={stations}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={board.refreshing}
            onRefresh={board.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={<EmptyState title="No stations" hint="Nothing laid out for this camp." />}
        renderItem={({ item }) => {
          const pressure = PRESSURE[stationPressure(item)];
          return (
            <Pressable
              onPress={() => setOpenStation(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.queued} waiting`}
              style={({ pressed }) => [styles.station, pressed && styles.pressed]}
            >
              {/* A colour rail, not a coloured card: the queue numbers stay
                  legible and the status is readable at a glance from a metre away. */}
              <View style={[styles.rail, { backgroundColor: pressure.colour }]} />

              <View style={styles.stationBody}>
                <View style={styles.stationTop}>
                  <Text numberOfLines={1} style={styles.stationName}>
                    {item.name}
                  </Text>
                  {item.isClinical ? <Chip label="Clinical" tone="neutral" /> : null}
                </View>

                <View style={styles.stationStats}>
                  <Text style={[styles.queued, { color: pressure.colour }]}>{item.queued}</Text>
                  <Text style={styles.statLabel}>waiting</Text>
                  <View style={styles.dot} />
                  <Text style={styles.statValue}>{item.inProgress}</Text>
                  <Text style={styles.statLabel}>in progress</Text>
                  <View style={styles.dot} />
                  <Clock size={12} color={palette.textMuted} />
                  <Text style={styles.statLabel}>{formatWait(item.longestWaitSeconds)}</Text>
                </View>
              </View>

              <ChevronRight size={18} color={palette.textFaint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const Count: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.count}>
    <Text style={styles.countValue}>{value}</Text>
    <Text style={styles.countLabel}>{label}</Text>
  </View>
);

/** One station's queue, with the two actions that move it. */
const StationQueue: React.FC<{ station: CampStation; onClose: () => void }> = ({
  station,
  onClose,
}) => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queue = useResource(() => api.stationQueue(station.id), [api, station.id]);

  const act = useCallback(
    async (visitId: string, action: 'start' | 'complete') => {
      setWorking(visitId);
      setError(null);
      try {
        if (action === 'start') await api.startVisit(visitId);
        else await api.completeVisit(visitId);
        await queue.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not go through.');
      } finally {
        setWorking(null);
      }
    },
    [api, queue]
  );

  return (
    <View style={styles.fill}>
      <View style={[styles.queueHeader, { paddingHorizontal: gutter }]}>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.backRow}>
          <Text style={styles.backLabel}>‹ Board</Text>
        </Pressable>
        <Text style={styles.stationName}>{station.name}</Text>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={error} />
        </View>
      ) : null}

      {queue.loading ? (
        <Loading />
      ) : (
        <FlatList
          data={queue.data ?? []}
          keyExtractor={(v) => v.id}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          refreshControl={
            <RefreshControl
              refreshing={queue.refreshing}
              onRefresh={queue.refresh}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={<EmptyState title="Queue is empty" hint="Nobody is waiting here." />}
          renderItem={({ item }) => {
            const started = item.status === 'in_progress';
            return (
              <View style={styles.visit}>
                <View style={styles.token}>
                  <Text style={styles.tokenNo}>{item.tokenNo}</Text>
                </View>

                <View style={styles.visitBody}>
                  <Text numberOfLines={1} style={styles.visitName}>
                    {item.fullName}
                  </Text>
                  <Text style={styles.visitMeta}>
                    {[
                      item.ageYears != null ? `${item.ageYears}y` : null,
                      item.gender,
                      started ? 'In progress' : `Waiting ${formatWait(waitedFor(item.queuedAt))}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {/* Consent is checked again server-side when the station is
                      clinical; flagging it here saves the walk back to the desk. */}
                  {station.isClinical && !item.consentGivenAt ? (
                    <Chip label="No consent on file" tone="danger" />
                  ) : null}
                </View>

                <Pressable
                  onPress={() => act(item.id, started ? 'complete' : 'start')}
                  disabled={working === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={started ? 'Complete' : 'Start'}
                  style={({ pressed }) => [
                    styles.action,
                    started && styles.actionDone,
                    (pressed || working === item.id) && styles.pressed,
                  ]}
                >
                  {started ? (
                    <Check size={18} color={palette.text} />
                  ) : (
                    <Play size={16} color={palette.text} />
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const waitedFor = (queuedAt: string): number => {
  const started = new Date(queuedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  summary: {
    paddingVertical: space.md,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  counts: { flexDirection: 'row', gap: space.xl },
  count: { gap: 1 },
  countValue: { ...type.display, color: palette.text, fontWeight: '700' },
  countLabel: { ...type.xs, color: palette.textMuted },
  bottleneck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: tint.warningSoft,
    borderWidth: 1,
    borderColor: tint.warningBorder,
  },
  bottleneckText: { ...type.xs, color: palette.textOnRaised, flex: 1 },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingRight: space.md,
    overflow: 'hidden',
  },
  rail: { width: 4, alignSelf: 'stretch' },
  stationBody: { flex: 1, paddingVertical: space.md, gap: space.xs },
  stationTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stationName: { ...type.md, color: palette.text, fontWeight: '600', flexShrink: 1 },
  stationStats: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  queued: { ...type.lg, fontWeight: '700' },
  statValue: { ...type.md, color: palette.textStrong, fontWeight: '600' },
  statLabel: { ...type.xs, color: palette.textMuted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: palette.textFaint, marginHorizontal: 3 },
  pressed: { opacity: 0.7 },
  queueHeader: {
    paddingVertical: space.md,
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  backRow: { minHeight: 30, justifyContent: 'center' },
  backLabel: { ...type.sm, color: palette.accent },
  visit: {
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
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: palette.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenNo: { ...type.lg, color: palette.text, fontWeight: '700' },
  visitBody: { flex: 1, gap: 2, alignItems: 'flex-start' },
  visitName: { ...type.md, color: palette.text, fontWeight: '600' },
  visitMeta: { ...type.xs, color: palette.textSecondary },
  action: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.accentFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDone: { backgroundColor: palette.success },
});
