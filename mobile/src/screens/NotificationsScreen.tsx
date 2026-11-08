import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate, formatTime } from '@/lib/useResource';
import { EmptyState, ErrorNote, Loading } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';
import type { Notification } from '@/lib/api';

/**
 * What the practice has told this account.
 *
 * Push notifications are not wired up yet (no APNs/FCM registration), so this
 * is the only place these land on a phone — which makes it worth having even
 * though it is a plain list. Tapping one marks it read, the same single action
 * the web header's bell offers.
 */
export const NotificationsScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter } = useLayout();
  const [error, setError] = useState<string | null>(null);

  const notifications = useResource(() => api.listNotifications(account?.id), [api, account?.id]);

  const markRead = useCallback(
    async (item: Notification) => {
      if (item.read) return;
      // Optimistic: the row is already grey before the request lands, and a
      // failure puts it back rather than leaving a lie on screen.
      notifications.set(
        (notifications.data ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      try {
        await api.markNotificationRead(item.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not mark that read.');
        await notifications.reload();
      }
    },
    [api, notifications]
  );

  if (notifications.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      {error ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
          <ErrorNote message={error} />
        </View>
      ) : null}

      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={notifications.refreshing}
            onRefresh={notifications.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Bell size={36} color={palette.textFaint} />}
            title="Nothing new"
            hint="Appointment changes, task assignments and alerts arrive here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => markRead(item)}
            accessibilityRole="button"
            accessibilityLabel={item.read ? item.message : `Unread: ${item.message}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.unread, item.read && styles.unreadHidden]} />
            <View style={styles.body}>
              <Text style={[styles.message, item.read && styles.messageRead]}>{item.message}</Text>
              <Text style={styles.meta}>
                {[item.type?.replace(/[._]/g, ' '), formatDate(item.created_at), formatTime(item.created_at)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.7 },
  unread: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.accent,
    marginTop: 6,
  },
  unreadHidden: { backgroundColor: 'transparent' },
  body: { flex: 1, gap: 3 },
  message: { ...type.base, color: palette.text },
  messageRead: { color: palette.textSecondary },
  meta: { ...type.xs, color: palette.textMuted },
});
