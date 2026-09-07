import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLayout } from '@/lib/device';
import { palette } from '@/theme/tokens';
import { EmptyState } from '@/components/ui';

/**
 * Master–detail that adapts to the device rather than being two screens.
 *
 * On a phone this renders exactly one pane: the list, or the detail once
 * something is selected, and the caller drives "back" by clearing selection.
 * On a wide tablet both panes sit side by side and selecting never navigates —
 * which is the same shape the web app uses above its `md` breakpoint, so the
 * two clients behave alike on comparable screens.
 */
export const SplitView: React.FC<{
  master: React.ReactNode;
  detail: React.ReactNode | null;
  /** True when the detail should own a phone screen. */
  hasSelection: boolean;
  emptyDetail?: { title: string; hint?: string };
}> = ({ master, detail, hasSelection, emptyDetail }) => {
  const { isSplit, masterWidth } = useLayout();

  if (!isSplit) {
    return <View style={styles.fill}>{hasSelection ? detail : master}</View>;
  }

  return (
    <View style={styles.row}>
      <View style={[styles.master, { width: masterWidth }]}>{master}</View>
      <View style={styles.detail}>
        {hasSelection && detail ? (
          detail
        ) : (
          <EmptyState
            title={emptyDetail?.title ?? 'Nothing selected'}
            hint={emptyDetail?.hint}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  master: { borderRightWidth: 1, borderRightColor: palette.border },
  detail: { flex: 1, minWidth: 0 },
});
