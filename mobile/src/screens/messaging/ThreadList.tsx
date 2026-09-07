import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Lock, Users, MessageSquare } from 'lucide-react-native';
import type { Thread } from '@/lib/api';
import { Chip, EmptyState, Loading } from '@/components/ui';
import { palette, space, type } from '@/theme/tokens';

/** "14:32" today, "12 Aug" this year, otherwise the date. */
const stamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString();
};

/** Who the thread is with, from the reader's point of view. */
const others = (thread: Thread, meId: string | undefined): string => {
  const rest = thread.participants.filter((p) => String(p.participantId) !== String(meId));
  if (rest.length === 0) return 'Just you';
  if (rest.length <= 2) return rest.map((p) => p.displayName).join(', ');
  return `${rest[0]?.displayName ?? ''} +${rest.length - 1}`;
};

export const ThreadList: React.FC<{
  threads: Thread[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSelect: (thread: Thread) => void;
  selectedId?: string | null;
  meId?: string;
  emptyHint: string;
}> = ({ threads, loading, refreshing, onRefresh, onSelect, selectedId, meId, emptyHint }) => {
  if (loading && threads.length === 0) return <Loading />;

  return (
    <FlatList
      data={threads}
      keyExtractor={(t) => t.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
      }
      ListEmptyComponent={
        <EmptyState
          icon={<MessageSquare size={36} color={palette.textFaint} />}
          title="No conversations yet"
          hint={emptyHint}
        />
      }
      contentContainerStyle={threads.length === 0 ? styles.emptyContainer : undefined}
      renderItem={({ item }) => {
        const unread = item.unreadCount > 0;
        const selected = item.id === selectedId;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.subject}${unread ? `, ${item.unreadCount} unread` : ''}`}
            style={({ pressed }) => [
              styles.row,
              selected && styles.rowSelected,
              unread && !selected && styles.rowUnread,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowTop}>
              <Text
                numberOfLines={1}
                style={[styles.subject, unread && styles.subjectUnread]}
              >
                {item.subject}
              </Text>
              <Text style={styles.time}>{stamp(item.lastMessageAt)}</Text>
            </View>

            <View style={styles.rowMeta}>
              {item.threadType === 'patient' ? (
                <Lock size={12} color={palette.textSecondary} />
              ) : (
                <Users size={12} color={palette.textSecondary} />
              )}
              <Text numberOfLines={1} style={styles.who}>
                {others(item, meId)}
              </Text>
            </View>

            {(unread || item.priority === 'urgent' || item.priority === 'high' ||
              item.status === 'closed' || item.patientName) && (
              <View style={styles.chips}>
                {unread && <Chip label={`${item.unreadCount} new`} tone="accent" />}
                {item.priority === 'urgent' && <Chip label="urgent" tone="danger" />}
                {item.priority === 'high' && <Chip label="high" tone="warning" />}
                {item.status === 'closed' && <Chip label="Closed" tone="neutral" />}
                {item.patientName && item.threadType === 'care_team' && (
                  <Chip label={`re: ${item.patientName}`} tone="neutral" />
                )}
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  emptyContainer: { flexGrow: 1 },
  row: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    gap: space.xs,
  },
  rowUnread: { backgroundColor: 'rgba(30,41,59,0.35)' },
  rowSelected: { backgroundColor: palette.raised },
  rowPressed: { opacity: 0.7 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  subject: { ...type.md, color: palette.textOnRaised, flex: 1 },
  subjectUnread: { color: palette.text, fontWeight: '700' },
  time: { ...type.xs, color: palette.textMuted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { ...type.sm, color: palette.textSecondary, flex: 1 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: space.xs },
});
