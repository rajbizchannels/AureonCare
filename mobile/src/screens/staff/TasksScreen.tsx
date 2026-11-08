import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Check, CircleCheck, ListTodo } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource, formatDate } from '@/lib/useResource';
import { Chip, EmptyState, ErrorNote, Loading, Segmented } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';
import type { Task } from '@/lib/api';

/**
 * The practice task list.
 *
 * One action — mark it done — because that is the thing worth doing from a
 * corridor. Creating and assigning tasks stays in the web app, where the
 * fields that make a task useful to someone else (owner, linked patient, due
 * time) are all on screen at once.
 *
 * Tasks are tenant-wide rather than per-user: the backend's `/tasks` has no
 * owner filter, so this shows the practice's list and says so.
 */

type Filter = 'open' | 'all';

const DONE = new Set(['completed', 'complete', 'done', 'closed', 'cancelled']);
const isDone = (task: Task): boolean => DONE.has(String(task.status ?? '').toLowerCase());

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

/** Overdue is a property of the row, and the only thing that should shout. */
const isOverdue = (task: Task): boolean => {
  if (!task.dueDate || isDone(task)) return false;
  const due = new Date(task.dueDate).getTime();
  return !Number.isNaN(due) && due < Date.now();
};

export const TasksScreen: React.FC = () => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [filter, setFilter] = useState<Filter>('open');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tasks = useResource(() => api.listTasks(), [api]);

  const rows = useMemo(() => {
    const all = tasks.data ?? [];
    return filter === 'open' ? all.filter((t) => !isDone(t)) : all;
  }, [tasks.data, filter]);

  const openCount = useMemo(
    () => (tasks.data ?? []).filter((t) => !isDone(t)).length,
    [tasks.data]
  );

  const complete = useCallback(
    async (task: Task) => {
      setWorking(task.id);
      setError(null);
      try {
        await api.updateTask(task.id, { status: 'Completed' });
        await tasks.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update that task.');
      } finally {
        setWorking(null);
      }
    },
    [api, tasks]
  );

  if (tasks.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', badge: openCount },
            { value: 'all', label: 'All' },
          ]}
        />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ErrorNote message={error} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl
            refreshing={tasks.refreshing}
            onRefresh={tasks.refresh}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<ListTodo size={36} color={palette.textFaint} />}
            title={filter === 'open' ? 'Nothing open' : 'No tasks'}
            hint="Tasks for the practice appear here."
          />
        }
        renderItem={({ item }) => {
          const done = isDone(item);
          return (
            <View style={[styles.row, isOverdue(item) && styles.rowOverdue]}>
              <Pressable
                onPress={() => (done ? undefined : complete(item))}
                disabled={done || working === item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`Mark "${item.title}" done`}
                style={({ pressed }) => [
                  styles.box,
                  done && styles.boxDone,
                  (pressed || working === item.id) && styles.pressed,
                ]}
              >
                {done ? <CircleCheck size={16} color={palette.success} /> : <Check size={14} color={palette.textFaint} />}
              </Pressable>

              <View style={styles.body}>
                <Text numberOfLines={2} style={[styles.title, done && styles.titleDone]}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text numberOfLines={2} style={styles.meta}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.chips}>
                  {item.priority ? (
                    <Chip label={item.priority} tone={PRIORITY_TONE[item.priority] ?? 'neutral'} />
                  ) : null}
                  {item.dueDate ? (
                    <Text style={[styles.due, isOverdue(item) && styles.dueOverdue]}>
                      {isOverdue(item) ? 'Overdue ' : 'Due '}
                      {formatDate(item.dueDate)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
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
  rowOverdue: { borderColor: palette.danger },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxDone: { borderColor: palette.success, backgroundColor: 'transparent' },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 3, alignItems: 'flex-start' },
  title: { ...type.md, color: palette.text, fontWeight: '600' },
  titleDone: { color: palette.textMuted, textDecorationLine: 'line-through' },
  meta: { ...type.xs, color: palette.textSecondary },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  due: { ...type.xs, color: palette.textMuted },
  dueOverdue: { color: palette.danger, fontWeight: '600' },
});
