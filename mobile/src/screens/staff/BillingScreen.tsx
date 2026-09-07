import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { formatDate, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';
import type { Claim } from '@/lib/api';
import type { ChipTone } from '@/components/ui';

/**
 * Tablet only. Claims and what they are worth, grouped by status.
 *
 * Read-only by design: submitting and correcting claims is table work with
 * payer rules behind it, and belongs on the web app. What a clinician or
 * practice manager wants on a tablet is the answer to "where is the money" —
 * which this gives without pretending to be the RCM console.
 */
export const StaffBillingScreen: React.FC = () => {
  const { api } = useSession();
  const { gutter } = useLayout();

  const claims = useResource<Claim[]>(() => api.listClaims(), [api]);

  const totals = useMemo(() => {
    const rows = claims.data ?? [];
    const sum = (predicate: (c: Claim) => boolean) =>
      rows.filter(predicate).reduce((acc, c) => acc + Number(c.amount ?? 0), 0);
    return {
      outstanding: sum((c) => !['paid', 'denied', 'cancelled'].includes((c.status ?? '').toLowerCase())),
      denied: sum((c) => (c.status ?? '').toLowerCase() === 'denied'),
      count: rows.length,
    };
  }, [claims.data]);

  if (claims.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      {claims.error ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
          <ErrorNote message={claims.error} />
        </View>
      ) : null}

      <FlatList
        data={claims.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl refreshing={claims.refreshing} onRefresh={claims.refresh} tintColor={palette.accent} />
        }
        ListHeaderComponent={
          (claims.data ?? []).length > 0 ? (
            <View style={styles.summary}>
              <Card style={styles.tile}>
                <Text style={styles.tileValue}>{money(totals.outstanding)}</Text>
                <Text style={styles.tileLabel}>Outstanding</Text>
              </Card>
              <Card style={styles.tile}>
                <Text style={[styles.tileValue, styles.denied]}>{money(totals.denied)}</Text>
                <Text style={styles.tileLabel}>Denied</Text>
              </Card>
              <Card style={styles.tile}>
                <Text style={styles.tileValue}>{totals.count}</Text>
                <Text style={styles.tileLabel}>Claims</Text>
              </Card>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState icon={<Receipt size={34} color={palette.textFaint} />} title="No claims" />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.grow}>
              <Text style={styles.title}>{item.claim_number}</Text>
              <Text style={styles.meta}>
                {[item.payer, formatDate(item.service_date)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{money(Number(item.amount ?? 0))}</Text>
              {item.status ? <Chip label={item.status} tone={claimTone(item.status)} /> : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
};

/**
 * Currency is shown without a hardcoded symbol: the practice's currency is a
 * clinic setting on the server, so guessing "$" here would be wrong for most
 * of the deployments this app is meant to serve.
 */
const money = (value: number): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const claimTone = (status: string): ChipTone => {
  const s = status.toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'denied') return 'danger';
  if (s === 'pending' || s === 'submitted') return 'warning';
  return 'neutral';
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  summary: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tile: { flex: 1, padding: space.md },
  tileValue: { ...type.xl, color: palette.text, fontWeight: '700' },
  denied: { color: palette.danger },
  tileLabel: { ...type.xs, color: palette.textSecondary, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 6 },
  title: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  amount: { ...type.md, color: palette.text, fontWeight: '700' },
});
