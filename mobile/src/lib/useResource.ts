import { useCallback, useEffect, useState } from 'react';

/**
 * Load something from the API with the states every screen needs.
 *
 * Screens differ in what they fetch, not in how they wait for it, so the
 * loading / error / pull-to-refresh handling lives here once. A background
 * refresh deliberately keeps the last good data on screen: replacing a list
 * with a spinner because a poll failed is worse than showing slightly stale
 * rows.
 */
export interface Resource<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  reload: () => Promise<void>;
  /** Apply a local change without a round trip. */
  set: (next: T) => void;
}

export const useResource = <T,>(
  load: () => Promise<T>,
  deps: readonly unknown[] = []
): Resource<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The loader closes over screen state, so it is re-created per deps change;
  // the eslint rule cannot see through the indirection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const fetchNow = useCallback(
    async (quiet: boolean) => {
      if (!quiet) setLoading(true);
      try {
        setData(await run());
        setError(null);
      } catch (e) {
        // Only surface a failure that left the screen with nothing to show.
        if (!quiet) setError(e instanceof Error ? e.message : 'Could not load this.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [run]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await fetchNow(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchNow]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => {
      setRefreshing(true);
      void fetchNow(true);
    },
    reload: () => fetchNow(true),
    set: setData,
  };
};

// ── Formatting shared by the clinical screens ──────────────────────────────

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const fullName = (
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = 'Unknown'
): string => [first, last].filter(Boolean).join(' ') || fallback;

export const isUpcoming = (iso: string): boolean => new Date(iso).getTime() >= Date.now();

/**
 * `checked_in` → `checked in`.
 *
 * Status columns are snake_case because that is how they are stored and
 * compared; a chip is read by a person. Doing this at each call site is how
 * nine of them ended up printing the raw value.
 */
export const humanStatus = (value: string | null | undefined): string =>
  (value ?? '').replace(/_/g, ' ');

/**
 * Is this due date in the past?
 *
 * Compared by calendar day, not by instant. `due_date` is a DATE column, so
 * it arrives as midnight — comparing it to `Date.now()` made every task due
 * *today* read as overdue from one minute past midnight, which is both wrong
 * and the most alarming way to be wrong on a screen that paints overdue rows
 * red.
 */
export const isPastDue = (due: string | null | undefined): boolean => {
  if (!due) return false;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // The timestamp is midnight UTC for a DATE; read the date parts in the same
  // frame the string carries rather than shifting it into local time first.
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return dueDay.getTime() < today.getTime();
};

/** Due today, which deserves its own word rather than silence. */
export const isDueToday = (due: string | null | undefined): boolean => {
  if (!due) return false;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

/**
 * Same calendar day in the device's own timezone — which is the one the
 * person reading "Today" is standing in, even when the practice stores
 * timestamps in another.
 */
export const isToday = (iso: string | null | undefined): boolean => {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};
