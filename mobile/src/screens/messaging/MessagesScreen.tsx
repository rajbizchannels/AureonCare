import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Thread } from '@/lib/api';
import { useSession } from '@/context/SessionContext';
import { SplitView } from '@/components/SplitView';
import { ThreadList } from './ThreadList';
import { Conversation } from './Conversation';
import { palette } from '@/theme/tokens';

/**
 * The inbox. One screen on a phone (list, then conversation), two panes on a
 * wide tablet — SplitView decides, so this component does not care which.
 */
export const MessagesScreen: React.FC = () => {
  const { api, account, isPatient } = useSession();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const rows = await api.listThreads({ status: 'open' });
        setThreads(rows);
        // Keep the open conversation's own row fresh (unread, status) without
        // yanking the reader out of it.
        setSelected((current) =>
          current ? rows.find((r) => r.id === current.id) ?? current : current
        );
      } catch {
        // A failed background refresh must not interrupt someone mid-reply.
        if (!quiet) setThreads([]);
      } finally {
        if (!quiet) setLoading(false);
        setRefreshing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // The list polls more slowly than an open conversation does.
  useEffect(() => {
    const timer = setInterval(() => void load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const select = useCallback(
    (thread: Thread) => {
      setSelected(thread);
      // Clear the badge locally first; the next poll re-derives the truth.
      setThreads((rows) =>
        rows.map((r) => (r.id === thread.id ? { ...r, unreadCount: 0 } : r))
      );
    },
    []
  );

  return (
    <View style={styles.fill}>
      <SplitView
        hasSelection={Boolean(selected)}
        emptyDetail={{
          title: 'Select a conversation',
          hint: 'Messages are encrypted at rest and access is audited.',
        }}
        master={
          <ThreadList
            threads={threads}
            loading={loading}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            onSelect={select}
            selectedId={selected?.id ?? null}
            meId={account?.id}
            emptyHint={
              isPatient
                ? 'Start a conversation with your care team.'
                : 'Start one with a colleague or a patient.'
            }
          />
        }
        detail={
          selected ? (
            <Conversation
              api={api}
              thread={selected}
              isPatient={isPatient}
              meId={account?.id}
              onBack={() => setSelected(null)}
              onSent={() => void load(true)}
            />
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
});
